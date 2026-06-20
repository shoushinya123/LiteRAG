# LiteRAG API 文档

## 基础信息

- 基础路径: `http://localhost:3000/api`
- 内容类型: `application/json`
- 字符编码: UTF-8

---

## 1. RAG 检索

**POST** `/api/rag`

语义检索知识库中的文档。

### 请求体

```json
{
  "query": "什么是向量检索",
  "topK": 5,
  "hybridSearch": true,
  "rerank": true,
  "filters": {
    "file_path": "README.md"
  }
}
```

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| query | string | 是 | - | 查询文本 |
| topK | number | 否 | 5 | 返回结果数（1-20） |
| hybridSearch | boolean | 否 | true | 是否启用混合检索 |
| rerank | boolean | 否 | true | 是否启用重排序 |
| filters | object | 否 | - | 元数据过滤条件 |

### 响应

```json
{
  "success": true,
  "results": [
    {
      "chunkId": 1,
      "text": "向量检索是一种...",
      "score": 0.9521,
      "metadata": {
        "filePath": "README.md",
        "chunkIndex": 3
      }
    }
  ],
  "queryTime": 245
}
```

---

## 2. 文档入库

**POST** `/api/ingest`

将文档文本入库并建立向量索引。

### 请求体

```json
{
  "content": "这是一段需要入库的文档文本...",
  "filePath": "docs/report.txt",
  "metadata": {
    "author": "邵新野",
    "tags": ["AI", "RAG"]
  }
}
```

### 响应

```json
{
  "success": true,
  "chunkCount": 5,
  "documentId": "docs/report.txt"
}
```

---

## 3. 批量入库

**POST** `/api/ingest-batch`

批量入库多篇文档。

### 请求体

```json
{
  "documents": [
    {
      "content": "文档1的内容...",
      "filePath": "doc1.txt"
    },
    {
      "content": "文档2的内容...",
      "filePath": "doc2.txt"
    }
  ]
}
```

### 响应

```json
{
  "success": true,
  "totalChunks": 12,
  "errorCount": 0,
  "errors": []
}
```

---

## 4. 健康检查

**GET** `/api/health`

检查服务状态。

### 响应

```json
{
  "status": "ok",
  "database": {
    "connected": true,
    "vectorCount": 1234,
    "extensionLoaded": true
  },
  "model": {
    "source": "remote",
    "available": true,
    "rerankAvailable": false
  },
  "uptime": 3600000
}
```

---

## 错误响应格式

所有接口统一错误格式：

```json
{
  "success": false,
  "error": "错误描述信息"
}
```

HTTP 状态码：
- `400`: 请求参数错误
- `500`: 服务器内部错误
