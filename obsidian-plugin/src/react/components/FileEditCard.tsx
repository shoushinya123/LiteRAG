// ============================================================
// FileEditCard.tsx — AI 建议修改文件的确认卡片
// ============================================================
import { useState } from "react";
import type { FileEditSuggestion } from "../types";

interface Props {
  suggestion: FileEditSuggestion;
  onConfirm: (suggestion: FileEditSuggestion) => Promise<void>;
  onDismiss: () => void;
}

export function FileEditCard({ suggestion, onConfirm, onDismiss }: Props) {
  const [isApplying, setIsApplying] = useState(false);
  const [previewExpanded, setPreviewExpanded] = useState(false);

  if (suggestion.confirmed) {
    return (
      <div className="literag-file-edit-card">
        <div className="literag-file-edit-confirmed">
          ✅ 已保存到 <code style={{ fontSize: 11 }}>{suggestion.targetPath}</code>
        </div>
      </div>
    );
  }

  const fileName = suggestion.targetPath.split("/").pop() || suggestion.targetPath;

  const handleApply = async () => {
    setIsApplying(true);
    try {
      await onConfirm(suggestion);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="literag-file-edit-card">
      <div className="literag-file-edit-header">
        <div className="literag-file-edit-title">
          <span>✏️</span>
          <span>建议修改文件</span>
        </div>
        <span className="literag-file-edit-path" title={suggestion.targetPath}>
          {fileName}
        </span>
      </div>
      {suggestion.description && (
        <div className="literag-file-edit-desc">{suggestion.description}</div>
      )}
      <div
        className="literag-rag-refs-header"
        style={{ fontSize: 11, padding: "4px 12px", cursor: "pointer", userSelect: "none" }}
        onClick={() => setPreviewExpanded(!previewExpanded)}
      >
        <span>📝 查看新内容预览</span>
        <span>{previewExpanded ? "▲" : "▼"}</span>
      </div>
      {previewExpanded && (
        <div className="literag-file-edit-preview">{suggestion.newContent}</div>
      )}
      <div className="literag-file-edit-actions">
        <button
          className="literag-btn literag-btn-primary"
          onClick={handleApply}
          disabled={isApplying}
        >
          {isApplying ? "⏳ 写入中..." : "✅ 确认写入"}
        </button>
        <button
          className="literag-btn literag-btn-danger"
          onClick={onDismiss}
          disabled={isApplying}
        >
          ✕ 忽略
        </button>
      </div>
    </div>
  );
}
