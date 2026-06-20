/**
 * 向量序列化工具
 * 在 Float32Array 和 Buffer 之间转换，用于 sqlite-vec 的 BLOB 存储
 */

/**
 * Float32Array 转换为 Buffer（用于写入 sqlite-vec）
 * sqlite-vec 期望的 BLOB 格式是原始 float32 字节
 */
export function floatArrayToBuffer(arr: number[]): Buffer {
  const float32 = new Float32Array(arr);
  return Buffer.from(float32.buffer);
}

/**
 * Buffer 转换为 number[]（从 sqlite-vec 读取）
 */
export function bufferToFloatArray(buf: Buffer): number[] {
  const float32 = new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
  return Array.from(float32);
}

/**
 * 计算两个向量的余弦相似度
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(
      `向量维度不一致: ${a.length} vs ${b.length}`
    );
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * 验证向量维度是否正确
 */
export function validateVectorDimensions(
  vector: number[],
  expectedDim: number
): void {
  if (vector.length !== expectedDim) {
    throw new Error(
      `向量维度错误: 期望 ${expectedDim}，实际 ${vector.length}`
    );
  }
}

/**
 * 批量验证向量维度
 */
export function validateVectors(
  vectors: number[][],
  expectedDim: number
): void {
  for (let i = 0; i < vectors.length; i++) {
    validateVectorDimensions(vectors[i], expectedDim);
  }
}
