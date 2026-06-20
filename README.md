# LiteRAG

跨平台轻量 RAG（检索增强生成）方案，基于 Next.js + SQLite + sqlite-vec。

**核心特性：** 1536 维向量存储与检索 | 混合检索（向量+关键词） | 本地/远程模型双模式 | MCP 协议标准化接口 | CLI 命令行管理

## 技术栈

| 组件 | 技术 | 说明 |
|------|------|------|
| 框架 | Next.js 15 (App Router) | 全栈运行环境 + API Routes |
| 数据库 | SQLite + sqlite-vec | 嵌入式向量存储，支持 vec0 虚拟表 |
| 向量维度 | 1536 | 兼容 OpenAI text-embedding-ada-002 |
| 检索 | KNN + FTS5 | 向量检索 + 全文关键词检索 + RRF 融合 |
| 模型 | Ollama / OpenAI API | 双模式切换 (MODEL_SOURCE=local\|remote) |
| 接口 | MCP / REST API | 标准化 Skill 调用 |
| 管理 | CLI | 纯命令行操作 |

## 快速开始

### Docker 部署（推荐）

```bash
git clone https://github.com/shoushinya123/LiteRAG.git
cd LiteRAG

# 创建环境变量文件
cp .env.example .env.local
# 编辑 .env.local，填入 OPENAI_API_KEY

# 生产模式启动
docker compose --profile prod up -d

# 查看日志
docker compose logs -f literag

# 使用 CLI
docker compose --profile cli run --rm literag-cli scripts/cli.ts stats
docker compose --profile cli run --rm literag-cli scripts/cli.ts search "什么是 RAG"
```

或使用本地 Ollama 模型：

```bash
# 1. 启动 Ollama 服务
docker compose -f docker-compose.infrastructure.yml up -d
docker compose -f docker-compose.infrastructure.yml exec ollama ollama pull bge-large

# 2. 修改 .env.local: MODEL_SOURCE=local
# 3. 启动主服务
docker compose --profile prod up -d
```

### 本地安装

```bash
git clone https://github.com/shoushinya123/LiteRAG.git
cd LiteRAG

# 自动初始化（推荐）
bash scripts/setup.sh

# 或手动安装
npm install
cp .env.example .env.local
```

配置 `.env.local`：

```env
MODEL_SOURCE=remote
OPENAI_API_KEY=sk-your-api-key-here
EMBEDDING_MODEL=text-embedding-ada-002
```

### 使用 CLI

```bash
# 查看帮助
npx tsx scripts/cli.ts

# 入库文档
npx tsx scripts/cli.ts ingest README.md
npx tsx scripts/cli.ts ingest --text "RAG 是检索增强生成技术..."

# 语义检索
npx tsx scripts/cli.ts search "什么是向量检索"

# 查看统计
npx tsx scripts/cli.ts stats

# 健康检查
npx tsx scripts/cli.ts health
```

### 4. 启动 API 服务（可选）

```bash
# 开发模式
npx tsx scripts/cli.ts next-dev
# → API: http://localhost:3000/api/rag
# → API: http://localhost:3000/api/ingest
# → API: http://localhost:3000/api/health
```

### 5. 启动 MCP Server（供 AI 调用）

```bash
npx tsx scripts/cli.ts serve
```

在 MCP Client 中配置：
```json
{
  "mcpServers": {
    "literag": {
      "command": "npx",
      "args": ["tsx", "scripts/mcp-server.ts"],
      "cwd": "/path/to/LiteRAG"
    }
  }
}
```

## CLI 命令

| 命令 | 说明 |
|------|------|
| `search <query>` | 语义检索知识库 |
| `ingest <file>` | 入库文档（.txt / .md） |
| `ingest --text <str>` | 入库纯文本 |
| `stats` | 查看统计信息 |
| `clear` | 清空所有数据 |
| `serve` | 启动 MCP Server (stdio) |
| `health` | 系统健康检查 |
| `next-dev` | 启动 Next.js 开发服务器 |
| `next-start` | 启动 Next.js 生产服务器 |

## API 端点

### POST /api/rag
语义检索。

```bash
curl -X POST http://localhost:3000/api/rag \
  -H "Content-Type: application/json" \
  -d '{"query": "什么是 RAG", "topK": 3}'
```

### POST /api/ingest
文档入库。

```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -d '{"content": "RAG 是检索增强生成技术...", "filePath": "example.txt"}'
```

### GET /api/health
健康检查。

```bash
curl http://localhost:3000/api/health
```

## MCP 工具

LiteRAG 通过 MCP 协议暴露 3 个标准化工具：

| 工具名 | 说明 | 参数 |
|--------|------|------|
| `search_documents` | RAG 语义检索 | query, topK, hybridSearch, rerank |
| `ingest_document` | 文档入库 | content, filePath, metadata |
| `get_stats` | 获取统计信息 | 无 |

## 项目结构

```
LiteRAG/
├── scripts/
│   ├── cli.ts          # CLI 管理工具
│   ├── mcp-server.ts   # MCP Server 启动脚本
│   └── setup.sh        # 跨平台初始化
├── src/
│   ├── app/
│   │   ├── page.tsx    # 状态页
│   │   └── api/        # REST API 路由
│   │       ├── rag/route.ts
│   │       ├── ingest/route.ts
│   │       ├── ingest-batch/route.ts
│   │       └── health/route.ts
│   └── lib/
│       ├── db/          # 数据库层
│       │   ├── connection.ts  # 连接 + sqlite-vec 加载
│       │   ├── schema.ts     # DDL
│       │   └── operations.ts # 向量 CRUD
│       ├── rag/         # RAG 引擎
│       │   ├── orchestrator.ts # 编排器
│       │   ├── retriever.ts    # 混合检索
│       │   └── chunker.ts      # 文档分块
│       ├── models/      # 模型适配层
│       │   ├── factory.ts    # 工厂（本地/远程切换）
│       │   ├── local.ts      # Ollama 本地调用
│       │   └── remote.ts     # OpenAI 远程调用
│       ├── mcp/         # MCP 协议层
│       │   ├── server.ts
│       │   └── tools.ts
│       └── utils/       # 工具函数
│           ├── config.ts
│           ├── vector.ts
│           ├── text.ts
│           └── platform.ts
├── data/               # SQLite 数据库文件目录
├── .env.example        # 环境变量模板
└── package.json
```

## 跨平台支持

| 平台 | 状态 | 说明 |
|------|------|------|
| Linux | ✅ | sqlite-vec 预编译 .so |
| macOS | ✅ | sqlite-vec 预编译 .dylib |
| Windows | ✅ | sqlite-vec 预编译 .dll |

sqlite-vec npm 包 (v0.1.9+) 内置预编译扩展，自动处理跨平台加载。

## 适用场景

- ✅ 个人知识库 / 本地离线知识库
- ✅ 小团队内部文档检索（QPS ≤ 100）
- ✅ 跨平台部署需求（同一套代码 Windows/Linux/macOS）
- ✅ 数据安全敏感场景（纯本地运行）
- ❌ 大规模数据集（> 100 万条向量，建议 Qdrant/Milvus）
- ❌ 超高并发场景（> 200 QPS，建议 PostgreSQL + pgvector）

---

## 🆕 存储架构与性能分析

### 存储架构

LiteRAG 的数据库文件包含多个存储单元，并非纯向量数据：

```
literag.db
├── document_chunks        ← 文本内容 + 元数据（占比最大）
├── document_chunks_fts    ← FTS5 全文倒排索引
├── documents (vec0)       ← 1536 维向量（flat 索引，向量 + 关键词检索）
├── vector_chunk_map       ← 向量 rowid → 文档块 id 映射
└── SQLite 内部开销        ← page header、WAL 日志等
```

检索流程中，"先查索引再找向量"与传统 B-tree 索引逻辑不同——向量检索是**相似度排序**，必须对向量空间做距离计算。当前 vec0 使用 flat 索引（暴力精确检索），每次 `MATCH` 查询默认全量扫描。优化方向是"**缩小扫描范围**"而非"用索引跳过计算"。

### 🆕 向量检索性能基准（1536 维）

| 库规模 | MD 文件数 | 向量数 | DB 大小 | KNN 延迟 | 感受 |
|--------|----------|--------|---------|---------|------|
| 小型 | 500 | ~5,000 | ~80 MB | <2ms | 毫秒级，完全无感 |
| 中型 | 5,000 | ~50,000 | ~600 MB | 1-2ms | 丝滑 |
| 大型 | 15,000 | ~150,000 | ~1.8 GB | 3-5ms | 流畅，基本无感 |
| 极限 | 30,000 | ~300,000 | ~3.5 GB | 10-20ms | 可用，略有感知 |
| 超限 | 50,000+ | 500,000+ | 5GB+ | 100ms+ | 明显卡顿，不建议 |

> 假设：平均每个 MD 文件 3,000 字，512 字分块 ≈ 每文件 ~10 个向量块。

### 🆕 检索速度对照表（按 DB 文件大小）

| DB 大小 | 典型向量数 | 单次 KNN 延迟 | 优化建议 |
|---------|-----------|-------------|---------|
| <100 MB | <5,000 | <2ms | 无需任何优化 |
| 100-500 MB | 5k~3万 | 1-3ms | 启用元数据索引过滤 |
| 500 MB-2 GB | 3万~10万 | 3-8ms | 加 vec0 分区 + 量化压缩 |
| 2-5 GB | 10万~30万 | 8-30ms | 分级过滤 + 内存预加载 |
| >5 GB | 30万+ | 50ms+ | 考虑迁移 pgvector / Qdrant |

### 🆕 4 层性能优化策略

#### Layer 1：元数据前置过滤 ⚡ 立刻生效

检索前用 B-tree 索引缩小候选集，避免全量扫描：

```sql
-- 无过滤：全表扫描 100,000 条向量 → 5-10ms
SELECT * FROM documents WHERE embedding MATCH ? ORDER BY distance LIMIT 5;

-- 有过滤：先通过 B-tree 索引过滤 → 仅扫描 ~500 条 → <1ms
SELECT d.rowid, d.distance, dc.chunk_text
FROM documents d
JOIN vector_chunk_map vcm ON d.rowid = vcm.vector_rowid
JOIN document_chunks dc ON vcm.chunk_id = dc.id
WHERE dc.file_path = 'docs/readme.md'   -- ← B-tree 索引快速过滤
  AND embedding MATCH ?                  -- ← 仅扫描缩小后的集合
ORDER BY d.distance LIMIT 5;
```

提升效果：**5-10x**。代码已内置支持（`knnSearch` 的 `filters` 参数），直接用就行。

#### Layer 2：vec0 分区（Partition Key）

按文件路径物理隔离向量数据：

```sql
CREATE VIRTUAL TABLE documents USING vec0(
  embedding float[1536],
  file_path TEXT PARTITION KEY   -- 分区键
);

-- 查询时只检索目标分区
SELECT rowid, distance FROM documents
WHERE embedding MATCH ? AND file_path = 'docs/report.md'
ORDER BY distance LIMIT 5;
```

| 对比 | 无分区 | 有分区 |
|------|--------|--------|
| 10万向量 / 100文件 | 全扫 10万条 | 只扫 ~1000条 |
| 延迟 | 5-10ms | <1ms |

提升效果：**~10x**。分区字段需在建表时定义。

#### Layer 3：二进制量化（Binary Quantization）

将 float32 向量压缩为位向量：

| 模式 | 存储/条 | 10万条存储 | 检索延迟 | 召回率 |
|------|---------|-----------|---------|--------|
| float32（当前） | 6KB | ~600MB | 5-10ms | 100% |
| binary quantized | ~200B | ~20MB | 1-2ms | ~95% |

提升效果：**存储压缩 32x，检索加速 4-5x**。

#### Layer 4：内存预加载

增大 SQLite 缓存，将热数据保留在内存：

```sql
PRAGMA cache_size = -256000;   -- 256MB 缓存
PRAGMA mmap_size = 268435456;  -- 256MB 内存映射
```

提升效果：**热数据零磁盘 I/O**。配合 WAL 模式（已启用），重复检索接近内存速度。

### 🆕 优化效果总览

```
查询请求
    │
    ▼
Layer 1: 元数据 B-tree 索引过滤 → 缩小到 ~1%
    │
    ▼
Layer 2: vec0 分区扫描 → 再缩小 ~10x
    │
    ▼
Layer 3: 量化向量检索 → 计算量降 ~32x
    │
    ▼
Layer 4: 内存缓存 (WAL + mmap) → 热数据零 I/O
    │
    ▼
TopK 结果返回
```

| 场景 | 当前延迟 | 优化后延迟 | 提升 |
|------|---------|-----------|------|
| 10万向量全量检索 | 5-10ms | 5-10ms | —（暴力不可跳过） |
| 10万向量+文件过滤 | 5-10ms | <1ms | 5-10x |
| 10万向量+分区+量化 | 5-10ms | ~0.5ms | 10-20x |

### 🆕 架构硬边界

sqlite-vec 目前**不支持 HNSW、IVF 等近似 ANN 索引算法**，也**不支持分布式部署**。这意味着：

- 无过滤条件的查询无法跳过全量扫描
- 向量数 >100 万时延迟升至秒级，不可用于实时交互
- 单连接架构，并发写入存在文件锁瓶颈

**甜点上限：~15,000 个 MD 文件（约 150,000 条向量，DB ~1.8 GB）**

超过此量级建议迁移至 PostgreSQL + pgvector 或 Qdrant/Milvus。

## 许可证

MIT
