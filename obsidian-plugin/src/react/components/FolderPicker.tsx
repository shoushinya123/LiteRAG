// ============================================================
// FolderPicker.tsx — 文件夹选择器弹出层
// ============================================================
import { useState, useEffect, useRef } from "react";
import type { App as ObsidianApp } from "obsidian";
import { TFolder } from "obsidian";

interface Props {
  app: ObsidianApp;
  onSelect: (folder: { name: string; path: string }) => void;
  onClose: () => void;
}

/** 递归收集所有文件夹 */
function collectFolders(folder: TFolder): { name: string; path: string }[] {
  const result: { name: string; path: string }[] = [];
  for (const child of folder.children) {
    if (child instanceof TFolder) {
      result.push({ name: child.name, path: child.path });
      result.push(...collectFolders(child));
    }
  }
  return result;
}

export function FolderPicker({ app, onSelect, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [folders, setFolders] = useState<{ name: string; path: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = app.vault.getRoot();
    const all = collectFolders(root).sort((a, b) => a.path.localeCompare(b.path));
    setFolders(all);
    inputRef.current?.focus();
  }, [app]);

  // 点击外部关闭
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
    ? folders.filter(
        (f) =>
          f.name.toLowerCase().includes(query.toLowerCase()) ||
          f.path.toLowerCase().includes(query.toLowerCase())
      )
    : folders;

  return (
    <div className="literag-folder-picker" ref={containerRef}>
      <div className="literag-file-picker-search">
        <input
          ref={inputRef}
          className="literag-file-picker-input"
          placeholder="搜索文件夹..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && onClose()}
        />
      </div>
      <div className="literag-file-picker-list">
        {filtered.length === 0 ? (
          <div className="literag-file-picker-empty">没有匹配的文件夹</div>
        ) : (
          filtered.map((f) => (
            <div
              key={f.path}
              className="literag-folder-picker-item"
              onClick={() => { onSelect(f); onClose(); }}
            >
              <span className="literag-folder-picker-icon">📁</span>
              <span className="literag-file-picker-item-name">{f.name}</span>
              <span className="literag-file-picker-item-path">
                {f.path.includes("/") ? f.path.substring(0, f.path.lastIndexOf("/")) : "根目录"}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
