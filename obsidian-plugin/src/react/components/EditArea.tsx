// ============================================================
// EditArea.tsx — 编辑 + 保存区域
// ============================================================
interface Props {
  content: string;
  onChange: (v: string) => void;
  onSave: () => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
}

export function EditArea({ content, onChange, onSave, onCancel, isSaving }: Props) {
  return (
    <div className="literag-edit-area">
      <textarea
        className="literag-edit-textarea"
        value={content}
        onChange={(e) => onChange(e.target.value)}
        rows={6}
        autoFocus
      />
      <div className="literag-edit-actions">
        <button className="literag-btn" onClick={onCancel} disabled={isSaving}>
          取消
        </button>
        <button
          className="literag-btn literag-btn-primary"
          onClick={onSave}
          disabled={isSaving}
        >
          {isSaving ? "⏳ 保存中..." : "💾 保存到笔记"}
        </button>
      </div>
    </div>
  );
}
