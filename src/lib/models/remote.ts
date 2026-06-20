/**
 * 远程模型调用（OpenAI 兼容 API）
 * 支持 text-embedding-ada-002 及其他 OpenAI 兼容的 Embedding/Rerank 模型
 */
import type { EmbeddingModel, RerankModel } from "@/types";
import { config } from "@/lib/utils/config";

/** API 请求超时(ms) */
const REQUEST_TIMEOUT = 30000;

/**
 * 远程 Embedding 模型
 * 通过 OpenAI 兼容 API 调用
 */
export class RemoteEmbeddingModel implements EmbeddingModel {
  readonly dimensions = config.vectorDimensions;
  private baseUrl: string;
  private apiKey: string;
  private model: string;

  constructor(model: string, baseUrl: string, apiKey: string) {
    this.model = model;
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const url = `${this.baseUrl}/embeddings`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          input: texts,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Embedding API 请求失败 [${response.status}]: ${errorText}`
        );
      }

      const data = (await response.json()) as {
        data: Array<{ embedding: number[]; index: number }>;
      };

      // 按 index 排序确保顺序正确
      return data.data
        .sort((a, b) => a.index - b.index)
        .map((item) => item.embedding);
    } finally {
      clearTimeout(timeout);
    }
  }

  async embedSingle(text: string): Promise<number[]> {
    const results = await this.embed([text]);
    return results[0];
  }
}

/**
 * 远程 Rerank 模型
 * 通过 OpenAI 兼容 API 的 Chat Completion 实现简单的重排序
 * 注：生产环境建议使用专用的 Rerank API（如 Cohere Rerank）
 */
export class RemoteRerankModel implements RerankModel {
  private baseUrl: string;
  private apiKey: string;
  private model: string;

  constructor(model: string, baseUrl: string, apiKey: string) {
    this.model = model;
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  async rerank(
    query: string,
    documents: string[]
  ): Promise<Array<{ index: number; score: number }>> {
    if (documents.length === 0) return [];

    const url = `${this.baseUrl}/chat/completions`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    // 使用 LLM 对每个文档进行相关性评分
    // 策略: 要求模型对每个文档输出 0-1 的相关性分数
    const prompt = `Given the query: "${query}", rate the relevance of each document on a scale of 0 to 1. 
Output ONLY a JSON array of scores, one per document, in order.

Documents:
${documents.map((doc, i) => `[${i}]: ${doc.slice(0, 200)}`).join("\n\n")}

Output format: [score0, score1, ...]`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: "system",
              content:
                "You are a relevance scoring system. Output only valid JSON arrays of numbers.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0,
          max_tokens: 500,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Rerank API 请求失败 [${response.status}]`);
      }

      const data = (await response.json()) as {
        choices: Array<{ message: { content: string } }>;
      };
      const content = data.choices[0]?.message?.content || "[]";

      // 解析 JSON 数组
      const scores = parseJSONScores(content, documents.length);

      return scores.map((score, index) => ({ index, score }));
    } finally {
      clearTimeout(timeout);
    }
  }
}

/** 安全解析 JSON 分数 */
function parseJSONScores(content: string, expectedLength: number): number[] {
  try {
    // 尝试提取 JSON 数组
    const match = content.match(/\[[\d.,\s]+\]/);
    if (match) {
      const scores: number[] = JSON.parse(match[0]);
      // 确保长度匹配
      while (scores.length < expectedLength) scores.push(0);
      return scores.slice(0, expectedLength);
    }
  } catch {
    // 解析失败，返回默认分数
  }
  return Array(expectedLength).fill(0.5);
}
