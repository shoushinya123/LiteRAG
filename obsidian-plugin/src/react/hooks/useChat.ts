// ============================================================
// useChat — 聊天状态管理 Hook（支持 ARK/Agent 双模式 + 文件夹引用 + 智能编辑）
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
  autoApplyFileEdits: boolean;
  onWriteFile?: (path: string, content: string) => Promise<void>;
}

/** 检测是否是文件编辑指令（改进版 - 支持更多模式） */
function detectEditIntent(
  input: string,
  allFileContexts: FileContext[]
): { targetPath: string; targetName: string; editType: "modify" | "create" | "append" } | null {
  const text = input.trim();

  // 模式1：明确指定文件名 + 编辑动作
  const patterns = [
    // "修改/编辑/更新 XXX 文件，把...改成..."
    { regex: /(?:修改|编辑|更新|改|重写|优化)\s*[:：]?\s*["「]?([^"」]+?)["」]?\s*(?:文件|笔记)?\s*[,，]/, type: "modify" as const },
    // "把 XXX 文件中的 YYY 改成 ZZZ"
    { regex: /把\s*["「]?([^"」]+?)["」]?\s*(?:文件|笔记)?\s*[,，]/, type: "modify" as const },
    // "在 XXX 文件里添加/插入..."
    { regex: /在\s*["「]?([^"」]+?)["」]?\s*(?:文件|笔记)?\s*里?\s*(?:添加|插入|写入|写)/, type: "append" as const },
    // "创建/新建/生成 XXX 文件"
    { regex: /(?:创建|新建|生成|写)\s*[:：]?\s*["「]?([^"」]+?\.md)["」]?\s*/, type: "create" as const },
    // "帮我写 XXX"
    { regex: /帮我\s*(?:写|创建|新建)\s*["「]?([^"」]+?\.md)["」]?/, type: "create" as const },
  ];

  for (const p of patterns) {
    const m = text.match(p.regex);
    if (m) {
      const targetName = m[1].trim().replace(/\.md$/, "");
      // 在已引用的文件中查找
      const matched = allFileContexts.find(
        (fc) =>
          fc.name.toLowerCase() === targetName.toLowerCase() ||
          fc.name.toLowerCase().includes(targetName.toLowerCase()) ||
          fc.path.toLowerCase().includes(targetName.toLowerCase())
      );
      if (matched) return { targetPath: matched.path, targetName: matched.name, editType: p.type };
    }
  }

  // 模式2：只有一个引用文件时，检测编辑关键词
  if (allFileContexts.length === 1) {
    const editKeywords = ["修改", "编辑", "更新", "改", "重写", "优化", "添加", "插入", "删除", "改", "修正", "改进"];
    const hasEditKeyword = editKeywords.some((kw) => text.includes(kw));
    if (hasEditKeyword) {
      return { targetPath: allFileContexts[0].path, targetName: allFileContexts[0].name, editType: "modify" };
    }
  }

  // 模式3：输入以"修改/编辑/更新"开头，尝试从上下文找文件
  const startsWithEdit = /^(?:修改|编辑|更新|改|重写|优化)\s/.test(text);
  if (startsWithEdit && allFileContexts.length > 0) {
    // 取第一个文件作为目标
    return { targetPath: allFileContexts[0].path, targetName: allFileContexts[0].name, editType: "modify" };
  }

  return null;
}

/** 从 LLM 回复中提取文件编辑建议（改进版） */
function extractFileEditFromResponse(
  content: string,
  targetPath: string,
  description: string
): FileEditSuggestion | null {
  // 优先提取 markdown 代码块
  const fenceMatch = content.match(/```(?:markdown|md)?\n([\s\S]+?)```/);
  if (fenceMatch) {
    return { targetPath, newContent: fenceMatch[1].trim(), description };
  }

  // 尝试提取 <file> 标签内容（如果有结构化输出）
  const fileTagMatch = content.match(/<file(?:\s+path=["']?([^"'\s>]+)["']?)?>([\s\S]+?)<\/file>/);
  if (fileTagMatch) {
    const path = fileTagMatch[1] || targetPath;
    return { targetPath: path, newContent: fileTagMatch[2].trim(), description };
  }

  // 如果回复较长且不包含"建议/可以/你可以"等提示性语言，认为是直接修改内容
  const suggestiveWords = ["建议", "你可以", "可以考虑", "或许", "不妨"];
  const hasSuggestive = suggestiveWords.some((w) => content.includes(w));
  if (content.length > 50 && !hasSuggestive) {
    return { targetPath, newContent: content.trim(), description };
  }

  return null;
}

/** 将文件夹上下文展开为文件上下文列表 */
function flattenFolderContexts(folderContexts: FolderContext[]): FileContext[] {
  return folderContexts.flatMap((fc) => fc.files);
}

export function useChat(options: UseChatOptions) {
  const { mode, liteRAG, llm, provider, topK, useHybridSearch, useRerank, autoApplyFileEdits, onWriteFile } = options;

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
        // 文件编辑模式 - 改进的系统提示
        const fileContent = allFileContexts.find(
          (fc) => fc.path === editIntent.targetPath
        )?.content || "";

        systemContent =
          "你是一个专业的 Markdown 文件编辑助手。\n" +
          "## 任务\n" +
          "用户会提供一份 Markdown 文件的内容和修改要求。请按照要求修改文件，并输出完整的新文件内容。\n" +
          "## 输出格式\n" +
          "1. 用 ```markdown 代码块包裹修改后的完整内容\n" +
          "2. 不要输出额外的解释文字（除非用户明确要求）\n" +
          "3. 保持原文件的 frontmatter（如果有）\n" +
          "4. 修改要精准，不要改变不相关的内容\n" +
          `## 目标文件：${editIntent.targetName}.md (${editIntent.editType})`;
        userContent =
          `## 当前文件内容\n\n${fileContent}\n\n` +
          `## 修改要求\n\n${userInput.trim()}\n\n请输出修改后的完整文件内容（` +
          (autoApplyFileEdits ? "将自动应用修改" : "请确认后应用") +
          "）。";
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

        const folderNote = folderContexts.length > 0
          ? `\n\n注意：用户还引用了 ${folderContexts.length} 个文件夹，共 ${allFileContexts.length} 篇笔记。请综合所有引用内容回答。`
          : "";

        systemContent =
          "你是一个 Obsidian 笔记助手。请基于用户提供的文件内容回答问题，优先引用文件中的内容并注明来源。" + folderNote;
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
        let shouldAutoApply = false;

        if (editIntent) {
          fileEdit =
            extractFileEditFromResponse(
              llmRes.content,
              editIntent.targetPath,
              `对 ${editIntent.targetName} 进行修改`
            ) || undefined;

          // 如果开启了自动应用，直接写入文件
          if (fileEdit && autoApplyFileEdits && onWriteFile) {
            try {
              await onWriteFile(fileEdit.targetPath, fileEdit.newContent);
              shouldAutoApply = true;
            } catch (err) {
              console.error("[小夏] 自动应用文件修改失败:", err);
              // 失败的话还是显示确认卡片
            }
          }
        }

        const assistantMsg: UIMessage = {
          id: nextId(),
          role: "assistant",
          content: shouldAutoApply
            ? `✅ 已自动修改 **${editIntent!.targetName}** 文件。${llmRes.content.includes("```") ? "\n\n" + llmRes.content : ""}`
            : fileEdit
            ? `已根据你的要求生成了 **${editIntent!.targetName}** 的修改内容${autoApplyFileEdits ? "（自动应用已开启但本次需要确认）" : "，请确认后写入"}：`
            : llmRes.content,
          timestamp: Date.now(),
          ragSources: ragResults.length > 0 ? ragResults : undefined,
          ragSkipped: didRagSkip || undefined,
          fileEdit: (!shouldAutoApply && fileEdit) ? fileEdit : undefined,
        };

        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        setError((err as Error).message);
        console.error("[LLM] 调用失败:", err);
      }
      setIsGenerating(false);
    },
    [mode, liteRAG, llm, provider, topK, useHybridSearch, useRerank, autoApplyFileEdits, nextId]
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
