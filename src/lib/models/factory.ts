/**
 * 模型工厂
 * 根据配置动态选择本地模型或远程 API 调用
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
    embeddingModel = new LocalEmbeddingModel(config.ollamaEmbeddingModel);
  } else {
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
    rerankModel = new LocalRerankModel(config.ollamaRerankModel);
  } else if (source === "remote" && config.rerankModel) {
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
    // 使用空文本测试
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
