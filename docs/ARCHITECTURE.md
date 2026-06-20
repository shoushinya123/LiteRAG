# LiteRAG 架构文档

## 系统架构

```
┌─────────────────────────────────────────────────┐
│                    LiteRAG System                 │
│                                                   │
│  ┌───────────────────────────────────────────┐  │
│  │          API / MCP 接口层                    │  │
│  │  ┌─────────────┐  ┌─────────────────────┐  │  │
│  │  │ REST API     │  │ MCP Server (stdio)   │  │  │
│  │  │ /api/rag     │  │ search_documents     │  │  │
│  │  │ /api/ingest  │  │ ingest_document      │  │  │
│  │  │ /api/health  │  │ get_stats            │  │  │
│  │  └─────────────┘  └─────────────────────┘  │  │
│  └───────────────────────────────────────────┘  │
│                       │                           │
│  ┌───────────────────────────────────────────┐  │
│  │          RAG 编排层 (Orchestrator)          │  │
│  │  文档分块 → 向量化 → 入库 → 检索 → Rerank  │  │
│  └───────────────────────────────────────────┘  │
│            │                    │                 │
│  ┌─────────┴──────┐  ┌────────┴──────────┐     │
│  │ 模型适配层      │  │ 混合检索引擎       │     │
│  │ ┌────────────┐ │  │ ┌────────────────┐ │     │
│  │ │ Local      │ │  │ │ Vector  (KNN)  │ │     │
│  │ │ (Ollama)   │ │  │ │ Keyword (FTS5) │ │     │
│  │ ├────────────┤ │  │ └────────────────┘ │     │
│  │ │ Remote     │ │  │         │           │     │
│  │ │ (OpenAI)   │ │  │    RRF Fusion      │     │
│  │ └────────────┘ │  └────────────────────┘     │
│  └────────┬───────┘            │                 │
│           │                    │                 │
│  ┌────────┴────────────────────┴─────────────┐  │
│  │          SQLite + sqlite-vec 存储层         │  │
│  │  ┌──────────────────────────────────────┐  │  │
│  │  │ documents (vec0)  - 1536维向量存储    │  │  │
│  │  │ document_chunks   - 文档块文本+元数据 │  │  │
│  │  │ document_chunks_fts - FTS5全文索引   │  │  │
│  │  │ vector_chunk_map  - 向量→文档块映射   │  │  │
│  │  └──────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

## 数据流

### 入库流程 (Ingest)

```
用户文本/文件
    │
    ▼
[Chunker] 文档分块 (512字/128重叠)
    │
    ▼
[Model Factory] 向量化 (Embedding)
    ├── local:  Ollama (bge-large)
    └── remote: OpenAI (text-embedding-ada-002)
    │
    ▼
[SQLite]
    ├── INSERT INTO document_chunks (文本+元数据)
    ├── INSERT INTO documents (vec0 向量)
    └── INSERT INTO vector_chunk_map (映射)
```

### 检索流程 (Query)

```
用户查询文本
    │
    ▼
[Model Factory] 查询向量化
    │
    ▼
[Retriever] 混合检索
    ├── Vector KNN:  documents MATCH query_vector
    └── Keyword:     document_chunks_fts MATCH query
    │
    ▼
[RRF Fusion] 结果融合 (k=60)
    │
    ▼
[Rerank Model] (可选) 精排
    │
    ▼
返回 TopK 结果
```

## 混合检索 (RRF)

Reciprocal Rank Fusion 公式：

```
RRF_score(d) = Σ 1 / (k + rank_i(d))

其中:
  k = 60 (平滑参数)
  rank_i(d) = 文档 d 在第 i 个排序列表中的排名
```

融合权重：
- 向量检索权重: 1.0
- 关键词检索权重: 0.5

## 数据库 Schema

```sql
-- vec0 虚拟表（向量存储，1536维）
CREATE VIRTUAL TABLE documents USING vec0(
  embedding float[1536]
);

-- 文档块表
CREATE TABLE document_chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chunk_text TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  file_path TEXT DEFAULT '',
  source_type TEXT DEFAULT 'text',
  metadata_json TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now'))
);

-- FTS5 全文索引
CREATE VIRTUAL TABLE document_chunks_fts USING fts5(
  chunk_text,
  file_path,
  content='document_chunks',
  content_rowid='id'
);

-- 向量-文档块映射
CREATE TABLE vector_chunk_map (
  vector_rowid INTEGER PRIMARY KEY,
  chunk_id INTEGER NOT NULL,
  FOREIGN KEY (chunk_id) REFERENCES document_chunks(id)
);
```

## 性能特征

| 指标 | 数值 | 条件 |
|------|------|------|
| 向量存储 | ~6KB/条 | 1536维 (float) |
| 量化存储 | ~48B/条 | 二进制量化 |
| KNN 延迟 | 5-10ms | 10万条向量 |
| KNN 延迟 | 1-2ms | 量化+预加载 |
| 并发上限 | ~100 QPS | WAL 模式 |
| 内存占用 | ~200MB | 默认配置 |
| 10万向量磁盘 | ~48MB | 量化压缩 |

## 扩展指南

### 切换模型模式

编辑 `.env.local`:

```bash
# 远程 API (OpenAI 兼容)
MODEL_SOURCE=remote
OPENAI_API_KEY=sk-xxx

# 本地模型 (Ollama)
MODEL_SOURCE=local
OLLAMA_HOST=http://localhost:11434
```

### 添加新的 Embedding 模型

实现 `EmbeddingModel` 接口：

```typescript
class MyEmbeddingModel implements EmbeddingModel {
  readonly dimensions = 1536;
  
  async embed(texts: string[]): Promise<number[][]> {
    // 实现逻辑
  }
  
  async embedSingle(text: string): Promise<number[]> {
    // 实现逻辑
  }
}
```

在 `factory.ts` 中注册。
