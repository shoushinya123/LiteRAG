// ============================================================
// ChatInput.tsx — 聊天输入框
//   支持 @ 提及文件/文件夹、工具栏按钮、模式切换抽屉
// ============================================================
import { useState, useRef, useMemo, useEffect } from "react";
import type { App as ObsidianApp } from "obsidian";
import type { FileContext, FolderContext, ChatMode } from "../types";
import { ModeDrawer } from "./ModeDrawer";

interface Props {
  app: ObsidianApp;
  mode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
  onSend: (text: string, fileContexts: FileContext[], folderContexts: FolderContext[]) => void;
  disabled: boolean;
}

/** @ 触发的弹出项类型 */
type MentionItem =
  | { type: "file"; name: string; path: string }
  | { type: "folder"; name: string; path: string; count: number };

export function ChatInput({ app, mode, onModeChange, onSend, disabled }: Props) {
  const [input, setInput] = useState("");
  const [fileContexts, setFileContexts] = useState<FileContext[]>([]);
  const [folderContexts, setFolderContexts] = useState<FolderContext[]>([]);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [showModeDrawer, setShowModeDrawer] = useState(false);

  // ---- @ 提及相关状态 ----
  const [mentionQuery, setMentionQuery] = useState("");       // @ 后面的过滤文字
  const [mentionAnchorEl, setMentionAnchorEl] = useState<DOMRect | null>(null); // textarea 位置
  const [mentionActiveIndex, setMentionActiveIndex] = useState(0);
  const mentionRef = useRef<HTMLDivElement>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ---- 构建 vault 文件+文件夹列表用于 @ 搜索 ----
  const allMentionItems = useMemo((): MentionItem[] => {
    const items: MentionItem[] = [];
    // 文件夹
    const folders = new Map<string, number>();
    for (const f of app.vault.getMarkdownFiles()) {
      const parts = f.path.split("/");
      if (parts.length > 1) {
        const folderPath = parts.slice(0, -1).join("/");
        folders.set(folderPath, (folders.get(folderPath) || 0) + 1);
      } else {
        folders.set("", (folders.get("") || 0) + 1);
      }
    }
    for (const [fp, count] of folders) {
      items.push({
        type: "folder",
        name: fp || "(根目录)",
        path: fp,
        count,
      });
    }
    // 文件
    for (const f of app.vault.getMarkdownFiles()) {
      items.push({
        type: "file",
        name: f.basename,
        path: f.path,
      });
    }
    return items;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 过滤后的提及列表
  const filteredMentions = useMemo(() => {
    if (!mentionQuery) return allMentionItems;
    const q = mentionQuery.toLowerCase();
    return allMentionItems.filter((item) =>
      item.name.toLowerCase().includes(q) || item.path.toLowerCase().includes(q)
    );
  }, [allMentionItems, mentionQuery]);

  // ---- 发送 ----
  const handleSend = () => {
    const text = input.replace(/@\S*\s?$/, "").trim(); // 去掉末尾残留的 @xxx
    if (!text && fileContexts.length === 0 && folderContexts.length === 0) return;
    if (disabled) return;
    onSend(text, fileContexts, folderContexts);
    setInput("");
    setFileContexts([]);
    setFolderContexts([]);
    setMentionQuery("");
    setMentionAnchorEl(null);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // @ 弹出时的键盘导航
    if (mentionAnchorEl) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionActiveIndex((i) => Math.min(i + 1, filteredMentions.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionActiveIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const item = filteredMentions[mentionActiveIndex];
        if (item) selectMentionItem(item);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        closeMention();
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ---- @ 检测核心逻辑 ----
  const detectMention = (text: string): string | null => {
    // 匹配行尾的 @ 或 @xxx（不含空格）
    const match = text.match(/\S*@(\S*)$/);
    if (match) return match[1]; // 返回 @ 后面的文字
    return null;
  };

  /** 关闭 @ 弹窗 */
  const closeMention = () => {
    setMentionQuery("");
    setMentionAnchorEl(null);
    setMentionActiveIndex(0);
  };

  /** 选择一个 @ 提及项 */
  const selectMentionItem = async (item: MentionItem) => {
    closeMention();
    // 去掉输入中的 @xxx
    setInput((prev) => prev.replace(/\S*@(\S*)\s?$/, ""));
    if (item.type === "file") {
      await addFileContext(item);
    } else {
      await addFolderContext(item);
    }
    textareaRef.current?.focus();
  };

  // ---- 输入处理（含 @ 检测） ----
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 180) + "px";

    // @ 检测
    const query = detectMention(val);
    if (query !== null) {
      setMentionQuery(query);
      setMentionAnchorEl(el.getBoundingClientRect());
      setMentionActiveIndex(0);
    } else {
      closeMention();
    }
  };

  // 点击外部关闭 @ 弹窗
  useEffect(() => {
    const handleClickOutside = (ev: MouseEvent) => {
      if (mentionRef.current && !mentionRef.current.contains(ev.target as Node)) {
        closeMention();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ---- 文件/文件夹操作 ----
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

  const addFolderContext = async (folder: { name: string; path: string }) => {
    if (folderContexts.some((fc) => fc.folderPath === folder.path)) return;
    try {
      const files = app.vault.getMarkdownFiles();
      const folderFiles = files.filter(
        (f) => f.path === folder.path || f.path.startsWith(folder.path + "/")
      );
      const contexts: FileContext[] = [];
      for (const f of folderFiles) {
        try {
          const content = await app.vault.read(f);
          contexts.push({ path: f.path, name: f.basename, content });
        } catch { /* skip */ }
      }
      setFolderContexts((prev) => [
        ...prev,
        { folderPath: folder.path, folderName: folder.name, files: contexts },
      ]);
    } catch (err) {
      console.error("[小夏] 读取文件夹失败:", err);
    }
  };

  const removeFileContext = (path: string) =>
    setFileContexts((prev) => prev.filter((fc) => fc.path !== path));
  const removeFolderContext = (folderPath: string) =>
    setFolderContexts((prev) => prev.filter((fc) => fc.folderPath !== folderPath));

  // ---- 渲染 ----
  const hasContext = fileContexts.length > 0 || folderContexts.length > 0;
  const modeLabel = mode === "ark" ? "💬 ARK" : "🤖 Agent";
  const modeColor = mode === "ark" ? "#8b5cf6" : "#f59e0b";

  return (
    <div className="literag-input-area">
      {/* ====== 模式抽屉 ====== */}
      {showModeDrawer && (
        <div className="literag-mode-drawer-overlay" onClick={() => setShowModeDrawer(false)}>
          <div className="literag-mode-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="literag-drawer-handle" />
            <div className="literag-drawer-header">
              <span className="literag-drawer-title">选择对话模式</span>
              <button className="literag-drawer-close" onClick={() => setShowModeDrawer(false)}>✕</button>
            </div>
            <div className="literag-drawer-options">
              <button
                className={`literag-drawer-option ${mode === "ark" ? "literag-drawer-option-active" : ""}`}
                onClick={() => { onModeChange("ark"); setShowModeDrawer(false); }}
              >
                <div className="literag-drawer-option-icon">💬</div>
                <div className="literag-drawer-option-body">
                  <div className="literag-drawer-option-name">
                    ARK 模式
                    {mode === "ark" && <span className="literag-drawer-option-check">✓ 当前</span>}
                  </div>
                  <div className="literag-drawer-option-desc">
                    纯模型对话，不检索知识库。适合自由聊天、写代码、头脑风暴。
                  </div>
                </div>
              </button>

              <button
                className={`literag-drawer-option ${mode === "agent" ? "literag-drawer-option-active" : ""}`}
                onClick={() => { onModeChange("agent"); setShowModeDrawer(false); }}
              >
                <div className="literag-drawer-option-icon">🤖</div>
                <div className="literag-drawer-option-body">
                  <div className="literag-drawer-option-name">
                    Agent 模式
                    {mode === "agent" && <span className="literag-drawer-option-check">✓ 当前</span>}
                  </div>
                  <div className="literag-drawer-option-desc">
                    先检索知识库，再综合回答。适合查询笔记、总结文档。
                    <span className="literag-drawer-option-hint">（LiteRAG 未连接时自动跳过检索）</span>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====== 引用芯片条 ====== */}
      {hasContext && (
        <div className="literag-context-bar">
          {fileContexts.map((fc) => (
            <span key={fc.path} className="literag-context-chip" title={fc.path}>
              <span>📄</span>
              <span className="literag-context-chip-name">{fc.name}</span>
              <span className="literag-context-chip-remove" onClick={() => removeFileContext(fc.path)}>×</span>
            </span>
          ))}
          {folderContexts.map((fc) => (
            <span key={fc.folderPath} className="literag-folder-chip" title={fc.folderPath}>
              <span>📁</span>
              <span className="literag-context-chip-name">{fc.folderName}</span>
              <span className="literag-folder-chip-count">({fc.files.length} 篇)</span>
              <span className="literag-context-chip-remove" onClick={() => removeFolderContext(fc.folderPath)}>×</span>
            </span>
          ))}
        </div>
      )}

      {/* ====== 输入行（含 @ 弹窗） ====== */}
      <div className="literag-input-row" style={{ position: "relative" }}>
        {/* FilePicker / FolderPicker 覆盖弹窗 */}
        {showFilePicker && (
          <div className="literag-file-picker-overlay">
            <div className="literag-file-picker-popup">
              <div className="literag-file-picker-header">
                <span>📎 选择笔记文件</span>
                <button onClick={() => setShowFilePicker(false)}>✕</button>
              </div>
              <input
                className="literag-file-picker-search"
                placeholder="搜索文件名..."
                autoFocus
              />
              <div className="literag-file-picker-list">
                {app.vault.getMarkdownFiles()
                  .sort((a, b) => a.basename.localeCompare(b.basename))
                  .slice(0, 50)
                  .map((f) => (
                    <div
                      key={f.path}
                      className="literag-file-picker-item"
                      onClick={() => { addFileContext(f); setShowFilePicker(false); }}
                    >
                      <span className="literag-file-picker-item-icon">📄</span>
                      <span className="literag-file-picker-item-name">{f.basename}</span>
                      <span className="literag-file-picker-item-path">{f.path}</span>
                    </div>
                  ))}
                {app.vault.getMarkdownFiles().length === 0 && (
                  <div className="literag-file-picker-empty">没有找到笔记文件</div>
                )}
              </div>
            </div>
          </div>
        )}

        {showFolderPicker && (
          <div className="literag-folder-picker-overlay">
            <div className="literag-folder-picker-popup">
              <div className="literag-folder-picker-header">
                <span>📁 选择文件夹</span>
                <button onClick={() => setShowFolderPicker(false)}>✕</button>
              </div>
              <div className="literag-folder-picker-list">
                {Array.from(
                  new Set(app.vault.getMarkdownFiles().map((f) => {
                    const parts = f.path.split("/");
                    return parts.length > 1 ? parts.slice(0, -1).join("/") : "";
                  }))
                )
                  .filter(Boolean)
                  .sort()
                  .map((fp) => {
                    const name = fp.includes("/") ? fp.split("/").pop()! : fp;
                    const count = app.vault.getMarkdownFiles().filter(
                      (f) => f.path === fp || f.path.startsWith(fp + "/")
                    ).length;
                    return (
                      <div
                        key={fp}
                        className="literag-folder-picker-item"
                        onClick={() => { addFolderContext({ name, path: fp }); setShowFolderPicker(false); }}
                      >
                        <span className="literag-folder-picker-item-icon">📁</span>
                        <span className="literag-folder-picker-item-name">{name}</span>
                        <span className="literag-folder-picker-item-count">{count} 个文件</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}

        {/* @ 提及弹出层（定位在输入框上方） */}
        {mentionAnchorEl && (
          <div
            ref={mentionRef}
            className="literag-mention-popup"
            style={{
              position: "fixed",
              left: mentionAnchorEl.left,
              bottom: `${window.innerHeight - mentionAnchorEl.top + 4}px`,
              zIndex: 999,
            }}
          >
            <div className="literag-mention-header">
              🔍 引用文件或文件夹
              {mentionQuery && <span className="literag-mention-query">「{mentionQuery}」</span>}
            </div>
            <div className="literag-mention-list">
              {filteredMentions.length === 0 ? (
                <div className="literag-mention-empty">无匹配结果</div>
              ) : (
                filteredMentions.slice(0, 15).map((item, idx) => (
                  <div
                    key={`${item.type}:${item.path}`}
                    className={`literag-mention-item ${idx === mentionActiveIndex ? "literag-mention-active" : ""}`}
                    onMouseEnter={() => setMentionActiveIndex(idx)}
                    onClick={() => selectMentionItem(item)}
                  >
                    <span className={`literag-mention-icon ${item.type === "folder" ? "literag-mention-icon-folder" : ""}`}>
                      {item.type === "folder" ? "📁" : "📄"}
                    </span>
                    <div className="literag-mention-item-body">
                      <span className="literag-mention-item-name">{item.name}</span>
                      <span className="literag-mention-item-path">{item.path}</span>
                    </div>
                    {item.type === "folder" && (
                      <span className="literag-mention-count">{item.count} 个文件</span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <textarea
          ref={textareaRef}
          className="literag-input"
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={
            hasContext
              ? "基于引用的内容提问..."
              : "输入 @ 引用文件，或直接提问..."
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

      {/* ====== 底部工具栏 ====== */}
      <div className="literag-input-footer">
        <div className="literag-input-toolbar-left">
          {/* 模式切换 */}
          <button
            className="literag-mode-toggle-btn"
            onClick={() => setShowModeDrawer(!showModeDrawer)}
            disabled={disabled}
            title="切换 ARK / Agent 模式"
            style={{ borderColor: modeColor }}
          >
            <span style={{ color: modeColor }}>{mode === "ark" ? "💬" : "🤖"}</span>
            <span style={{ color: modeColor }}>{mode === "ark" ? "ARK" : "Agent"}</span>
          </button>

          {/* 文件引用按钮 */}
          <button
            className="literag-context-add-btn"
            onClick={() => setShowFilePicker(!showFilePicker)}
            disabled={disabled}
            title="引用笔记文件到上下文"
          >
            📎 文件
          </button>

          {/* 文件夹引用按钮 */}
          <button
            className="literag-context-add-btn"
            onClick={() => setShowFolderPicker(!showFolderPicker)}
            disabled={disabled}
            title="引用整个文件夹到上下文"
          >
            📁 文件夹
          </button>
        </div>
        <span className="literag-input-hint">Enter 发送 · Shift+Enter 换行 · @ 引用文件</span>
      </div>
    </div>
  );
}
