/**
 * 数据库 Schema 定义
 * vec0 虚拟表（向量存储）+ FTS5 全文索引 + 文档块元数据表
 */
import type Database from "better-sqlite3";

export function initSchema(db: Database.Database): void {
  // ============================================================
  // 1. 文档块表：存储文档文本和元数据
  // ============================================================
  db.exec(`
    CREATE TABLE IF NOT EXISTS document_chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chunk_text TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      file_path TEXT DEFAULT '',
      source_type TEXT DEFAULT 'text',
      metadata_json TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // ============================================================
  // 2. FTS5 全文索引表：支持关键词检索
  // ============================================================
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS document_chunks_fts USING fts5(
      chunk_text,
      file_path,
      content='document_chunks',
      content_rowid='id'
    );
  `);

  // FTS5 触发器：自动同步数据
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS document_chunks_ai AFTER INSERT ON document_chunks BEGIN
      INSERT INTO document_chunks_fts(rowid, chunk_text, file_path)
      VALUES (new.id, new.chunk_text, new.file_path);
    END;
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS document_chunks_ad AFTER DELETE ON document_chunks BEGIN
      INSERT INTO document_chunks_fts(document_chunks_fts, rowid, chunk_text, file_path)
      VALUES ('delete', old.id, old.chunk_text, old.file_path);
    END;
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS document_chunks_au AFTER UPDATE ON document_chunks BEGIN
      INSERT INTO document_chunks_fts(document_chunks_fts, rowid, chunk_text, file_path)
      VALUES ('delete', old.id, old.chunk_text, old.file_path);
      INSERT INTO document_chunks_fts(rowid, chunk_text, file_path)
      VALUES (new.id, new.chunk_text, new.file_path);
    END;
  `);

  // ============================================================
  // 3. vec0 虚拟表：1536 维向量存储（核心）
  // 使用 sqlite-vec 的 vec0 虚拟表实现 ANN 检索
  // ============================================================
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS documents USING vec0(
      embedding float[1536]
    );
  `);

  // ============================================================
  // 4. 向量-文档块映射表
  // sqlite-vec 的 vec0 表通过 rowid 与普通表关联
  // 此映射表记录 vec0 rowid 与 document_chunks.id 的关系
  // ============================================================
  db.exec(`
    CREATE TABLE IF NOT EXISTS vector_chunk_map (
      vector_rowid INTEGER PRIMARY KEY,
      chunk_id INTEGER NOT NULL,
      FOREIGN KEY (chunk_id) REFERENCES document_chunks(id) ON DELETE CASCADE
    );
  `);

  // 索引加速 chunk_id 查找
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_vector_chunk_map_chunk_id 
    ON vector_chunk_map(chunk_id);
  `);

  // ============================================================
  // 5. 普通索引：加速元数据查询
  // ============================================================
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_document_chunks_file_path 
    ON document_chunks(file_path);
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_document_chunks_source_type 
    ON document_chunks(source_type);
  `);

  console.log("[LiteRAG] 数据库 Schema 初始化完成");
  logTableCounts(db);
}

/**
 * 打印各表行数（调试用）
 */
function logTableCounts(db: Database.Database): void {
  try {
    const chunks = (db.prepare("SELECT COUNT(*) as c FROM document_chunks").get() as { c: number }).c;
    const vectors = (db.prepare("SELECT COUNT(*) as c FROM documents").get() as { c: number }).c;
    console.log(
      `[LiteRAG] 当前数据: ${chunks} 个文档块, ${vectors} 个向量`
    );
  } catch {
    // 忽略统计错误
  }
}
