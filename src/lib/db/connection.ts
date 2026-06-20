/**
 * 数据库连接管理
 * 单例模式，自动加载 sqlite-vec 扩展
 */
import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import { resolveDatabasePath } from "@/lib/utils/platform";
import { config } from "@/lib/utils/config";
import { initSchema } from "./schema";

let db: Database.Database | null = null;
let extensionLoaded = false;

/**
 * 获取数据库单例连接
 * 首次调用时自动初始化、加载扩展、创建表
 */
export function getDb(): Database.Database {
  if (db) return db;

  const dbPath = resolveDatabasePath(config.databasePath);
  console.log(`[LiteRAG] 连接数据库: ${dbPath}`);

  db = new Database(dbPath);

  // 启用 WAL 模式以提升并发性能
  if (config.useWAL) {
    db.pragma("journal_mode = WAL");
    db.pragma("busy_timeout = 5000");
    db.pragma("cache_size = -64000"); // 64MB 缓存
    db.pragma("synchronous = NORMAL");
  }

  // 加载 sqlite-vec 扩展
  loadExtension(db);

  // 初始化数据库 Schema
  initSchema(db);

  console.log("[LiteRAG] 数据库初始化完成");
  return db;
}

/**
 * 加载 sqlite-vec 扩展
 */
function loadExtension(database: Database.Database): void {
  if (extensionLoaded) return;

  try {
    sqliteVec.load(database);
    extensionLoaded = true;
    console.log("[LiteRAG] sqlite-vec 扩展加载成功");
  } catch (error) {
    console.error("[LiteRAG] sqlite-vec 扩展加载失败:", error);
    throw new Error(
      `sqlite-vec 扩展加载失败: ${(error as Error).message}`
    );
  }
}

/**
 * 检查扩展是否已加载
 */
export function isExtensionLoaded(): boolean {
  return extensionLoaded;
}

/**
 * 关闭数据库连接
 */
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
    extensionLoaded = false;
    console.log("[LiteRAG] 数据库连接已关闭");
  }
}

/**
 * 获取向量总数
 */
export function getVectorCount(): number {
  const database = getDb();
  try {
    const row = database
      .prepare("SELECT COUNT(*) as count FROM documents")
      .get() as { count: number };
    return row.count;
  } catch {
    return 0;
  }
}
