/**
 * 跨平台检测与适配工具
 * 处理 Windows / Linux / macOS 的文件路径和扩展加载差异
 */

import os from "os";
import path from "path";

/** 平台类型 */
export type Platform = "win32" | "linux" | "darwin";

/** 获取当前平台 */
export function getPlatform(): Platform {
  const p = os.platform();
  if (p === "win32") return "win32";
  if (p === "darwin") return "darwin";
  return "linux";
}

/**
 * 获取 sqlite-vec 扩展文件加载路径
 * sqlite-vec npm 包 (v0.1.9+) 内置预编译的扩展文件
 * 在 Node.js 环境中通过 sqliteVec.load(db) 自动加载，无需手动指定路径
 */
export function getSqliteVecLoadPath(): string | null {
  // sqlite-vec npm 包的 0.1.9+ 版本使用内置的 load 方法自动处理路径
  // 返回 null 表示使用默认自动加载机制
  return null;
}

/**
 * 获取数据库文件路径（处理跨平台路径分隔符）
 */
export function resolveDatabasePath(relativePath: string): string {
  if (path.isAbsolute(relativePath)) return relativePath;
  // 相对于项目根目录
  const projectRoot = process.cwd();
  return path.resolve(projectRoot, relativePath);
}

/**
 * 平台信息摘要
 */
export function getPlatformSummary(): Record<string, string> {
  return {
    platform: os.platform(),
    arch: os.arch(),
    release: os.release(),
    nodeVersion: process.version,
    cwd: process.cwd(),
  };
}
