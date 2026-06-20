// ============================================================
// NoteWriter — 将 AI 回复写入 Obsidian vault 并自动入库 LiteRAG
// ============================================================
import type { LiteRAGCopilotSettings } from "../react/types";
import type { LiteRAGClient } from "./LiteRAGClient";
import { Notice, Vault } from "obsidian";

export class NoteWriter {
  private vault: Vault;
  private liteRAG: LiteRAGClient;
  private settings: LiteRAGCopilotSettings;

  constructor(vault: Vault, liteRAG: LiteRAGClient, settings: LiteRAGCopilotSettings) {
    this.vault = vault;
    this.liteRAG = liteRAG;
    this.settings = settings;
  }

  /**
   * 保存 AI 回复到 Obsidian 并自动入库
   * @param content 要保存的内容
   * @param title 可选标题（用于生成文件名）
   * @returns 保存的文件路径
   */
  async save(content: string, title?: string): Promise<string> {
    const savePath = this.settings.savePath;

    // 确保目录存在
    if (!(await this.vault.adapter.exists(savePath))) {
      await this.vault.createFolder(savePath);
    }

    // 生成文件名
    const fileName = title
      ? `${this.sanitizeFileName(title)}.md`
      : `AI_${this.generateTimestamp()}.md`;

    const fullPath = `${savePath}${fileName}`;

    // 构造内容（支持 frontmatter）
    let finalContent = content;
    if (this.settings.saveWithFrontmatter) {
      finalContent = [
        "---",
        `created: ${new Date().toISOString()}`,
        "source: 小夏同学Lite",
        "tags: [AI-generated]",
        "---",
        "",
        content,
      ].join("\n");
    }

    // 1. 写入 Obsidian Vault
    await this.vault.create(fullPath, finalContent);
    new Notice(`✅ 已保存: ${fullPath}`);

    // 2. 自动入库 LiteRAG
    try {
      await this.liteRAG.ingest(finalContent, fullPath);
      new Notice(`📥 已入库: ${fullPath}`);
    } catch (error) {
      console.warn("[LiteRAG] 入库失败，笔记已保存:", error);
      new Notice(`⚠️ 入库失败，笔记已保存: ${fullPath}`);
    }

    return fullPath;
  }

  /** 追加到已有笔记 */
  async append(content: string, existingPath: string): Promise<void> {
    const current = await this.vault.adapter.read(existingPath);
    const updated = current + "\n\n---\n\n" + content;
    await this.vault.adapter.write(existingPath, updated);
    new Notice(`✅ 已追加: ${existingPath}`);

    // 更新 LiteRAG 索引
    try {
      await this.liteRAG.ingest(updated, existingPath);
    } catch (error) {
      console.warn("[LiteRAG] 更新索引失败:", error);
    }
  }

  private sanitizeFileName(name: string): string {
    return name
      .replace(/[\\/:*?"<>|]/g, "-")
      .replace(/\s+/g, "_")
      .slice(0, 80)
      .trim();
  }

  private generateTimestamp(): string {
    return new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:T]/g, "-");
  }
}
