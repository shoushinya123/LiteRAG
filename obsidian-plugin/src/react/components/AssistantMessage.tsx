// ============================================================
// AssistantMessage.tsx — AI 回复气泡（支持文件编辑确认卡片）
// ============================================================
import { useState } from "react";
import type { UIMessage, FileEditSuggestion } from "../types";
import { RAGReferences } from "./RAGReferences";
import { EditArea } from "./EditArea";
import { FileEditCard } from "./FileEditCard";

interface Props {
  message: UIMessage;
  onEdit: (id: string, content: string) => void;
  onSave: (id: string, content: string, title?: string) => Promise<void>;
  onApplyFileEdit?: (id: string, suggestion: FileEditSuggestion) => Promise<void>;
  onDismissFileEdit?: (id: string) => void;
}

export function AssistantMessage({
  message,
  onEdit,
  onSave,
  onApplyFileEdit,
  onDismissFileEdit,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(message.content);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const time = new Date(message.timestamp).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(message.id, editedContent);
      message.content = editedContent;
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="literag-message-row">
      <div className="literag-avatar literag-avatar-ai">🌸</div>
      <div className="literag-bubble literag-bubble-ai">
        <div className="literag-bubble-meta">
          <span className="literag-bubble-name">小夏</span>
          <span className="literag-bubble-time">{time}</span>
          {message.savedPath && (
            <span className="literag-bubble-saved" title={message.savedPath}>
              💾 已保存
            </span>
          )}
          {message.ragSkipped && (
            <span className="literag-rag-skip-badge" title="Agent 模式下 LiteRAG 未连接，已跳过知识库检索">
              ⚠️ RAG 未连接
            </span>
          )}
        </div>

        {/* RAG 未连接提示 */}
        {message.ragSkipped && (
          <div className="literag-rag-skip-inline">
            当前为 Agent 模式，但 LiteRAG 服务未连接，已直接回答。启动 LiteRAG 后可获得知识库增强回复。
          </div>
        )}

        {/* RAG 来源 */}
        {message.ragSources && message.ragSources.length > 0 && (
          <RAGReferences sources={message.ragSources} />
        )}

        {/* 编辑 or 内容 */}
        {isEditing ? (
          <EditArea
            content={editedContent}
            onChange={setEditedContent}
            onSave={handleSave}
            onCancel={() => { setEditedContent(message.content); setIsEditing(false); }}
            isSaving={isSaving}
          />
        ) : (
          <>
            <div className="literag-bubble-content">{message.content}</div>

            {/* 文件编辑建议卡片 */}
            {message.fileEdit && onApplyFileEdit && onDismissFileEdit && (
              <FileEditCard
                suggestion={message.fileEdit}
                onConfirm={(s) => onApplyFileEdit(message.id, s)}
                onDismiss={() => onDismissFileEdit(message.id)}
              />
            )}

            <div className="literag-bubble-actions">
              <button
                className="literag-btn"
                onClick={() => setIsEditing(true)}
                title="编辑后保存到笔记"
              >
                ✏️ 编辑
              </button>
              <button
                className="literag-btn literag-btn-primary"
                onClick={handleSave}
                disabled={isSaving}
                title="直接保存到 Obsidian"
              >
                {isSaving ? "⏳" : "💾"} 存为笔记
              </button>
              <button className="literag-btn" onClick={handleCopy} title="复制内容">
                {copied ? "✅ 已复制" : "📋 复制"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
