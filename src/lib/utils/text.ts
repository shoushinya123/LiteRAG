/**
 * 文本处理工具
 */

/**
 * 按字符数分割文本为多行（用于初步分块）
 */
export function splitIntoLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * 按句子边界分割文本
 */
export function splitIntoSentences(text: string): string[] {
  // 按中英文标点分割句子
  const sentenceRegex = /[^。！？.!?\n]+[。！？.!?]?/g;
  const matches = text.match(sentenceRegex);
  return (matches || [text]).map((s) => s.trim()).filter((s) => s.length > 0);
}

/**
 * 合并文本块直到接近目标大小
 * 使用贪心算法，尽可能将小句子合并成大块
 */
export function mergeChunks(
  sentences: string[],
  targetSize: number,
  overlap: number
): string[] {
  const chunks: string[] = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    if (
      currentChunk.length + sentence.length > targetSize &&
      currentChunk.length > 0
    ) {
      chunks.push(currentChunk.trim());
      // 重叠：保留最后一个句子的部分内容
      const overlapText = currentChunk.slice(-overlap);
      currentChunk = overlapText + sentence;
    } else {
      currentChunk += (currentChunk ? " " : "") + sentence;
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * 清理文本（去除多余空白、控制字符等）
 */
export function cleanText(text: string): string {
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // 移除控制字符
    .replace(/\r\n/g, "\n") // 统一换行符
    .replace(/\n{3,}/g, "\n\n") // 合并多余空行
    .trim();
}

/**
 * 提取文本统计信息
 */
export function getTextStats(text: string): {
  charCount: number;
  lineCount: number;
  wordCount: number;
} {
  const lines = text.split("\n");
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  return {
    charCount: text.length,
    lineCount: lines.length,
    wordCount: words.length,
  };
}
