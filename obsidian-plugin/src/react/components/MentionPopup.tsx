// ============================================================
// MentionPopup.tsx — @ 提及弹出层（文件+文件夹混合列表）
// ============================================================
import { useState, useEffect, useRef, useCallback } from "react";
import type { App as ObsidianApp } from "obsidian";
import type { FileContext } from "../types";

interface FileItem {
  name: string;
  path: string;
}

interface FolderItem {
  name: string;
  path: string;
  fileCount: number;
}

type MentionItem =
  | { type: "file"; data: FileItem }
  | { type: "folder"; data: FolderItem };

interface Props {
  app: ObsidianApp;
  filter: string;
  onSelectFile: (file: FileItem) => void;
  onSelectFolder: (folder: FolderItem) => void;
  onClose: () => void;
  inputElement?: HTMLTextAreaElement | null;
}

export function MentionPopup({ app, filter, onSelectFile, onSelectFolder, onClose, inputElement }: Props) {
  const [items, setItems] = useState<MentionItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // 加载文件和文件夹列表
  useEffect(() => {
    const mdFiles = app.vault.getMarkdownFiles();
    const folderSet = new Map<string, number>();

    // 收集所有文件夹及其文件数
    for (const f of mdFiles) {
      const parts = f.path.split("/");
      // 添加所有层级的文件夹
      for (let i = 0; i < parts.length - 1; i++) {
        const folderPath = parts.slice(0, i + 1).join("/");
        folderSet.set(folderPath, (folderSet.get(folderPath) || 0) + 1);
      }
    }

    // 构建文件夹列表
    const folders: FolderItem[] = Array.from(folderSet.entries()).map(([path, count]) => ({
      name: path.split("/").pop() || path,
      path,
      fileCount: count,
    }));

    // 构建文件列表
    const files: FileItem[] = mdFiles.map((f) => ({
      name: f.basename,
      path: f.path,
    }));

    // 合并为 MentionItem 列表
    const allItems: MentionItem[] = [
      ...folders.map((f) => ({ type: "folder" as const, data: f })),
      ...files.map((f) => ({ type: "file" as const, data: f })),
    ];

    // 过滤
    const lowerFilter = filter.toLowerCase();
    const filtered = lowerFilter
      ? allItems.filter((item) => {
          const name = item.type === "file" ? item.data.name : item.data.name;
          const path = item.type === "file" ? item.data.path : item.data.path;
          return name.toLowerCase().includes(lowerFilter) || path.toLowerCase().includes(lowerFilter);
        })
      : allItems.slice(0, 50); // 无过滤时显示前 50 个

    setItems(filtered);
    setActiveIndex(0);
  }, [app, filter]);

  // 键盘导航
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (items.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => Math.min(prev + 1, items.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = items[activeIndex];
        if (item) {
          if (item.type === "file") {
            onSelectFile(item.data);
          } else {
            onSelectFolder(item.data);
          }
          onClose();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [items, activeIndex, onSelectFile, onSelectFolder, onClose]
  );

  // 监听键盘事件
  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // 点击外部关闭
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (listRef.current && !listRef.current.contains(e.target as Node)) {
        // 检查是否点击在 textarea 内
        if (inputElement && !inputElement.contains(e.target as Node)) {
          onClose();
        }
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose, inputElement]);

  // 滚动到活跃项
  useEffect(() => {
    if (itemRefs.current[activeIndex]) {
      itemRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  if (items.length === 0) {
    return (
      <div className="literag-mention-popup" ref={listRef}>
        <div className="literag-mention-empty">没有匹配的文件或文件夹</div>
      </div>
    );
  }

  return (
    <div className="literag-mention-popup" ref={listRef}>
      <div className="literag-mention-header">
        <span>📄 文件</span>
        <span>|</span>
        <span>📁 文件夹</span>
        <span className="literag-mention-hint">↑↓ 选择 · Enter 确认 · Esc 关闭</span>
      </div>
      <div className="literag-mention-list">
        {items.map((item, idx) => (
          <div
            key={item.type === "file" ? item.data.path : `folder:${item.data.path}`}
            ref={(el) => { itemRefs.current[idx] = el; }}
            className={`literag-mention-item ${idx === activeIndex ? "literag-mention-active" : ""}`}
            onMouseEnter={() => setActiveIndex(idx)}
            onClick={() => {
              if (item.type === "file") {
                onSelectFile(item.data);
              } else {
                onSelectFolder(item.data);
              }
              onClose();
            }}
          >
            {item.type === "file" ? (
              <>
                <span className="literag-mention-icon">📄</span>
                <span className="literag-mention-name">{item.data.name}</span>
                <span className="literag-mention-path">{item.data.path}</span>
              </>
            ) : (
              <>
                <span className="literag-mention-icon">📁</span>
                <span className="literag-mention-name">{item.data.name}/</span>
                <span className="literag-mention-count">({item.data.fileCount} 篇)</span>
                <span className="literag-mention-path">{item.data.path}</span>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
