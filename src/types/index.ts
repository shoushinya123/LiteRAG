// ============================================================
// LiteRAG - 全局类型定义
// ============================================================

/** 模型调用来源 */
export type ModelSource = "local" | "remote";

/** RAG 检索请求参数 */
export interface RAGQueryParams {
  query: string;
  topK?: number;
  hybridSearch?: boolean;
  rerank?: boolean;
  filters?: Record<string, string>;
}

/** RAG 检索结果条目 */
export interface RAGResult {
  chunkId: number;
  text: string;
  score: number;
  metadata: Record<string, unknown>;
}

/** RAG 检索响应 */
export interface RAGQueryResponse {
  success: boolean;
  results: RAGResult[];
  queryTime?: number; // 毫秒
  error?: string;
}

/** 文档入库请求 */
export interface IngestRequest {
  content: string;
  metadata?: Record<string, unknown>;
}

/** 批量入库请求 */
export interface IngestBatchRequest {
  documents: IngestRequest[];
}

/** 文档入库响应 */
export interface IngestResponse {
  success: boolean;
  documentId?: number;
  chunkCount?: number;
  error?: string;
}

/** 健康检查响应 */
export interface HealthResponse {
  status: "ok" | "error";
  database: {
    connected: boolean;
    vectorCount: number;
    extensionLoaded: boolean;
  };
  model: {
    source: ModelSource;
    available: boolean;
  };
  uptime: number;
}

/** 文档分块 */
export interface TextChunk {
  index: number;
  text: string;
  startChar: number;
  endChar: number;
}

/** 文档元数据 */
export interface DocumentMeta {
  id?: number;
  chunkIndex: number;
  chunkText: string;
  filePath?: string;
  createdAt?: string;
  [key: string]: unknown;
}

/** Embedding 模型接口 */
export interface EmbeddingModel {
  embed(texts: string[]): Promise<number[][]>;
  embedSingle(text: string): Promise<number[]>;
  readonly dimensions: number;
}

/** Rerank 模型接口 */
export interface RerankModel {
  rerank(
    query: string,
    documents: string[]
  ): Promise<Array<{ index: number; score: number }>>;
}
