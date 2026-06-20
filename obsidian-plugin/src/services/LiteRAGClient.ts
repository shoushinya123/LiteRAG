// ============================================================
// LiteRAGClient — 与 LiteRAG 后端通信
// ============================================================
import type { RAGResponse, IngestResponse } from "../react/types";

export class LiteRAGClient {
  constructor(private baseUrl: string) {}

  /** 语义检索 */
  async search(
    query: string,
    topK = 5,
    hybridSearch = true,
    rerank = true,
    filters?: Record<string, string>
  ): Promise<RAGResponse> {
    const res = await fetch(`${this.baseUrl}/api/rag`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, topK, hybridSearch, rerank, filters }),
    });
    if (!res.ok) {
      throw new Error(`RAG 检索失败 [${res.status}]: ${await res.text()}`);
    }
    return (await res.json()) as RAGResponse;
  }

  /** 文档入库 */
  async ingest(
    content: string,
    filePath: string,
    metadata?: Record<string, unknown>
  ): Promise<IngestResponse> {
    const res = await fetch(`${this.baseUrl}/api/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, filePath, metadata }),
    });
    if (!res.ok) {
      throw new Error(`入库失败 [${res.status}]: ${await res.text()}`);
    }
    return (await res.json()) as IngestResponse;
  }

  /** 健康检查 */
  async health(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/health`, {
        signal: AbortSignal.timeout(3000),
      });
      const data = (await res.json()) as { status: string };
      return data.status === "ok";
    } catch {
      return false;
    }
  }

  /** 批量入库 */
  async ingestBatch(
    documents: Array<{ content: string; filePath: string; metadata?: Record<string, unknown> }>
  ): Promise<{ success: boolean; totalChunks: number; errorCount: number }> {
    const res = await fetch(`${this.baseUrl}/api/ingest-batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documents }),
    });
    if (!res.ok) {
      throw new Error(`批量入库失败 [${res.status}]`);
    }
    return (await res.json()) as { success: boolean; totalChunks: number; errorCount: number };
  }

  /** 按路径删除文档 */
  async deleteByPath(filePath: string): Promise<{ success: boolean; error?: string }> {
    const res = await fetch(`${this.baseUrl}/api/delete-by-path`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filePath }),
    });
    if (!res.ok) {
      throw new Error(`删除索引失败 [${res.status}]: ${await res.text()}`);
    }
    return (await res.json()) as { success: boolean; error?: string };
  }
}
