/**
 * LiteRAG 配置管理
 * 从环境变量读取所有配置，提供类型安全的访问接口
 */
import type { ModelSource } from "@/types";

class Config {
  /** 模型调用模式 */
  get modelSource(): ModelSource {
    return (process.env.MODEL_SOURCE as ModelSource) || "remote";
  }

  /** OpenAI 兼容 API 地址 */
  get openaiBaseUrl(): string {
    return process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  }

  /** OpenAI API 密钥 */
  get openaiApiKey(): string {
    return process.env.OPENAI_API_KEY || "";
  }

  /** Embedding 模型名称 */
  get embeddingModel(): string {
    return process.env.EMBEDDING_MODEL || "text-embedding-ada-002";
  }

  /** Rerank 模型名称 */
  get rerankModel(): string {
    return process.env.RERANK_MODEL || "";
  }

  /** Ollama 服务地址 */
  get ollamaHost(): string {
    return process.env.OLLAMA_HOST || "http://localhost:11434";
  }

  /** Ollama Embedding 模型 */
  get ollamaEmbeddingModel(): string {
    return process.env.OLLAMA_EMBEDDING_MODEL || "bge-large:latest";
  }

  /** Ollama Rerank 模型 */
  get ollamaRerankModel(): string {
    return process.env.OLLAMA_RERANK_MODEL || "";
  }

  /** LM Studio 服务地址（OpenAI 兼容 API） */
  get lmstudioHost(): string {
    return process.env.LMSTUDIO_HOST || "http://localhost:1234/v1";
  }

  /** LM Studio Embedding 模型（取决于 LM Studio 中加载的模型） */
  get lmstudioEmbeddingModel(): string {
    return process.env.LMSTUDIO_EMBEDDING_MODEL || "text-embedding-nomic-embed-text-v1.5";
  }

  /** LM Studio Rerank 模型（通过 Chat API 评分实现） */
  get lmstudioRerankModel(): string {
    return process.env.LMSTUDIO_RERANK_MODEL || "";
  }

  /** 数据库文件路径 */
  get databasePath(): string {
    return process.env.DATABASE_PATH || "./data/literag.db";
  }

  /** 默认 TopK */
  get defaultTopK(): number {
    return Number(process.env.DEFAULT_TOP_K) || 5;
  }

  /** 默认启用混合检索 */
  get defaultHybridSearch(): boolean {
    return process.env.DEFAULT_HYBRID_SEARCH !== "false";
  }

  /** 默认启用 Rerank */
  get defaultRerank(): boolean {
    return process.env.DEFAULT_RERANK !== "false";
  }

  /** 分块大小 */
  get chunkSize(): number {
    return Number(process.env.CHUNK_SIZE) || 512;
  }

  /** 分块重叠大小 */
  get chunkOverlap(): number {
    return Number(process.env.CHUNK_OVERLAP) || 128;
  }

  /** 向量维度（固定 1536） */
  get vectorDimensions(): number {
    return 1536;
  }

  /** 是否使用 WAL 模式 */
  get useWAL(): boolean {
    return true;
  }

  /** 数据库 busy timeout (ms) */
  get busyTimeout(): number {
    return 5000;
  }
}

/** 全局单例配置 */
export const config = new Config();
