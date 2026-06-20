/**
 * 文档分块器 (Chunker)
 * 支持固定大小分块和语义分块两种策略
 */
import { cleanText, splitIntoSentences, mergeChunks } from "@/lib/utils/text";
import { config } from "@/lib/utils/config";
import type { TextChunk } from "@/types";

/**
 * 将文本分块
 * @param text 原始文本
 * @param chunkSize 分块大小（字符数）
 * @param chunkOverlap 重叠大小（字符数）
 * @returns 分块列表
 */
export function chunkText(
  text: string,
  chunkSize: number = config.chunkSize,
  chunkOverlap: number = config.chunkOverlap
): TextChunk[] {
  const cleaned = cleanText(text);
  if (cleaned.length === 0) return [];

  // 优先使用语义分块（按句子边界）
  const sentences = splitIntoSentences(cleaned);
  if (sentences.length <= 1) {
    // 如果只有一个句子，使用固定大小分块
    return fixedSizeChunk(cleaned, chunkSize, chunkOverlap);
  }

  // 合并句子为目标大小的块
  const mergedChunks = mergeChunks(sentences, chunkSize, chunkOverlap);

  return mergedChunks.map((chunk, index) => ({
    index,
    text: chunk,
    startChar: index > 0 ? (index - 1) * (chunkSize - chunkOverlap) : 0,
    endChar: index * (chunkSize - chunkOverlap) + chunk.length,
  }));
}

/**
 * 固定大小分块（fallback）
 */
function fixedSizeChunk(
  text: string,
  size: number,
  overlap: number
): TextChunk[] {
  const chunks: TextChunk[] = [];
  const stride = size - overlap;

  let start = 0;
  let index = 0;

  while (start < text.length) {
    const end = Math.min(start + size, text.length);
    const chunkText = text.slice(start, end).trim();

    if (chunkText.length > 0) {
      chunks.push({
        index,
        text: chunkText,
        startChar: start,
        endChar: end,
      });
      index++;
    }

    start += stride;
    if (start >= text.length) break;
  }

  return chunks;
}

/**
 * 批量分块（多文档）
 */
export function chunkDocuments(
  documents: Array<{ content: string; metadata?: Record<string, unknown> }>,
  chunkSize?: number,
  chunkOverlap?: number
): Array<{
  chunk: TextChunk;
  metadata: Record<string, unknown>;
}> {
  return documents.flatMap((doc) => {
    const chunks = chunkText(doc.content, chunkSize, chunkOverlap);
    return chunks.map((chunk) => ({
      chunk,
      metadata: {
        ...doc.metadata,
        chunkIndex: chunk.index,
        startChar: chunk.startChar,
        endChar: chunk.endChar,
      },
    }));
  });
}
