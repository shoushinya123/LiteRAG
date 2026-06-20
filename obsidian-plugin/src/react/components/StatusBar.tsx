// ============================================================
// StatusBar.tsx — 顶部状态栏（只显示状态和模型，不含模式切换）
// ============================================================
import { useState, useEffect } from "react";
import type { ChatMode } from "../types";

interface Props {
  mode: ChatMode;
  liteRAGUrl: string;
  provider: "deepseek" | "openai";
  model: string;
  onClear: () => void;
  hasMessages: boolean;
}

export function StatusBar({ mode, liteRAGUrl, provider, model, onClear, hasMessages }: Props) {
  const [ragStatus, setRagStatus] = useState<"checking" | "online" | "offline">("checking");

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch(`${liteRAGUrl}/api/health`, {
          signal: AbortSignal.timeout(3000),
        });
        if (!cancelled) setRagStatus(res.ok ? "online" : "offline");
      } catch {
        if (!cancelled) setRagStatus("offline");
      }
    };
    check();
    const interval = setInterval(check, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [liteRAGUrl]);

  const statusLabel = ragStatus === "online" ? "已连接" : ragStatus === "checking" ? "检测中" : "未连接";

  return (
    <div className="literag-header">
      {/* 左侧：Logo + 当前模式标签 */}
      <div className="literag-header-left">
        <span style={{ fontSize: 16 }}>🌸</span>
        <span className="literag-header-title">小夏同学Lite</span>
        <span className={`literag-mode-tag ${mode}`}>
          {mode === "ark" ? "💬 ARK" : "🤖 Agent"}
        </span>
      </div>

      {/* 右侧：状态徽章 + 模型 + 清空 */}
      <div className="literag-header-right">
        {mode === "agent" && (
          <span className={`literag-status-badge literag-status-${ragStatus}`}>
            <span className={`literag-status-dot literag-status-${ragStatus}`} />
            {statusLabel}
          </span>
        )}

        <span className="literag-model-badge" title={`${provider} / ${model}`}>
          {provider === "deepseek" ? "🧠" : "🤖"} {model}
        </span>

        {hasMessages && (
          <button
            className="literag-btn literag-btn-icon"
            onClick={onClear}
            title="清空对话"
            style={{ padding: "3px 7px", fontSize: 13 }}
          >
            🗑️
          </button>
        )}
      </div>
    </div>
  );
}
