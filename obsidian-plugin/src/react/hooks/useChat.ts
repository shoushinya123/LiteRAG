// ============================================================
// useChat — 聊天状态管理 Hook（支持 ARK/Agent 双模式 + 文件夹引用）
// ============================================================
import { useState, useCallback, useRef } from "react";
import type { UIMessage, RAGResult, FileContext, FolderContext, FileEditSuggestion, ChatMode } from "../types";
import type { LiteRAGClient } from "../../services/LiteRAGClient";
import type { LLMClient } from "../../services/LLMClient";
import { contextBuilder } from "../../services/ContextBuilder";

interface UseChatOptions {
  mode: ChatMode;
  liteRAG: LiteRAGClient;
  llm: LLMClient;
  provider: "deepseek" | "openai";
  topK: number;
  useHybridSearch: boolean;
  useRerank: boolean;
  onWriteFile?: (path: string, content: string) => Promise<void>;
}

/** 检测是否是文件编辑指令 */
function detectEditIntent(
  input: string,
  allFileContexts: FileContext[]
): { targetPath: string; targetName: string } | null {
  const editPatterns = [
    /修改(?:文件|笔记)?[「「"']?(.+?)[」」"']?[，,](.+)/,
    /帮我改(?:一下)?[「「"']?(.+?)[」」"']?[，,](.+)/,
    /更新[「「"']?(.+?)[」」"']?[，,](.+)/,
    /编辑[「「"']?(.+?)[」」"']?[，,](.+)/,
  ];
  for (const pat of editPatterns) {
    const m = input.match(pat);
    if (m) {
      const targetName = m[1].trim().replace(/\.md$/, "");
      const matched = allFileContexts.find(
        (fc) =>
          fc.name.toLowerCase() === targetName.toLowerCase() ||
          fc.path.toLowerCase().includes(targetName.toLowerCase())
      );
      if (matched) return { targetPath: matched.path, targetName: matched.name };
    }
  }
  if (
    allFileContexts.length === 1 &&
    /修改|编辑|更新|改|重写|优化/.test(input)
  ) {
    return { targetPath: allFileContexts[0].path, targetName: allFileContexts[0].name };
  }
  return null;
}

/** 从 LLM 回复中提取文件编辑建议 */
function extractFileEditFromResponse(
  content: string,
  targetPath: string,
  description: string
): FileEditSuggestion | null {
  const fenceMatch = content.match(/```(?:markdown|md)?\n([\s\S]+?)```/);
  if (fenceMatch) {
    return { targetPath, newContent: fenceMatch[1], description };
  }
  if (content.length > 50 && !content.includes("建议") && !content.includes("可以考虑")) {
    return { targetPath, newContent: content, description };
  }
  return null;
}

/** 将文件夹上下文展开为文件上下文列表 */
function flattenFolderContexts(folderContexts: FolderContext[]): FileContext[] {
  return folderContexts.flatMap((fc) => fc.files);
}

export function useChat(options: UseChatOptions) {
  const { mode, liteRAG, llm, provider, topK, useHybridSearch, useRerank, onWriteFile } = options;

  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ragSkipped, setRagSkipped] = useState(false);
  const messageIdRef = useRef(0);

  const nextId = useCallback(() => {
    messageIdRef.current += 1;
    return `msg_${messageIdRef.current}`;
  }, []);

  const sendMessage = useCallback(
    async (
      userInput: string,
      fileContexts: FileContext[] = [],
      folderContexts: FolderContext[] = []
    ) => {
      if (!userInput.trim()) return;
      setError(null);
      setRagSkipped(false);

      // 将文件夹上下文展开为文件列表
      const folderFiles = flattenFolderContexts(folderContexts);
      const allFileContexts = [...fileContexts, ...folderFiles];

      // 检测是否是文件编辑指令
      const editIntent = detectEditIntent(userInput, allFileContexts);

      // 添加用户消息
      const userMsg: UIMessage = {
        id: nextId(),
        role: "user",
        content: userInput.trim(),
        timestamp: Date.now(),
        fileContexts: allFileContexts.length > 0 ? allFileContexts : undefined,
      };
      setMessages((prev) => [...prev, userMsg]);

      // 根据模式决定是否 RAG 检索
      let ragResults: RAGResult[] = [];
      let didRagSkip = false;

      if (mode === "agent" && !editIntent) {
        setIsSearching(true);
        try {
          const ragRes = await liteRAG.search(
            userInput.trim(),
            topK,
            useHybridSearch,
            useRerank
          );
          ragResults = ragRes.results || [];
        } catch (err) {
          console.warn("[小夏 Agent] LiteRAG 未连接，已跳过 RAG 检索，直接回复");
          didRagSkip = true;
        }
        setIsSearching(false);
      }

      if (didRagSkip) setRagSkipped(true);

      // 构造 LLM messages
      setIsGenerating(true);

      let systemContent = "";
      let userContent = userInput.trim();

      if (editIntent) {
        // 文件编辑模式
        const fileContent = allFileContexts.find(
          (fc) => fc.path === editIntent.targetPath
        )?.content || "";

        systemContent =
          "你是一个 Markdown 文件编辑助手。用户会提供一份 Markdown 文件的内容，并给出修改要求。" +
          "请直接输出修改后的完整文件内容（用 ```markdown 代码块包裹），不要添加额外解释。";
        userContent =
          `## 文件内容（${editIntent.targetName}.md）\n\n${fileContent}\n\n` +
          `## 修改要求\n\n${userInput.trim()}`;
      } else if (allFileContexts.length > 0) {
        // 有文件/文件夹引用：把文件内容注入上下文
        const fileSection = allFileContexts
          .map((fc) => `### 📄 ${fc.name}\n\n${fc.content.slice(0, 2000)}`)
          .join("\n\n---\n\n");

        const ragSection =
          ragResults.length > 0
            ? ragResults
                .map((r, i) => `[${i + 1}] ${r.metadata.filePath || "笔记"}\n${r.text.slice(0, 300)}`)
                .join("\n\n")
            : "";

        // 如果有文件夹引用，在 system prompt 中说明
        const folderNote = folderContexts.length > 0
          ? `\n\n注意：用户还引用了 ${folderContexts.length} 个文件夹，共 ${allFileContexts.length} 篇笔记。`
          : "";

        systemContent =
          "你基于用户 Obsidian 笔记回答。优先引用用户提供的文件内容，标注来源。" + folderNote;
        userContent = fileSection + "\n\n---\n\n" + userInput.trim();
        if (ragSection) userContent += "\n\n## 知识库检索到的额外片段\n\n" + ragSection;
      } else if (mode === "agent" && ragResults.length > 0) {
        // Agent 模式无文件引用：用 RAG 结果
        const ragSection = ragResults
          .map((r, i) => `[${i + 1}] ${r.metadata.filePath || "笔记"}\n${r.text.slice(0, 400)}`)
          .join("\n\n");
        systemContent =
          "你是一个知识库助手。请根据以下检索到的笔记片段回答用户问题，并注明来源。";
        userContent = `## 知识库检索结果\n\n${ragSection}\n\n---\n\n${userInput.trim()}`;
      }

      const chatMessages = systemContent
        ? [
            { role: "system" as const, content: systemContent },
            { role: "user" as const, content: userContent },
          ]
        : contextBuilder.buildMessages(userInput.trim(), ragResults, provider);

      try {
        const llmRes = await llm.chat(chatMessages, userInput.trim());

        let fileEdit: FileEditSuggestion | undefined;
        if (editIntent) {
          fileEdit =
            extractFileEditFromResponse(
              llmRes.content,
              editIntent.targetPath,
              `对 ${editIntent.targetName} 进行修改`
            ) || undefined;
        }

        const assistantMsg: UIMessage = {
          id: nextId(),
          role: "assistant",
          content: fileEdit
            ? `已根据你的要求生成了 **${editIntent!.targetName}** 的修改内容，请确认后写入：`
            : llmRes.content,
          timestamp: Date.now(),
          ragSources: ragResults.length > 0 ? ragResults : undefined,
          ragSkipped: didRagSkip || undefined,
          fileEdit,
        };

        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        setError((err as Error).message);
        console.error("[LLM] 调用失败:", err);
      }
      setIsGenerating(false);
    },
    [mode, liteRAG, llm, provider, topK, useHybridSearch, useRerank, nextId]
  );

  const applyFileEdit = useCallback(
    async (id: string, suggestion: FileEditSuggestion) => {
      if (!onWriteFile) {
        setError("文件写入功能未初始化");
        return;
      }
      try {
        await onWriteFile(suggestion.targetPath, suggestion.newContent);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === id && m.fileEdit
              ? { ...m, fileEdit: { ...m.fileEdit, confirmed: true } }
              : m
          )
        );
      } catch (err) {
        setError(`写入文件失败: ${(err as Error).message}`);
      }
    },
    [onWriteFile]
  );

  const dismissFileEdit = useCallback((id: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, fileEdit: undefined } : m
      )
    );
  }, []);

  const editMessage = useCallback((id: string, newContent: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, isEditing: false, content: newContent } : m
      )
    );
  }, []);

  const markSaved = useCallback((id: string, savedPath: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, savedPath } : m))
    );
  }, []);

  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
    setRagSkipped(false);
    llm.clearCache();
  }, [llm]);

  return {
    messages,
    isSearching,
    isGenerating,
    error,
    ragSkipped,
    sendMessage,
    applyFileEdit,
    dismissFileEdit,
    editMessage,
    markSaved,
    clearChat,
  };
}
