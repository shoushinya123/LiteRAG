// ============================================================
// MessageList.tsx — 消息列表
// ============================================================
import type { UIMessage, FileEditSuggestion } from "../types";
import { UserMessage } from "./UserMessage";
import { AssistantMessage } from "./AssistantMessage";
import { useEffect, useRef } from "react";

interface Props {
  messages: UIMessage[];
  onEdit: (id: string, content: string) => void;
  onSave: (id: string, content: string, title?: string) => Promise<void>;
  onApplyFileEdit: (id: string, suggestion: FileEditSuggestion) => Promise<void>;
  onDismissFileEdit: (id: string) => void;
}

export function MessageList({
  messages,
  onEdit,
  onSave,
  onApplyFileEdit,
  onDismissFileEdit,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="literag-messages">
        <div className="literag-empty">
          <div className="literag-empty-avatar">🌸</div>
          <div className="literag-empty-title">小夏同学Lite</div>
          <div className="literag-empty-desc">
            基于你的 Obsidian 笔记回答问题，<br />
            也可以发指令直接修改文件。
          </div>
          <div className="literag-empty-tips">
            <div className="literag-empty-tip">
              <span className="literag-empty-tip-icon">📎</span>
              <span>点击「引用文件」把笔记加入上下文</span>
            </div>
            <div className="literag-empty-tip">
              <span className="literag-empty-tip-icon">✏️</span>
              <span>说「修改[文件名]，加入...」直接编辑文件</span>
            </div>
            <div className="literag-empty-tip">
              <span className="literag-empty-tip-icon">💾</span>
              <span>AI 回答可一键存为新笔记并入库</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="literag-messages">
      {messages.map((msg) =>
        msg.role === "user" ? (
          <UserMessage key={msg.id} message={msg} />
        ) : (
          <AssistantMessage
            key={msg.id}
            message={msg}
            onEdit={onEdit}
            onSave={onSave}
            onApplyFileEdit={onApplyFileEdit}
            onDismissFileEdit={onDismissFileEdit}
          />
        )
      )}
      <div ref={bottomRef} />
    </div>
  );
}
