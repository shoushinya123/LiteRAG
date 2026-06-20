/**
 * 向量数据库操作
 * vec0 虚拟表的 CRUD + KNN 检索 + 混合查询
 *
 * 向量存储格式：JSON 数组字符串 '[0.1, 0.2, ...]'
 * sqlite-vec 同时支持 JSON 和二进制格式，这里选择 JSON 以确保最大兼容性
 */
import { getDb } from "./connection";
import type { DocumentMeta } from "@/types";

/** 将 number[] 转换为 sqlite-vec 的 JSON 字符串格式 */
function vectorToJson(v: number[]): string {
  return `[${v.join(",")}]`;
}

// ============================================================
// 向量插入
// ============================================================

/**
 * 批量插入向量到 vec0 虚拟表
 * 同时写入 document_chunks 表和映射表
 */
export function insertVectors(
  embeddings: number[][],
  metadatas: DocumentMeta[]
): { insertedCount: number; vectorRowIds: number[] } {
  const db = getDb();

  if (embeddings.length !== metadatas.length) {
    throw new Error(
      `向量数量(${embeddings.length})与元数据数量(${metadatas.length})不一致`
    );
  }

  const insertChunk = db.prepare(`
    INSERT INTO document_chunks (chunk_text, chunk_index, file_path, source_type, metadata_json)
    VALUES (@chunkText, @chunkIndex, @filePath, @sourceType, @metadataJson)
  `);

  const insertVector = db.prepare(`
    INSERT INTO documents (embedding)
    VALUES (?)
  `);

  const insertMap = db.prepare(`
    INSERT INTO vector_chunk_map (vector_rowid, chunk_id)
    VALUES (?, ?)
  `);

  const vectorRowIds: number[] = [];

  const transaction = db.transaction(() => {
    for (let i = 0; i < embeddings.length; i++) {
      const embedding = embeddings[i];
      const meta = metadatas[i];

      // 1. 插入文档块
      const chunkResult = insertChunk.run({
        chunkText: meta.chunkText,
        chunkIndex: meta.chunkIndex,
        filePath: meta.filePath || "",
        sourceType: "text",
        metadataJson: JSON.stringify(meta),
      });
      const chunkId = chunkResult.lastInsertRowid as number;

      // 2. 插入向量到 vec0 表（JSON 字符串格式）
      const vectorJson = vectorToJson(embedding);
      const vectorResult = insertVector.run(vectorJson);
      const vectorRowid = vectorResult.lastInsertRowid as number;

      // 3. 建立映射关系
      insertMap.run(vectorRowid, chunkId);

      vectorRowIds.push(vectorRowid);
    }
  });

  transaction();

  return {
    insertedCount: embeddings.length,
    vectorRowIds,
  };
}

// ============================================================
// KNN 向量检索
// ============================================================

/**
 * KNN 向量检索（仅向量相似度）
 * 使用 sqlite-vec 的 MATCH 操作符进行近似最近邻检索
 *
 * @param queryVector 查询向量 (1536维)
 * @param topK 返回数量
 * @param filters 元数据过滤条件
 * @returns 检索结果（含 chunk_id, chunk_text, score, 元数据）
 */
export function knnSearch(
  queryVector: number[],
  topK: number = 5,
  filters?: Record<string, string>
): Array<{
  chunkId: number;
  chunkText: string;
  score: number;
  metadata: Record<string, unknown>;
}> {
  const db = getDb();
  const queryJson = vectorToJson(queryVector);

  // sqlite-vec KNN 查询语法：
  // SELECT rowid, distance FROM documents WHERE embedding MATCH '<json>' ORDER BY distance LIMIT k
  let sql = `
    SELECT 
      d.rowid as vector_rowid,
      d.distance,
      vcm.chunk_id,
      dc.chunk_text,
      dc.file_path,
      dc.metadata_json,
      dc.created_at
    FROM documents d
    JOIN vector_chunk_map vcm ON d.rowid = vcm.vector_rowid
    JOIN document_chunks dc ON vcm.chunk_id = dc.id
  `;

  const params: unknown[] = [];

  if (filters && Object.keys(filters).length > 0) {
    const conditions: string[] = [];
    for (const [key, value] of Object.entries(filters)) {
      if (key === "file_path") {
        conditions.push(`dc.file_path = ?`);
        params.push(value);
      } else if (key === "source_type") {
        conditions.push(`dc.source_type = ?`);
        params.push(value);
      }
    }
    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(" AND ")} AND embedding MATCH ?`;
    } else {
      sql += " WHERE embedding MATCH ?";
    }
  } else {
    sql += " WHERE embedding MATCH ?";
  }

  sql += `
    ORDER BY d.distance ASC
    LIMIT ?
  `;

  params.push(queryJson);
  params.push(topK);

  const stmt = db.prepare(sql);
  const rows = stmt.all(...params) as Array<{
    vector_rowid: number;
    distance: number;
    chunk_id: number;
    chunk_text: string;
    file_path: string;
    metadata_json: string;
    created_at: string;
  }>;

  return rows.map((row) => ({
    chunkId: row.chunk_id,
    chunkText: row.chunk_text,
    // distance 越小越相似，转换为 0-1 的 score
    score: 1 / (1 + row.distance),
    metadata: {
      filePath: row.file_path,
      ...JSON.parse(row.metadata_json || "{}"),
    },
  }));
}

// ============================================================
// FTS5 关键词检索
// ============================================================

/**
 * FTS5 全文关键词检索
 * @param query 搜索关键词
 * @param topK 返回数量
 */
export function keywordSearch(
  query: string,
  topK: number = 5
): Array<{
  chunkId: number;
  chunkText: string;
  score: number;
  metadata: Record<string, unknown>;
}> {
  const db = getDb();

  const sql = `
    SELECT 
      fts.rowid as chunk_id,
      fts.rank,
      dc.chunk_text,
      dc.file_path,
      dc.metadata_json
    FROM document_chunks_fts fts
    JOIN document_chunks dc ON fts.rowid = dc.id
    WHERE document_chunks_fts MATCH ?
    ORDER BY fts.rank
    LIMIT ?
  `;

  // FTS5 MATCH 支持 AND/OR 语法
  const ftsQuery = query
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .join(" OR ");

  const rows = db.prepare(sql).all(ftsQuery, topK) as Array<{
    chunk_id: number;
    rank: number;
    chunk_text: string;
    file_path: string;
    metadata_json: string;
  }>;

  return rows.map((row) => ({
    chunkId: row.chunk_id,
    chunkText: row.chunk_text,
    // FTS5 rank 值越小越好，转换为正分数
    score: row.rank ? 1 / (1 + Math.abs(row.rank)) : 0.5,
    metadata: {
      filePath: row.file_path,
      ...JSON.parse(row.metadata_json || "{}"),
    },
  }));
}

// ============================================================
// 条件删除
// ============================================================

/**
 * 按文件路径删除文档块和向量
 */
export function deleteByFilePath(filePath: string): number {
  const db = getDb();

  const deleteMap = db.prepare(`
    DELETE FROM vector_chunk_map 
    WHERE chunk_id IN (SELECT id FROM document_chunks WHERE file_path = ?)
  `);

  const deleteVectors = db.prepare(`
    DELETE FROM documents 
    WHERE rowid IN (
      SELECT vector_rowid FROM vector_chunk_map WHERE chunk_id IN (
        SELECT id FROM document_chunks WHERE file_path = ?
      )
    )
  `);

  const deleteChunks = db.prepare(`
    DELETE FROM document_chunks WHERE file_path = ?
  `);

  const transaction = db.transaction(() => {
    deleteVectors.run(filePath);
    deleteMap.run(filePath);
    const result = deleteChunks.run(filePath);
    return result.changes;
  });

  return transaction();
}

/**
 * 清空所有数据
 */
export function clearAll(): { chunksDeleted: number; vectorsDeleted: number } {
  const db = getDb();

  const result = db.transaction(() => {
    const vectors = db.prepare("DELETE FROM documents").run();
    db.prepare("DELETE FROM vector_chunk_map").run();
    const chunks = db.prepare("DELETE FROM document_chunks").run();
    return {
      chunksDeleted: chunks.changes,
      vectorsDeleted: vectors.changes,
    };
  });

  return result();
}

/**
 * 获取数据库统计信息
 */
export function getStats(): {
  chunkCount: number;
  vectorCount: number;
  dbSizeBytes: number;
} {
  const db = getDb();
  const chunkCount = (
    db.prepare("SELECT COUNT(*) as c FROM document_chunks").get() as {
      c: number;
    }
  ).c;
  const vectorCount = (
    db.prepare("SELECT COUNT(*) as c FROM documents").get() as { c: number }
  ).c;
  const pageCount = (
    db.prepare("PRAGMA page_count").get() as { page_count: number }
  ).page_count;
  const pageSize = (
    db.prepare("PRAGMA page_size").get() as { page_size: number }
  ).page_size;

  return {
    chunkCount,
    vectorCount,
    dbSizeBytes: pageCount * pageSize,
  };
}
