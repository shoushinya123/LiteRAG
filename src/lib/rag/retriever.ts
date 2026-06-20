/**
 * 混合检索引擎
 * 融合向量检索（sqlite-vec KNN）和关键词检索（FTS5）
 * 使用 RRF (Reciprocal Rank Fusion) 算法融合结果
 */
import { knnSearch, keywordSearch } from "@/lib/db/operations";
import type { SearchResult, HybridSearchConfig } from "./types";
import { config } from "@/lib/utils/config";

/** 默认混合检索配置 */
const DEFAULT_HYBRID_CONFIG: HybridSearchConfig = {
  vectorWeight: 1.0,
  keywordWeight: 0.5,
  topK: config.defaultTopK,
  useRerank: config.defaultRerank,
};

/**
 * 混合检索：向量 + 关键词
 */
export async function hybridSearch(
  queryVector: number[],
  queryText: string,
  topK: number = config.defaultTopK,
  filters?: Record<string, string>,
  hybridConfig?: Partial<HybridSearchConfig>
): Promise<SearchResult[]> {
  const cfg = { ...DEFAULT_HYBRID_CONFIG, ...hybridConfig, topK };

  // 并行执行向量检索和关键词检索
  const vectorResult = knnSearch(
    queryVector,
    Math.max(topK * 2, 10), // 多取一些候选，融合后截断
    filters
  );
  const vectorResults = vectorResult.map((r, idx) => ({
    chunkId: r.chunkId,
    chunkText: r.chunkText,
    vectorScore: r.score,
    keywordScore: 0,
    fusedScore: 0,
    metadata: r.metadata,
    vectorRank: idx + 1,
  }));

  const keywordResult = keywordSearch(
    queryText,
    Math.max(topK * 2, 10)
  );
  const keywordResults = keywordResult.map((r, idx) => ({
    chunkId: r.chunkId,
    chunkText: r.chunkText,
    vectorScore: 0,
    keywordScore: r.score,
    fusedScore: 0,
    metadata: r.metadata,
    keywordRank: idx + 1,
  }));

  // RRF 融合
  return fuseResults(vectorResults, keywordResults, cfg);
}

/**
 * 仅向量检索
 */
export async function vectorSearch(
  queryVector: number[],
  topK: number = config.defaultTopK,
  filters?: Record<string, string>
): Promise<SearchResult[]> {
  const results = knnSearch(queryVector, topK, filters);
  return results.map((r) => ({
    chunkId: r.chunkId,
    chunkText: r.chunkText,
    vectorScore: r.score,
    keywordScore: 0,
    fusedScore: r.score,
    metadata: r.metadata,
  }));
}

/**
 * RRF (Reciprocal Rank Fusion) 融合算法
 * 融合向量检索和关键词检索的结果
 *
 * RRF 分数 = sum(1 / (k + rank_i)) for each result in each ranked list
 * 其中 k 是平滑参数（通常为 60）
 */
function fuseResults(
  vectorResults: Array<SearchResult & { vectorRank?: number }>,
  keywordResults: Array<SearchResult & { keywordRank?: number }>,
  cfg: HybridSearchConfig
): SearchResult[] {
  const K = 60; // RRF 平滑参数
  const scoreMap = new Map<
    number,
    {
      chunkId: number;
      chunkText: string;
      vectorScore: number;
      keywordScore: number;
      metadata: Record<string, unknown>;
      rrfScore: number;
    }
  >();

  // 向量检索结果
  for (const r of vectorResults) {
    const rank = r.vectorRank || 0;
    const rrfComponent = cfg.vectorWeight * (1 / (K + rank));
    scoreMap.set(r.chunkId, {
      chunkId: r.chunkId,
      chunkText: r.chunkText,
      vectorScore: r.vectorScore,
      keywordScore: 0,
      metadata: r.metadata,
      rrfScore: rrfComponent,
    });
  }

  // 关键词检索结果
  for (const r of keywordResults) {
    const rank = r.keywordRank || 0;
    const rrfComponent = cfg.keywordWeight * (1 / (K + rank));

    const existing = scoreMap.get(r.chunkId);
    if (existing) {
      existing.keywordScore = r.keywordScore;
      existing.rrfScore += rrfComponent;
    } else {
      scoreMap.set(r.chunkId, {
        chunkId: r.chunkId,
        chunkText: r.chunkText,
        vectorScore: 0,
        keywordScore: r.keywordScore,
        metadata: r.metadata,
        rrfScore: rrfComponent,
      });
    }
  }

  // 按 RRF 分数排序
  const fused = Array.from(scoreMap.values())
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .slice(0, cfg.topK)
    .map((entry) => ({
      chunkId: entry.chunkId,
      chunkText: entry.chunkText,
      vectorScore: entry.vectorScore,
      keywordScore: entry.keywordScore,
      fusedScore: entry.rrfScore,
      metadata: entry.metadata,
    }));

  return fused;
}
