// ============================================================
// VaultSync — 监听 Obsidian Vault 变更，自动入库 LiteRAG
// 使用防抖避免频繁触发（1 秒内的多次修改只入库一次）
// 监听整个 Vault（包括所有子文件夹）
// ============================================================
import type { Vault, TAbstractFile, TFile } from "obsidian";
import { Notice } from "obsidian";
import type { LiteRAGClient } from "./LiteRAGClient";

export class VaultSync {
  private vault: Vault;
  private liteRAG: LiteRAGClient;
  private debounceMap = new Map<string, ReturnType<typeof setTimeout>>();
  private debounceMs: number;
  private enabled = false;
  private eventRefs: (() => void)[] = []; // 存储事件解绑函数

  constructor(vault: Vault, liteRAG: LiteRAGClient, debounceMs = 1000) {
    this.vault = vault;
    this.liteRAG = liteRAG;
    this.debounceMs = debounceMs;
  }

  /** 启动监听（监听整个 Vault 所有事件） */
  start() {
    if (this.enabled) return;
    this.enabled = true;

    // 文件修改
    const offModify = this.vault.on("modify", this.handleModify.bind(this));
    // 文件创建
    const offCreate = this.vault.on("create", this.handleCreate.bind(this));
    // 文件重命名（需要重新索引）
    const offRename = this.vault.on("rename", this.handleRename.bind(this));
    // 文件删除（从 LiteRAG 删除）
    const offDelete = this.vault.on("delete", this.handleDelete.bind(this));

    this.eventRefs = [offModify, offCreate, offRename, offDelete];

    console.log("[LiteRAG] VaultSync 已启动（监听整个 Vault）");
  }

  /** 停止监听 */
  stop() {
    this.enabled = false;
    // 解绑所有事件
    this.eventRefs.forEach((off) => off());
    this.eventRefs = [];
    this.debounceMap.forEach((timer) => clearTimeout(timer));
    this.debounceMap.clear();
    console.log("[LiteRAG] VaultSync 已停止");
  }

  /** 全量索引整个 Vault（包括所有子文件夹） */
  async reindexVault(onProgress?: (current: number, total: number) => void): Promise<number> {
    const files = this.vault.getMarkdownFiles();
    let indexed = 0;

    for (let i = 0; i < files.length; i++) {
      try {
        const content = await this.vault.read(files[i]);
        await this.liteRAG.ingest(content, files[i].path);
        indexed++;
        onProgress?.(i + 1, files.length);
      } catch (error) {
        console.warn(`[LiteRAG] 索引失败: ${files[i].path}`, error);
      }
    }

    return indexed;
  }

  /** 获取文件夹内所有 .md 文件（递归） */
  getFolderFiles(folderPath: string): TFile[] {
    const files = this.vault.getMarkdownFiles();
    return files.filter(
      (f) => f.path === folderPath || f.path.startsWith(folderPath + "/")
    );
  }

  private handleModify(file: TAbstractFile) {
    if (!this.shouldIndex(file)) return;
    this.debounce(file.path, () => this.indexFile(file.path));
  }

  private handleCreate(file: TAbstractFile) {
    if (!this.shouldIndex(file)) return;
    this.indexFile(file.path);
  }

  private handleRename(file: TAbstractFile, oldPath: string) {
    if (!this.shouldIndex(file)) return;
    // 重命名后重新索引（先尝试删除旧的，再索引新的）
    this.liteRAG.deleteByPath?.(oldPath).catch(() => {});
    this.indexFile(file.path);
  }

  private handleDelete(file: TAbstractFile) {
    if (!this.shouldIndex(file)) return;
    // 从 LiteRAG 删除对应文档
    this.liteRAG.deleteByPath?.(file.path).catch((err) => {
      console.warn(`[LiteRAG] 删除索引失败: ${file.path}`, err);
    });
    console.log(`[LiteRAG] 已删除索引: ${file.path}`);
  }

  private shouldIndex(file: TAbstractFile): boolean {
    return file.path.endsWith(".md");
  }

  private async indexFile(filePath: string) {
    try {
      const content = await this.vault.adapter.read(filePath);
      await this.liteRAG.ingest(content, filePath);
      console.log(`[LiteRAG] 自动入库: ${filePath}`);
    } catch (error) {
      console.warn(`[LiteRAG] 入库失败: ${filePath}`, error);
    }
  }

  private debounce(key: string, fn: () => void) {
    const existing = this.debounceMap.get(key);
    if (existing) clearTimeout(existing);

    this.debounceMap.set(
      key,
      setTimeout(() => {
        this.debounceMap.delete(key);
        fn();
      }, this.debounceMs)
    );
  }
}
