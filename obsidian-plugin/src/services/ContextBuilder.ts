// ============================================================
// ContextBuilder — 将 RAG 检索结果构造为 LLM 上下文
// DeepSeek 优化：使用精简的 system prompt 模板
// ============================================================
import type { RAGResult, ChatMessage } from "../react/types";

export class ContextBuilder {
  /**
   * 构造 LLM messages（含 RAG 上下文注入）
   * @param userQuery 用户原始问题
   * @param ragResults RAG 检索结果
   * @param provider LLM 提供商（deepseek 用精简 prompt）
   */
  buildMessages(
    userQuery: string,
    ragResults: RAGResult[],
    provider: "deepseek" | "openai" = "deepseek"
  ): ChatMessage[] {
    const systemPrompt = this.buildSystemPrompt(ragResults, provider);

    return [
      { role: "system", content: systemPrompt },
      { role: "user", content: userQuery },
    ];
  }

  /** 构造 system prompt */
  private buildSystemPrompt(ragResults: RAGResult[], provider: string): string {
    if (ragResults.length === 0) {
      return provider === "deepseek"
        ? "你是一个知识库助手。用户的问题与现有笔记不相关，请根据你的知识回答，并说明此回答并非来自用户的笔记。"
        : "你是基于用户 Obsidian 笔记的知识库助手。未找到相关笔记，请根据你的知识诚实回答。";
    }

    if (provider === "deepseek") {
      return this.buildDeepSeekPrompt(ragResults);
    }
    return this.buildOpenAIPrompt(ragResults);
  }

  /** DeepSeek 精简 prompt（控制 token 消耗） */
  private buildDeepSeekPrompt(ragResults: RAGResult[]): string {
    const refs = ragResults
      .map((r, i) => {
        const source = r.metadata.filePath || "未知来源";
        const text = r.text.slice(0, 300); // 每条片段最多 300 字
        return `[${i + 1}] ${source}\n${text}${r.text.length > 300 ? "..." : ""}`;
      })
      .join("\n\n");

    return [
      "你基于用户 Obsidian 笔记回答。规则：",
      "1. 优先引用笔记内容，标注来源文件",
      "2. 笔记未覆盖时，基于你的知识补充并注明",
      "3. 回答简洁，关键信息前置",
      "",
      "## 相关笔记",
      refs,
    ].join("\n");
  }

  /** OpenAI 详细 prompt */
  private buildOpenAIPrompt(ragResults: RAGResult[]): string {
    const refs = ragResults
      .map((r, i) => {
        const source = r.metadata.filePath || "未知";
        const score = r.score.toFixed(2);
        return [
          `### [${i + 1}] ${source} (相关性: ${score})`,
          r.text.slice(0, 500),
          r.text.length > 500 ? "..." : "",
          "",
        ].join("\n");
      })
      .join("\n");

    return [
      "你是基于用户 Obsidian 个人知识库的 AI 助手。",
      "你的任务是：基于用户笔记中的内容回答用户的问题。",
      "",
      "原则：",
      "- 尽可能引用笔记原文，标注来源文件路径",
      "- 如果笔记中没有相关信息，请基于你的知识诚实回答并说明",
      "- 如果笔记信息不完整，可以结合笔记内容给出推断并标注",
      "",
      "## 检索到的相关笔记片段",
      refs,
      "请基于以上笔记内容回答用户的问题。",
    ].join("\n");
  }
}

export const contextBuilder = new ContextBuilder();
