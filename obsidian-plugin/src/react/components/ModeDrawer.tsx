// ============================================================
// ModeDrawer.tsx — 底部向上弹出的模式选择抽屉
// ============================================================
import type { ChatMode } from "../types";

interface Props {
  mode: ChatMode;
  onSelect: (mode: ChatMode) => void;
  onClose: () => void;
}

export function ModeDrawer({ mode, onSelect, onClose }: Props) {
  return (
    <div className="literag-mode-drawer-overlay" onClick={onClose}>
      <div className="literag-mode-drawer" onClick={(e) => e.stopPropagation()}>
        {/* 拖拽指示条 */}
        <div className="literag-drawer-handle" />

        <div className="literag-drawer-header">
          <span className="literag-drawer-title">选择对话模式</span>
          <button className="literag-drawer-close" onClick={onClose}>✕</button>
        </div>

        <div className="literag-drawer-options">
          {/* ARK 模式 */}
          <button
            className={`literag-drawer-option ${mode === "ark" ? "literag-drawer-option-active" : ""}`}
            onClick={() => { onSelect("ark"); onClose(); }}
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

          {/* Agent 模式 */}
          <button
            className={`literag-drawer-option ${mode === "agent" ? "literag-drawer-option-active" : ""}`}
            onClick={() => { onSelect("agent"); onClose(); }}
          >
            <div className="literag-drawer-option-icon">🤖</div>
            <div className="literag-drawer-option-body">
              <div className="literag-drawer-option-name">
                Agent 模式
                {mode === "agent" && <span className="literag-drawer-option-check">✓ 当前</span>}
              </div>
              <div className="literag-drawer-option-desc">
                先检索知识库，再综合回答。适合查询笔记、总结文档、引用资料。
                <span className="literag-drawer-option-hint">（LiteRAG 未连接时自动跳过检索）</span>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
