/**
 * 本地模型调用（Ollama）
 * 支持 bge-large 等主流本地 Embedding/Rerank 模型
 */
import type { EmbeddingModel, RerankModel } from "@/types";
import { config } from "@/lib/utils/config";

/** 请求超时(ms) */
const REQUEST_TIMEOUT = 60000;

/**
 * 本地 Embedding 模型（通过 Ollama）
 */
export class LocalEmbeddingModel implements EmbeddingModel {
  // bge-large 默认输出维度
  readonly dimensions = 1024;
  private host: string;
  private model: string;

  constructor(model: string, host?: string) {
    this.model = model;
    this.host = host || config.ollamaHost;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const results: number[][] = [];
    for (const text of texts) {
      const vec = await this.embedSingle(text);
      results.push(vec);
    }
    return results;
  }

  async embedSingle(text: string): Promise<number[]> {
    const url = `${this.host}/api/embeddings`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          prompt: text,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `Ollama Embedding 请求失败 [${response.status}]: 请确保 Ollama 服务已启动且模型 ${this.model} 已拉取`
        );
      }

      const data = (await response.json()) as { embedding: number[] };
      return data.embedding;
    } finally {
      clearTimeout(timeout);
    }
  }
}

/**
 * 本地 Rerank 模型（通过 Ollama，使用 Chat API 评分）
 */
export class LocalRerankModel implements RerankModel {
  private host: string;
  private model: string;

  constructor(model: string, host?: string) {
    this.model = model;
    this.host = host || config.ollamaHost;
  }

  async rerank(
    query: string,
    documents: string[]
  ): Promise<Array<{ index: number; score: number }>> {
    if (documents.length === 0) return [];

    const url = `${this.host}/api/chat`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const prompt = `Query: "${query}"
Rate each document's relevance on a scale of 0.0 to 1.0. Output ONLY a JSON array of scores.
Documents:
${documents.map((doc, i) => `[${i}]: ${doc.slice(0, 300)}`).join("\n")}
Output:`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: "user", content: prompt }],
          stream: false,
          options: { temperature: 0 },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Ollama Rerank 请求失败 [${response.status}]`);
      }

      const data = (await response.json()) as {
        message: { content: string };
      };
      const content = data.message?.content || "[]";
      const match = content.match(/\[[\d.,\s]+\]/);
      const scores: number[] = match ? JSON.parse(match[0]) : [];

      while (scores.length < documents.length) scores.push(0.5);
      return scores.slice(0, documents.length).map((score, index) => ({
        index,
        score: Math.max(0, Math.min(1, score)),
      }));
    } finally {
      clearTimeout(timeout);
    }
  }
}

/**
 * 检查 Ollama 服务是否可用
 */
export async function checkOllamaHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${config.ollamaHost}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * 获取已安装的 Ollama 模型列表
 */
export async function listOllamaModels(): Promise<string[]> {
  try {
    const response = await fetch(`${config.ollamaHost}/api/tags`);
    const data = (await response.json()) as { models: Array<{ name: string }> };
    return data.models?.map((m) => m.name) || [];
  } catch {
    return [];
  }
}
