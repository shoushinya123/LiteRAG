/**
 * RAG 编排器 (Orchestrator)
 * 统一管理文档入库、向量化、检索的全链路编排
 */
import { chunkText } from "./chunker";
import { insertVectors, getStats } from "@/lib/db/operations";
// batchEmbed delay is inlined below
import { getEmbeddingModel, getRerankModel } from "@/lib/models/factory";
import { hybridSearch, vectorSearch } from "./retriever";
import { config } from "@/lib/utils/config";
import type { DocumentMeta, RAGQueryParams, RAGResult, RAGQueryResponse } from "@/types";
import type { IngestOptions, SearchResult } from "./types";

/**
 * 文档入库
 * 1. 分块 → 2. 向量化 → 3. 存入 SQLite
 */
export async function ingestDocument(
  content: string,
  options: IngestOptions = {}
): Promise<{ chunkCount: number; documentId: string }> {
  const startTime = Date.now();

  // 1. 分块
  const chunks = chunkText(content, options.chunkSize, options.chunkOverlap);
  if (chunks.length === 0) {
    throw new Error("文档分块后无有效内容");
  }

  console.log(`[RAG] 分块完成: ${chunks.length} 个块`);

  // 2. 向量化
  const embeddingModel = getEmbeddingModel();
  const chunkTexts = chunks.map((c) => c.text);
  const embeddings = await batchEmbed(chunkTexts, embeddingModel);

  // 3. 准备元数据
  const metadatas: DocumentMeta[] = chunks.map((chunk) => ({
    chunkIndex: chunk.index,
    chunkText: chunk.text,
    filePath: options.filePath || `inline://${Date.now()}`,
    ...options.metadata,
  }));

  // 4. 入库
  const result = insertVectors(embeddings, metadatas);

  const elapsed = Date.now() - startTime;
  console.log(
    `[RAG] 入库完成: ${result.insertedCount} 条向量, 耗时 ${elapsed}ms`
  );

  return {
    chunkCount: result.insertedCount,
    documentId: options.filePath || `doc_${Date.now()}`,
  };
}

/**
 * 批量文档入库
 */
export async function ingestBatch(
  documents: Array<{ content: string; options?: IngestOptions }>
): Promise<{ totalChunks: number; errors: string[] }> {
  let totalChunks = 0;
  const errors: string[] = [];

  for (let i = 0; i < documents.length; i++) {
    try {
      const result = await ingestDocument(
        documents[i].content,
        documents[i].options
      );
      totalChunks += result.chunkCount;
    } catch (error) {
      errors.push(`文档 ${i}: ${(error as Error).message}`);
    }
  }

  return { totalChunks, errors };
}

/**
 * RAG 检索（核心入口）
 * 1. 查询向量化 → 2. 混合检索 → 3. Rerank(可选) → 4. 返回结果
 */
export async function ragQuery(
  params: RAGQueryParams
): Promise<RAGQueryResponse> {
  const startTime = Date.now();
  const {
    query,
    topK = config.defaultTopK,
    hybridSearch: useHybrid = config.defaultHybridSearch,
    rerank: useRerank = config.defaultRerank,
    filters,
  } = params;

  try {
    // 1. 查询向量化
    const embeddingModel = getEmbeddingModel();
    const queryVector = await embeddingModel.embedSingle(query);

    // 2. 检索
    let searchResults: SearchResult[];
    if (useHybrid) {
      searchResults = await hybridSearch(queryVector, query, topK, filters);
    } else {
      searchResults = await vectorSearch(queryVector, topK, filters);
    }

    if (searchResults.length === 0) {
      return {
        success: true,
        results: [],
        queryTime: Date.now() - startTime,
      };
    }

    // 3. Rerank（可选）
    let finalResults: SearchResult[] = searchResults;
    if (useRerank) {
      const rerankModel = getRerankModel();
      if (rerankModel) {
        try {
          const documents = searchResults.map((r) => r.chunkText);
          const rerankScores = await rerankModel.rerank(query, documents);

          // 用 Rerank 分数调整排序
          finalResults = searchResults
            .map((r, i) => ({
              ...r,
              fusedScore:
                r.fusedScore * 0.3 +
                (rerankScores[i]?.score || 0) * 0.7,
            }))
            .sort((a, b) => b.fusedScore - a.fusedScore)
            .slice(0, topK);
        } catch (error) {
          console.warn("[RAG] Rerank 失败，使用原始结果:", error);
        }
      }
    }

    // 4. 格式化返回
    const ragResults: RAGResult[] = finalResults.map((r) => ({
      chunkId: r.chunkId,
      text: r.chunkText,
      score: r.fusedScore,
      metadata: r.metadata,
    }));

    const elapsed = Date.now() - startTime;
    console.log(`[RAG] 检索完成: ${ragResults.length} 条结果, 耗时 ${elapsed}ms`);

    return {
      success: true,
      results: ragResults,
      queryTime: elapsed,
    };
  } catch (error) {
    return {
      success: false,
      results: [],
      error: (error as Error).message,
      queryTime: Date.now() - startTime,
    };
  }
}

/**
 * 获取数据库统计
 */
export function getRagStats() {
  return getStats();
}

/**
 * 批量 Embedding（带限流，避免 API 超载）
 */
async function batchEmbed(
  texts: string[],
  model: { embed(texts: string[]): Promise<number[][]> },
  batchSize: number = 20
): Promise<number[][]> {
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const embeddings = await model.embed(batch);
    allEmbeddings.push(...embeddings);

    // 批次间小延迟，避免 API 限流
    if (i + batchSize < texts.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return allEmbeddings;
}
