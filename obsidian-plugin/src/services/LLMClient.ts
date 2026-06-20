// ============================================================
// LLMClient — DeepSeek / OpenAI 兼容 LLM 调用
// DeepSeek 优化：
//   1. 查询结果缓存 (LRU) — 相同 query 直接返回缓存
//   2. System prompt 精简 — DeepSeek 对长 system prompt 有 token 上限
//   3. 温度冻结 — RAG 场景设为 0，确保输出一致
//   4. 最大 token 限定 — 避免长文回复消耗过多
// ============================================================
import type { LLMProvider, LLMResponse, ChatMessage } from "../react/types";

/** LLM 完成请求 */
interface LLMRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: false;
}

/** 查询缓存 LRU */
class QueryCache {
  private cache = new Map<string, { response: LLMResponse; timestamp: number }>();
  private maxSize: number;

  constructor(maxSize = 100) {
    this.maxSize = maxSize;
  }

  get(query: string): LLMResponse | null {
    const key = this.hashQuery(query);
    const entry = this.cache.get(key);
    if (entry) return entry.response;
    return null;
  }

  set(query: string, response: LLMResponse): void {
    const key = this.hashQuery(query);
    // LRU 淘汰
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, { response, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }

  /** 简单 hash：取 query 前 200 字符 + 长度 */
  private hashQuery(query: string): string {
    const short = query.slice(0, 200).trim().toLowerCase();
    return `${short}|${query.length}`;
  }
}

export class LLMClient {
  private provider: LLMProvider;
  private openaiBaseUrl: string;
  private openaiApiKey: string;
  private openaiModel: string;
  private deepseekBaseUrl: string;
  private deepseekApiKey: string;
  private deepseekModel: string;
  private queryCache: QueryCache;

  constructor(config: {
    provider: LLMProvider;
    openaiBaseUrl: string;
    openaiApiKey: string;
    openaiModel: string;
    deepseekBaseUrl: string;
    deepseekApiKey: string;
    deepseekModel: string;
    maxCacheEntries?: number;
  }) {
    this.provider = config.provider;
    this.openaiBaseUrl = config.openaiBaseUrl;
    this.openaiApiKey = config.openaiApiKey;
    this.openaiModel = config.openaiModel;
    this.deepseekBaseUrl = config.deepseekBaseUrl;
    this.deepseekApiKey = config.deepseekApiKey;
    this.deepseekModel = config.deepseekModel;
    this.queryCache = new QueryCache(config.maxCacheEntries || 100);
  }

  /** 聊天（带缓存） */
  async chat(
    messages: ChatMessage[],
    queryHash?: string
  ): Promise<LLMResponse> {
    // 检查缓存（仅命中 RAG 检索后的上下文对话）
    if (queryHash) {
      const cached = this.queryCache.get(queryHash);
      if (cached) return cached;
    }

    const config = this.getConfig();
    const response = await this.callAPI(config, messages);

    // 写入缓存
    if (queryHash) {
      this.queryCache.set(queryHash, response);
    }

    return response;
  }

  /** 获取当前提供商的配置 */
  private getConfig() {
    if (this.provider === "deepseek") {
      return {
        baseUrl: this.deepseekBaseUrl,
        apiKey: this.deepseekApiKey,
        model: this.deepseekModel,
        temperature: 0, // DeepSeek RAG 场景默认 0
        maxTokens: 2048,
        topP: 0.9,
      };
    }
    return {
      baseUrl: this.openaiBaseUrl,
      apiKey: this.openaiApiKey,
      model: this.openaiModel,
      temperature: 0.3,
      maxTokens: 2048,
      topP: 1,
    };
  }

  /** 调用 OpenAI 兼容 API */
  private async callAPI(
    config: ReturnType<typeof this.getConfig>,
    messages: ChatMessage[]
  ): Promise<LLMResponse> {
    // DeepSeek 优化：trim system prompt 到前 2000 字符
    const processedMessages = this.provider === "deepseek"
      ? this.optimizeForDeepSeek(messages)
      : messages;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    try {
      const res = await fetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: processedMessages,
          temperature: config.temperature,
          max_tokens: config.maxTokens,
          top_p: config.topP,
          stream: false,
        } satisfies LLMRequest),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`LLM 调用失败 [${res.status}]: ${err.slice(0, 300)}`);
      }

      const data = (await res.json()) as {
        choices: Array<{ message: { content: string } }>;
        model: string;
        usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      };

      return {
        content: data.choices[0]?.message?.content || "",
        model: data.model || config.model,
        usage: data.usage,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  /** DeepSeek 专用优化 */
  private optimizeForDeepSeek(messages: ChatMessage[]): ChatMessage[] {
    return messages.map((msg) => {
      if (msg.role === "system") {
        // DeepSeek 对长 system prompt 处理效率较低
        // 只保留前 2000 字符，后面截断
        // 但保留完整的文档引用格式
        if (msg.content.length > 2000) {
          const lines = msg.content.split("\n");
          let accumulated = "";
          const kept: string[] = [];

          for (const line of lines) {
            if (accumulated.length + line.length > 2000) break;
            kept.push(line);
            accumulated += line + "\n";
          }

          return {
            ...msg,
            content: kept.join("\n") + "\n\n(内容过长，已截断以优化响应速度)",
          };
        }
      }
      return msg;
    });
  }

  /** 更新提供商 */
  setProvider(provider: LLMProvider): void {
    this.provider = provider;
    this.queryCache.clear();
  }

  /** 清空缓存 */
  clearCache(): void {
    this.queryCache.clear();
  }
}
