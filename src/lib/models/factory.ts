/**
 * 模型工厂
 * 根据配置动态选择模型调用方式：
 * - local:    Ollama 本地模型
 * - remote:   OpenAI 兼容 API
 * - lmstudio: LM Studio 本地 OpenAI 兼容 API
 */
import { config } from "@/lib/utils/config";
import type { EmbeddingModel, RerankModel } from "@/types";
import { RemoteEmbeddingModel, RemoteRerankModel } from "./remote";
import { LocalEmbeddingModel, LocalRerankModel } from "./local";

let embeddingModel: EmbeddingModel | null = null;
let rerankModel: RerankModel | null = null;

/**
 * 获取 Embedding 模型实例（单例）
 */
export function getEmbeddingModel(): EmbeddingModel {
  if (embeddingModel) return embeddingModel;

  const source = config.modelSource;
  console.log(`[LiteRAG] 初始化 Embedding 模型 (${source})`);

  if (source === "local") {
    // Ollama 本地模型
    embeddingModel = new LocalEmbeddingModel(config.ollamaEmbeddingModel);
  } else if (source === "lmstudio") {
    // LM Studio 本地 OpenAI 兼容 API
    embeddingModel = new RemoteEmbeddingModel(
      config.lmstudioEmbeddingModel,
      config.lmstudioHost,
      "" // LM Studio 本地不需要 API key
    );
  } else {
    // 远程 OpenAI 兼容 API
    embeddingModel = new RemoteEmbeddingModel(
      config.embeddingModel,
      config.openaiBaseUrl,
      config.openaiApiKey
    );
  }

  return embeddingModel;
}

/**
 * 获取 Rerank 模型实例（单例）
 */
export function getRerankModel(): RerankModel | null {
  if (rerankModel) return rerankModel;

  const source = config.modelSource;

  if (source === "local" && config.ollamaRerankModel) {
    // Ollama 本地 Rerank（通过 Chat API 评分）
    rerankModel = new LocalRerankModel(config.ollamaRerankModel);
  } else if (source === "lmstudio" && config.lmstudioRerankModel) {
    // LM Studio 本地 Rerank（通过 Chat API 评分）
    rerankModel = new RemoteRerankModel(
      config.lmstudioRerankModel,
      config.lmstudioHost,
      "" // LM Studio 本地不需要 API key
    );
  } else if (source === "remote" && config.rerankModel) {
    // 远程 OpenAI Rerank
    rerankModel = new RemoteRerankModel(
      config.rerankModel,
      config.openaiBaseUrl,
      config.openaiApiKey
    );
  }

  return rerankModel;
}

/**
 * 重置模型实例（用于配置变更后重新初始化）
 */
export function resetModels(): void {
  embeddingModel = null;
  rerankModel = null;
}

/**
 * 检查模型服务可用性
 */
export async function checkModelAvailability(): Promise<{
  embedding: boolean;
  rerank: boolean;
}> {
  try {
    const embed = getEmbeddingModel();
    const result = await embed.embedSingle("test");
    const embeddingOk = result.length === config.vectorDimensions;

    let rerankOk = false;
    const reranker = getRerankModel();
    if (reranker) {
      try {
        await reranker.rerank("test", ["test document"]);
        rerankOk = true;
      } catch {
        rerankOk = false;
      }
    }

    return { embedding: embeddingOk, rerank: rerankOk };
  } catch {
    return { embedding: false, rerank: false };
  }
}
