/**
 * RAG 模块类型定义
 */
import type { RAGQueryParams, RAGResult, TextChunk } from "@/types";

// 重新导出以保持模块内聚
export type { RAGQueryParams, RAGResult, TextChunk };

/** 检索器接口 */
export interface Retriever {
  search(
    queryVector: number[],
    queryText: string,
    topK: number,
    filters?: Record<string, string>
  ): Promise<SearchResult[]>;
}

/** 检索结果（内部使用） */
export interface SearchResult {
  chunkId: number;
  chunkText: string;
  vectorScore: number;
  keywordScore: number;
  fusedScore: number;
  metadata: Record<string, unknown>;
}

/** 混合检索配置 */
export interface HybridSearchConfig {
  vectorWeight: number;
  keywordWeight: number;
  topK: number;
  useRerank: boolean;
}

/** 文档入库选项 */
export interface IngestOptions {
  filePath?: string;
  metadata?: Record<string, unknown>;
  chunkSize?: number;
  chunkOverlap?: number;
}
