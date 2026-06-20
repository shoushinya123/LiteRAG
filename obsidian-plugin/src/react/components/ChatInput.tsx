// ============================================================
// ChatInput.tsx — 聊天输入框（v3: 小型 popover 模式切换 + @ 提及）
// ============================================================
import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import type { App as ObsidianApp } from "obsidian";
import type { FileContext, FolderContext, ChatMode } from "../types";

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

  // ---- 模式 popover 状态 ----
  const [showModePop, setShowModePop] = useState(false);
  const modeBtnRef = useRef<HTMLButtonElement>(null);

  // ---- @ 提及相关状态 ----
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionAnchorEl, setMentionAnchorEl] = useState<DOMRect | null>(null);
  const [mentionActiveIndex, setMentionActiveIndex] = useState(0);
  const mentionRef = useRef<HTMLDivElement>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputRowRef = useRef<HTMLDivElement>(null);

  // ---- 构建 vault 文件+文件夹列表用于 @ 搜索 ----
  const allMentionItems = useMemo((): MentionItem[] => {
    const items: MentionItem[] = [];
    // 文件夹（去重统计）
    const folders = new Map<string, number>();
    for (const f of app.vault.getMarkdownFiles()) {
      const parts = f.path.split("/");
      if (parts.length > 1) {
        const fp = parts.slice(0, -1).join("/");
        folders.set(fp, (folders.get(fp) || 0) + 1);
      } else {
        folders.set("", (folders.get("") || 0) + 1);
      }
    }
    for (const [fp, count] of folders) {
      items.push({ type: "folder", name: fp || "(根目录)", path: fp, count });
    }
    // 文件
    for (const f of app.vault.getMarkdownFiles()) {
      items.push({ type: "file", name: f.basename, path: f.path });
    }
    return items;
  }, []);

  // 过滤后的提及列表
  const filteredMentions = useMemo(() => {
    if (!mentionQuery) return allMentionItems;
    const q = mentionQuery.toLowerCase();
    return allMentionItems.filter((item) =>
      item.name.toLowerCase().includes(q) || item.path.toLowerCase().includes(q)
    );
  }, [allMentionItems, mentionQuery]);

  // ---- 关闭所有弹窗 ----
  const closeAllPoppers = useCallback(() => {
    setShowFilePicker(false);
    setShowFolderPicker(false);
    setShowModePop(false);
    closeMention();
  }, []);

  // 点击外部关闭所有弹窗
  useEffect(() => {
    const handler = (ev: MouseEvent | TouchEvent) => {
      const target = ev.target as Node;
      // 检查是否点击在 mention popup 外
      if (mentionRef.current && !mentionRef.current.contains(target)) {
        // 如果点击不在 textarea 上也关闭 mention
        if (!textareaRef.current?.contains(target)) {
          setMentionAnchorEl(null);
          setMentionQuery("");
        }
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ---- 发送 ----
  const handleSend = () => {
    // 清理输入中的 @ 残留
    const text = input.replace(/\s*@[\w\u4e00-\u9fff]*\s?$/, "").trim();
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
    // @ 弹出时键盘导航优先
    if (mentionAnchorEl !== null) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionActiveIndex(i => Math.min(i + 1, filteredMentions.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionActiveIndex(i => Math.max(i - 1, 0));
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

  // ---- @ 检测核心逻辑（已修复：支持纯 @ 开头）----
  const detectMention = (text: string): string | null => {
    // 匹配光标前的 @ 及后续文字（支持纯 @ 开头）
    const match = text.match(/@([\w\u4e00-\u9fff./\-_]*)$/);
    return match ? match[1] : null;
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
    // 清理输入中的 @xxx
    setInput(prev => prev.replace(/\s*@[\w\u4e00-\u9fff./\-_]*$/, ""));
    if (item.type === "file") {
      await addFileContext(item);
    } else {
      await addFolderContext(item);
    }
    textareaRef.current?.focus();
  };

  // ---- 输入处理（含 @ 检测）----
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 180) + "px";

    // @ 检测（每输入都检测）
    const query = detectMention(val);
    if (query !== null) {
      setMentionQuery(query);
      setMentionAnchorEl(el.getBoundingClientRect());
      setMentionActiveIndex(0);
    } else {
      closeMention();
    }
  };

  // ---- 文件/文件夹操作 ----
  const addFileContext = async (file: { name: string; path: string }) => {
    if (fileContexts.some(fc => fc.path === file.path)) return;
    try {
      const content = await app.vault.adapter.read(file.path);
      setFileContexts(prev => [...prev, { path: file.path, name: file.name, content }]);
    } catch (err) {
      console.error("[小夏] 读取文件失败:", err);
    }
  };

  const addFolderContext = async (folder: { name: string; path: string }) => {
    if (folderContexts.some(fc => fc.folderPath === folder.path)) return;
    try {
      const files = app.vault.getMarkdownFiles();
      const folderFiles = files.filter(
        f => f.path === folder.path || f.path.startsWith(folder.path + "/")
      );
      const contexts: FileContext[] = [];
      for (const f of folderFiles) {
        try {
          const content = await app.vault.read(f);
          contexts.push({ path: f.path, name: f.basename, content });
        } catch { /* skip */ }
      }
      setFolderContexts(prev => [
        ...prev,
        { folderPath: folder.path, folderName: folder.name, files: contexts },
      ]);
    } catch (err) {
      console.error("[小夏] 读取文件夹失败:", err);
    }
  };

  const removeFileContext = (path: string) =>
    setFileContexts(prev => prev.filter(fc => fc.path !== path));
  const removeFolderContext = (fp: string) =>
    setFolderContexts(prev => prev.filter(fc => fc.folderPath !== fp));

  // ---- 渲染常量 ----
  const hasContext = fileContexts.length > 0 || folderContexts.length > 0;
  const modeColor = mode === "ark" ? "#8b5cf6" : "#f59e0b";

  // ========================================
  // RENDER
  // ========================================
  return (
    <div className="literag-input-area">
      {/* ====== 引用芯片条 ====== */}
      {hasContext && (
        <div className="literag-context-bar">
          {fileContexts.map(fc => (
            <span key={fc.path} className="literag-context-chip" title={fc.path}>
              <span>📄</span>
              <span className="literag-context-chip-name">{fc.name}</span>
              <span className="literag-context-chip-remove" onClick={() => removeFileContext(fc.path)}>×</span>
            </span>
          ))}
          {folderContexts.map(fc => (
            <span key={fc.folderPath} className="literag-folder-chip" title={fc.folderPath}>
              <span>📁</span>
              <span className="literag-context-chip-name">{fc.folderName}</span>
              <span className="literag-folder-chip-count">({fc.files.length} 篇)</span>
              <span className="literag-context-chip-remove" onClick={() => removeFolderContext(fc.folderPath)}>×</span>
            </span>
          ))}
        </div>
      )}

      {/* ====== 输入行（含所有弹窗） ====== */}
      <div className="literag-input-row" ref={inputRowRef} style={{ position: "relative" }}>
        {/* ── FilePicker 弹窗 ── */}
        {showFilePicker && (
          <div className="literag-file-picker-overlay">
            <div className="literag-file-picker-popup">
              <div className="literag-file-picker-header">
                <span>📎 选择笔记文件</span>
                <button onClick={() => setShowFilePicker(false)}>✕</button>
              </div>
              <input className="literag-file-picker-search" placeholder="搜索文件名..." autoFocus />
              <div className="literag-file-picker-list">
                {app.vault.getMarkdownFiles()
                  .sort((a, b) => a.basename.localeCompare(b.basename))
                  .slice(0, 50)
                  .map(f => (
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

        {/* ── FolderPicker 弹窗 ── */}
        {showFolderPicker && (
          <div className="literag-folder-picker-overlay">
            <div className="literag-folder-picker-popup">
              <div className="literag-folder-picker-header">
                <span>📁 选择文件夹</span>
                <button onClick={() => setShowFolderPicker(false)}>✕</button>
              </div>
              <div className="literag-folder-picker-list">
                {Array.from(
                  new Set(app.vault.getMarkdownFiles().map(f => {
                    const parts = f.path.split("/");
                    return parts.length > 1 ? parts.slice(0, -1).join("/") : "";
                  }))
                )
                  .filter(Boolean)
                  .sort()
                  .map(fp => {
                    const displayName = fp.includes("/") ? fp.split("/").pop()! : fp;
                    const count = app.vault.getMarkdownFiles()
                      .filter(f => f.path === fp || f.path.startsWith(fp + "/")).length;
                    return (
                      <div
                        key={fp}
                        className="literag-folder-picker-item"
                        onClick={() => { addFolderContext({ name: displayName, path: fp }); setShowFolderPicker(false); }}
                      >
                        <span className="literag-folder-picker-item-icon">📁</span>
                        <span className="literag-folder-picker-item-name">{displayName}</span>
                        <span className="literag-folder-picker-item-count">{count} 个文件</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}

        {/* ── @ 提及弹出层 ── */}
        {mentionAnchorEl && (
          <div
            ref={mentionRef}
            className="literag-mention-popup"
            style={{
              position: "fixed",
              left: Math.min(mentionAnchorEl.left, window.innerWidth - 340),
              bottom: `${window.innerHeight - mentionAnchorEl.top + 4}px`,
              zIndex: 10000,
            }}
          >
            <div className="literag-mention-header">
              🔍 引用文件或文件夹
              {mentionQuery && <span className="literag-mention-query">「{mentionQuery}」</span>}
            </div>
            <div className="literag-mention-list">
              {filteredMentions.length === 0 ? (
                <div className="literag-mention-empty">无匹配结果</div>
              ) : filteredMentions.slice(0, 15).map((item, idx) => (
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
              ))}
            </div>
          </div>
        )}

        {/* textarea */}
        <textarea
          ref={textareaRef}
          className="literag-input"
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={
            hasContext ? "基于引用的内容提问..." : "输入 @ 引用文件，或直接提问..."
          }
          rows={1}
          disabled={disabled}
          style={{ minHeight: 38, height: "auto" }}
        />
        <button
          className="literag-send-btn"
          onClick={handleSend}
          disabled={disabled || !input.trim()}
          title="发送"
        >
          ↑
        </button>

        {/* ── 模式切换 Popover（紧贴发送按钮左侧）── */}
        <div className="literag-mode-popover-wrap">
          <button
            ref={modeBtnRef}
            className="literag-mode-toggle-btn"
            onClick={(e) => {
              e.stopPropagation();
              setShowModePop(p => !p);
            }}
            onBlur={() => setTimeout(() => setShowModePop(false), 150)}
            disabled={disabled}
            title="切换 ARK / Agent 模式"
            style={{ borderColor: modeColor }}
          >
            <span style={{ color: modeColor }}>{mode === "ark" ? "💬" : "🤖"}</span>
            <span style={{ color: modeColor }}>{mode === "ark" ? "ARK" : "Agent"}</span>
          </button>

          {showModePop && modeBtnRef.current && (() => {
            const rect = modeBtnRef.current.getBoundingClientRect();
            return (
              <div
                className="literag-mode-popover"
                style={{
                  position: "fixed",
                  left: rect.left,
                  bottom: `${window.innerHeight - rect.top + 8}px`,
                  zIndex: 9999,
                }}
                onMouseDown={e => e.preventDefault()} // 防止 blur 触发关闭
              >
                {/* 标题栏 */}
                <div className="literag-mode-popover-header">
                  <span className="literag-mode-popover-title">选择对话模式</span>
                  <button
                    className="literag-mode-popover-close"
                    onClick={() => setShowModePop(false)}
                    onMouseDown={e => e.preventDefault()}
                  >✕</button>
                </div>

                {/* 选项列表 */}
                <div className="literag-mode-popover-body">
                  <div
                    className={`literag-mode-popover-option ${mode === "ark" ? "active" : ""}`}
                    onMouseDown={() => { onModeChange("ark"); setShowModePop(false); }}
                  >
                    <div className="literag-mode-option-icon">💬</div>
                    <div className="literag-mode-option-content">
                      <div className="literag-mode-option-name">
                        ARK 模式
                        {mode === "ark" && <span className="literag-mode-option-check">✓ 当前</span>}
                      </div>
                      <div className="literag-mode-option-desc">
                        纯模型对话，不检索知识库。适合自由聊天、写代码、头脑风暴。
                      </div>
                    </div>
                  </div>

                  <div
                    className={`literag-mode-popover-option ${mode === "agent" ? "active" : ""}`}
                    onMouseDown={() => { onModeChange("agent"); setShowModePop(false); }}
                  >
                    <div className="literag-mode-option-icon">🤖</div>
                    <div className="literag-mode-option-content">
                      <div className="literag-mode-option-name">
                        Agent 模式
                        {mode === "agent" && <span className="literag-mode-option-check">✓ 当前</span>}
                      </div>
                      <div className="literag-mode-option-desc">
                        先检索知识库，再综合回答。适合查询笔记、总结文档、引用资料。
                        <span className="literag-mode-option-hint">（LiteRAG 未连接时自动跳过检索）</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* ====== 底部工具栏 ====== */}
      <div className="literag-input-footer">
        <div className="literag-input-toolbar-left">
          <button
            className="literag-context-add-btn"
            onClick={() => setShowFilePicker(!showFilePicker)}
            disabled={disabled}
            title="引用笔记文件到上下文"
          >📎 文件</button>
          <button
            className="literag-context-add-btn"
            onClick={() => setShowFolderPicker(!showFolderPicker)}
            disabled={disabled}
            title="引用整个文件夹到上下文"
          >📁 文件夹</button>
        </div>
        <span className="literag-input-hint">Enter 发送 · Shift+Enter 换行 · <b>@</b> 引用文件</span>
      </div>
    </div>
  );
}
