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

### 1. 克隆 & 安装

```bash
git clone https://github.com/shoushinya123/LiteRAG.git
cd LiteRAG

# 自动初始化（推荐）
bash scripts/setup.sh

# 或手动安装
npm install
cp .env.example .env.local
```

### 2. 配置

编辑 `.env.local`：

```env
# 模型模式：local（Ollama）或 remote（OpenAI API）
MODEL_SOURCE=remote

# 远程模式配置
OPENAI_API_KEY=sk-your-api-key-here
EMBEDDING_MODEL=text-embedding-ada-002

# 本地模式配置（需要先安装 Ollama: ollama pull bge-large）
# MODEL_SOURCE=local
# OLLAMA_HOST=http://localhost:11434
```

### 3. 使用 CLI

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

- ✅ 个人知识库 / 本地离线知识库（文档 ≤ 10 万条向量）
- ✅ 小团队内部文档检索（QPS ≤ 100）
- ✅ 跨平台部署需求（同一套代码 Windows/Linux/macOS）
- ✅ 数据安全敏感场景（纯本地运行）
- ❌ 大规模数据集（> 100 万条向量，建议 Qdrant/Milvus）
- ❌ 超高并发场景（> 200 QPS，建议 PostgreSQL + pgvector）

## 许可证

MIT
