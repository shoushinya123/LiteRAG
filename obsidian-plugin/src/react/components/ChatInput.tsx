// ============================================================
// ChatInput.tsx — 聊天输入框（支持 @ 提及文件/文件夹 + 上下文引用）
// ============================================================
import { useState, useRef, useEffect, useCallback } from "react";
import type { App as ObsidianApp } from "obsidian";
import type { FileContext, FolderContext } from "../types";
import { FilePicker } from "./FilePicker";
import { FolderPicker } from "./FolderPicker";
import { MentionPopup } from "./MentionPopup";

interface Props {
  app: ObsidianApp;
  onSend: (text: string, fileContexts: FileContext[], folderContexts: FolderContext[]) => void;
  disabled: boolean;
}

export function ChatInput({ app, onSend, disabled }: Props) {
  const [input, setInput] = useState("");
  const [fileContexts, setFileContexts] = useState<FileContext[]>([]);
  const [folderContexts, setFolderContexts] = useState<FolderContext[]>([]);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [showMention, setShowMention] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputBeforeMention = useRef(""); // 存储 @ 之前的文本

  /** 检测 @ 提及触发 */
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;

    // 检查光标前是否有 @ 且 @ 前是空格或开头
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex >= 0) {
      const charBeforeAt = lastAtIndex === 0 ? ' ' : textBeforeCursor[lastAtIndex - 1];
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);

      // @ 在开头或前面是空格，且后面不是空格（正在输入提及）
      if ((lastAtIndex === 0 || charBeforeAt === ' ' || charBeforeAt === '\n') && !textAfterAt.includes(' ')) {
        setShowMention(true);
        setMentionFilter(textAfterAt);
        inputBeforeMention.current = textBeforeCursor.substring(0, lastAtIndex);
        setInput(value);
        autoResize(e.target);
        return;
      }
    }

    // 没有触发提及，确保弹出层关闭
    if (showMention) {
      setShowMention(false);
      setMentionFilter("");
    }

    setInput(value);
    autoResize(e.target);
  };

  /** 自动调整高度 */
  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 180) + "px";
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // @ 弹出层内的键盘事件由 MentionPopup 处理
    if (showMention) return;

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /** 选择文件（从 @ 提及或文件选择器） */
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

  /** 选择文件夹（从 @ 提及或文件夹选择器） */
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

  /** 从 @ 提及选择文件 */
  const handleMentionSelectFile = (file: { name: string; path: string }) => {
    addFileContext(file);
    // 恢复 @ 之前的文本，并移除 @ 提及部分
    setInput(inputBeforeMention.current);
    setShowMention(false);
    setMentionFilter("");
    textareaRef.current?.focus();
  };

  /** 从 @ 提及选择文件夹 */
  const handleMentionSelectFolder = (folder: { name: string; path: string; fileCount: number }) => {
    addFolderContext(folder);
    setInput(inputBeforeMention.current);
    setShowMention(false);
    setMentionFilter("");
    textareaRef.current?.focus();
  };

  /** 关闭 @ 提及弹出层 */
  const closeMention = () => {
    setShowMention(false);
    setMentionFilter("");
    // 恢复完整输入（包括 @ 部分）
    textareaRef.current?.focus();
  };

  const removeFileContext = (path: string) => {
    setFileContexts((prev) => prev.filter((fc) => fc.path !== path));
  };

  const removeFolderContext = (folderPath: string) => {
    setFolderContexts((prev) => prev.filter((fc) => fc.folderPath !== folderPath));
  };

  const handleSend = () => {
    if (!input.trim() || disabled) return;
    onSend(input.trim(), fileContexts, folderContexts);
    setInput("");
    setFileContexts([]);
    setFolderContexts([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.focus();
    }
  };

  const hasContext = fileContexts.length > 0 || folderContexts.length > 0;

  return (
    <div className="literag-input-area">
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
      <div className="literag-input-row" ref={wrapperRef} style={{ position: "relative" }}>
        {/* @ 提及弹出层 */}
        {showMention && (
          <MentionPopup
            app={app}
            filter={mentionFilter}
            onSelectFile={handleMentionSelectFile}
            onSelectFolder={handleMentionSelectFolder}
            onClose={closeMention}
            inputElement={textareaRef.current}
          />
        )}

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
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={
            hasContext
              ? "基于引用的内容提问，或发送修改指令..."
              : "输入问题，输入 @ 引用文件/文件夹..."
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
            📂 文件夹
          </button>
          <span className="literag-toolbar-hint">
            💡 输入 <kbd>@</kbd> 快速引用
          </span>
        </div>
        <span className="literag-input-hint">Enter 发送 · Shift+Enter 换行</span>
      </div>
    </div>
  );
}
