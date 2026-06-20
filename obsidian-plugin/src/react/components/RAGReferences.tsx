// ============================================================
// RAGReferences.tsx — RAG 来源折叠卡片
// ============================================================
import { useState } from "react";
import type { RAGResult } from "../types";

interface Props {
  sources: RAGResult[];
}

export function RAGReferences({ sources }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="literag-rag-refs">
      <div
        className="literag-rag-refs-header"
        onClick={() => setExpanded(!expanded)}
      >
        <span>📚 {sources.length} 条知识引用</span>
        <span>{expanded ? "▲" : "▼"}</span>
      </div>
      {expanded && (
        <div className="literag-rag-refs-list">
          {sources.map((s, i) => {
            const fileName = s.metadata.filePath
              ? s.metadata.filePath.split("/").pop()?.replace(/\.md$/, "") || s.metadata.filePath
              : "未知文件";
            return (
              <div key={i} className="literag-rag-ref-item">
                <div className="literag-rag-ref-meta">
                  <span className="literag-rag-ref-file">📄 {fileName}</span>
                  <span className="literag-rag-ref-score">{(s.score * 100).toFixed(0)}%</span>
                </div>
                <div className="literag-rag-ref-text">{s.text}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
