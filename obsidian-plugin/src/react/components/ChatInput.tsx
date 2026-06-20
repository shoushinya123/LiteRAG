// ============================================================
// ChatInput.tsx — 聊天输入框（支持文件/文件夹引用 + 模式切换抽屉）
// ============================================================
import { useState, useRef } from "react";
import type { App as ObsidianApp } from "obsidian";
import type { FileContext, FolderContext, ChatMode } from "../types";
import { FilePicker } from "./FilePicker";
import { FolderPicker } from "./FolderPicker";
import { ModeDrawer } from "./ModeDrawer";

interface Props {
  app: ObsidianApp;
  mode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
  onSend: (text: string, fileContexts: FileContext[], folderContexts: FolderContext[]) => void;
  disabled: boolean;
}

export function ChatInput({ app, mode, onModeChange, onSend, disabled }: Props) {
  const [input, setInput] = useState("");
  const [fileContexts, setFileContexts] = useState<FileContext[]>([]);
  const [folderContexts, setFolderContexts] = useState<FolderContext[]>([]);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [showModeDrawer, setShowModeDrawer] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if (!input.trim() || disabled) return;
    onSend(input.trim(), fileContexts, folderContexts);
    setInput("");
    setFileContexts([]);
    setFolderContexts([]);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /** 添加单个文件引用 */
  const addFileContext = async (file: { name: string; path: string }) => {
    if (fileContexts.some((fc) => fc.path === file.path)) return;
    try {
      const content = await app.vault.adapter.read(file.path);
      setFileContexts((prev) => [
        ...prev,
        { path: file.path, name: file.name, content },
      ]);
    } catch (err) {
      console.error("[小夏] 读取文件失败:", err);
    }
  };

  /** 添加文件夹引用 — 遍历所有 .md 文件 */
  const addFolderContext = async (folder: { name: string; path: string }) => {
    if (folderContexts.some((fc) => fc.folderPath === folder.path)) return;
    try {
      const files = app.vault.getMarkdownFiles();
      const folderFiles = files.filter(
        (f) => f.path === folder.path || f.path.startsWith(folder.path + "/")
      );
      const fileContexts: FileContext[] = [];
      for (const f of folderFiles) {
        try {
          const content = await app.vault.read(f);
          fileContexts.push({ path: f.path, name: f.basename, content });
        } catch {
          // skip unreadable files
        }
      }
      setFolderContexts((prev) => [
        ...prev,
        { folderPath: folder.path, folderName: folder.name, files: fileContexts },
      ]);
    } catch (err) {
      console.error("[小夏] 读取文件夹失败:", err);
    }
  };

  const removeFileContext = (path: string) => {
    setFileContexts((prev) => prev.filter((fc) => fc.path !== path));
  };

  const removeFolderContext = (folderPath: string) => {
    setFolderContexts((prev) => prev.filter((fc) => fc.folderPath !== folderPath));
  };

  // 自动调整高度
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 180) + "px";
  };

  const hasContext = fileContexts.length > 0 || folderContexts.length > 0;

  const modeLabel = mode === "ark" ? "💬 ARK" : "🤖 Agent";
  const modeColor = mode === "ark" ? "#8b5cf6" : "#f59e0b";

  return (
    <div className="literag-input-area">
      {/* 模式抽屉 */}
      {showModeDrawer && (
        <ModeDrawer
          mode={mode}
          onSelect={onModeChange}
          onClose={() => setShowModeDrawer(false)}
        />
      )}

      {/* 已引用的文件和文件夹芯片 */}
      {hasContext && (
        <div className="literag-context-bar">
          {/* 文件芯片 */}
          {fileContexts.map((fc) => (
            <span key={fc.path} className="literag-context-chip" title={fc.path}>
              <span>📄</span>
              <span className="literag-context-chip-name">{fc.name}</span>
              <span
                className="literag-context-chip-remove"
                onClick={() => removeFileContext(fc.path)}
              >
                ×
              </span>
            </span>
          ))}
          {/* 文件夹芯片 */}
          {folderContexts.map((fc) => (
            <span key={fc.folderPath} className="literag-folder-chip" title={fc.folderPath}>
              <span>📁</span>
              <span className="literag-context-chip-name">{fc.folderName}</span>
              <span className="literag-folder-chip-count">
                ({fc.files.length} 篇)
              </span>
              <span
                className="literag-context-chip-remove"
                onClick={() => removeFolderContext(fc.folderPath)}
              >
                ×
              </span>
            </span>
          ))}
        </div>
      )}

      {/* 输入行 */}
      <div className="literag-input-row" style={{ position: "relative" }}>
        {/* 文件选择器弹出层 */}
        {showFilePicker && (
          <FilePicker
            app={app}
            onSelect={addFileContext}
            onClose={() => setShowFilePicker(false)}
          />
        )}
        {/* 文件夹选择器弹出层 */}
        {showFolderPicker && (
          <FolderPicker
            app={app}
            onSelect={addFolderContext}
            onClose={() => setShowFolderPicker(false)}
          />
        )}

        <textarea
          ref={textareaRef}
          className="literag-input"
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={
            hasContext
              ? "基于引用的内容提问，或发送修改指令..."
              : "输入问题，或 📎 引用文件/文件夹..."
          }
          rows={1}
          disabled={disabled}
          style={{ minHeight: 38, height: "auto" }}
        />
        <button
          className="literag-send-btn"
          onClick={handleSend}
          disabled={disabled || !input.trim()}
          title="发送 (Enter)"
        >
          ↑
        </button>
      </div>

      {/* 底部工具栏 */}
      <div className="literag-input-footer">
        <div className="literag-input-toolbar-left">
          {/* 模式切换按钮 */}
          <button
            className="literag-mode-toggle-btn"
            onClick={() => setShowModeDrawer(!showModeDrawer)}
            disabled={disabled}
            title="切换对话模式（ARK / Agent）"
            style={{ borderColor: modeColor }}
          >
            <span className="literag-mode-toggle-icon" style={{ color: modeColor }}>
              {mode === "ark" ? "💬" : "🤖"}
            </span>
            <span className="literag-mode-toggle-label" style={{ color: modeColor }}>
              {mode === "ark" ? "ARK" : "Agent"}
            </span>
          </button>

          <button
            className="literag-context-add-btn"
            onClick={() => setShowFilePicker(!showFilePicker)}
            disabled={disabled}
            title="引用笔记文件到上下文"
          >
            📎 文件
          </button>
          <button
            className="literag-context-add-btn"
            onClick={() => setShowFolderPicker(!showFolderPicker)}
            disabled={disabled}
            title="引用整个文件夹到上下文（自动遍历所有 .md 文件）"
          >
            📁 文件夹
          </button>
        </div>
        <span className="literag-input-hint">Enter 发送 · Shift+Enter 换行</span>
      </div>
    </div>
  );
}
