// ============================================================
// App.tsx — 小夏同学Lite React 根组件
// ============================================================
import { useState, useCallback } from "react";
import { useChat } from "./hooks/useChat";
import { MessageList } from "./components/MessageList";
import { ChatInput } from "./components/ChatInput";
import { StatusBar } from "./components/StatusBar";
import type { LiteRAGClient } from "../services/LiteRAGClient";
import type { LLMClient } from "../services/LLMClient";
import type { NoteWriter } from "../services/NoteWriter";
import type { LiteRAGCopilotSettings, FileEditSuggestion, FileContext, FolderContext, ChatMode } from "./types";
import type { App as ObsidianApp } from "obsidian";
import "./components/styles.css";

interface AppProps {
  app: ObsidianApp;
  liteRAG: LiteRAGClient;
  llm: LLMClient;
  noteWriter: NoteWriter;
  settings: LiteRAGCopilotSettings;
  onSettingsChange: () => Promise<void>;
  onWriteFile: (path: string, content: string) => Promise<void>;
}

export function App({ app, liteRAG, llm, noteWriter, settings, onSettingsChange, onWriteFile }: AppProps) {
  // 模式状态（从 settings 初始化，切换时写回 settings）
  const [chatMode, setChatMode] = useState<ChatMode>(settings.chatMode || "agent");

  const handleModeChange = useCallback(async (mode: ChatMode) => {
    setChatMode(mode);
    settings.chatMode = mode;
    await onSettingsChange();
  }, [settings, onSettingsChange]);

  const {
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
  } = useChat({
    mode: chatMode,
    liteRAG,
    llm,
    provider: settings.llmProvider,
    topK: settings.topK,
    useHybridSearch: settings.useHybridSearch,
    useRerank: settings.useRerank,
    onWriteFile,
    autoApplyFileEdits: settings.autoApplyFileEdits || false,
  });

  const handleSave = async (id: string, content: string, title?: string) => {
    try {
      const path = await noteWriter.save(content, title);
      markSaved(id, path);
    } catch (err) {
      console.error("[小夏] 保存失败:", err);
    }
  };

  const handleApplyFileEdit = async (id: string, suggestion: FileEditSuggestion) => {
    await applyFileEdit(id, suggestion);
  };

  const handleSend = (text: string, fileContexts: FileContext[], folderContexts: FolderContext[]) => {
    sendMessage(text, fileContexts, folderContexts);
  };

  const model =
    settings.llmProvider === "deepseek"
      ? settings.deepseekModel
      : settings.openaiModel;

  return (
    <div className="literag-app">
      {/* 顶部状态栏（含模式切换） */}
      <StatusBar
        mode={chatMode}
        onModeChange={handleModeChange}
        liteRAGUrl={settings.liteRAGUrl}
        provider={settings.llmProvider}
        model={model}
        onClear={clearChat}
        hasMessages={messages.length > 0}
      />

      {/* 消息列表 */}
      <MessageList
        messages={messages}
        onEdit={editMessage}
        onSave={handleSave}
        onApplyFileEdit={handleApplyFileEdit}
        onDismissFileEdit={dismissFileEdit}
      />

      {/* 加载状态 */}
      {(isSearching || isGenerating) && (
        <div className="literag-messages" style={{ padding: "0 12px", flex: "none" }}>
          <div className="literag-message-row">
            <div className="literag-avatar literag-avatar-ai">🌸</div>
            <div className="literag-thinking">
              <div className="literag-thinking-dots">
                <span /><span /><span />
              </div>
              {isSearching ? "正在检索知识库..." : "正在生成回答..."}
            </div>
          </div>
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="literag-error-banner">
          ❌ {error}
        </div>
      )}

      {/* 输入框 */}
      <ChatInput
        app={app}
        onSend={handleSend}
        disabled={isSearching || isGenerating}
      />
    </div>
  );
}
