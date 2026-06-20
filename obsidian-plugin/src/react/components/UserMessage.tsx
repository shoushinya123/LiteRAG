// ============================================================
// UserMessage.tsx — 用户消息气泡（支持文件引用芯片）
// ============================================================
import type { UIMessage } from "../types";

interface Props {
  message: UIMessage;
}

export function UserMessage({ message }: Props) {
  const time = new Date(message.timestamp).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="literag-message-row literag-message-row-user">
      <div className="literag-avatar literag-avatar-user">你</div>
      <div className="literag-bubble literag-bubble-user">
        {/* 文件引用芯片 */}
        {message.fileContexts && message.fileContexts.length > 0 && (
          <div className="literag-file-chips">
            {message.fileContexts.map((fc) => (
              <span key={fc.path} className="literag-file-chip" title={fc.path}>
                📄 {fc.name}
              </span>
            ))}
          </div>
        )}
        <div className="literag-bubble-meta">
          <span className="literag-bubble-name">你</span>
          <span className="literag-bubble-time">{time}</span>
        </div>
        <div className="literag-bubble-content">{message.content}</div>
      </div>
    </div>
  );
}
