// ============================================================
// FilePicker.tsx — 文件选择器弹出层
// ============================================================
import { useState, useEffect, useRef } from "react";
import type { App as ObsidianApp } from "obsidian";

interface FileItem {
  name: string;
  path: string;
}

interface Props {
  app: ObsidianApp;
  onSelect: (file: FileItem) => void;
  onClose: () => void;
}

export function FilePicker({ app, onSelect, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [files, setFiles] = useState<FileItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // 获取 vault 中所有 md 文件
    const allFiles = app.vault
      .getMarkdownFiles()
      .map((f) => ({ name: f.basename, path: f.path }))
      .sort((a, b) => a.name.localeCompare(b.name));
    setFiles(allFiles);
    inputRef.current?.focus();
  }, [app]);

  // 点击外部关闭
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const filtered = query.trim()
    ? files.filter(
        (f) =>
          f.name.toLowerCase().includes(query.toLowerCase()) ||
          f.path.toLowerCase().includes(query.toLowerCase())
      )
    : files.slice(0, 30);

  return (
    <div className="literag-file-picker" ref={containerRef}>
      <div className="literag-file-picker-search">
        <input
          ref={inputRef}
          className="literag-file-picker-input"
          placeholder="搜索笔记文件..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && onClose()}
        />
      </div>
      <div className="literag-file-picker-list">
        {filtered.length === 0 ? (
          <div className="literag-file-picker-empty">没有匹配的文件</div>
        ) : (
          filtered.map((f) => (
            <div
              key={f.path}
              className="literag-file-picker-item"
              onClick={() => { onSelect(f); onClose(); }}
            >
              <span>📄</span>
              <span className="literag-file-picker-item-name">{f.name}</span>
              <span className="literag-file-picker-item-path">
                {f.path.includes("/") ? f.path.substring(0, f.path.lastIndexOf("/")) : ""}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
