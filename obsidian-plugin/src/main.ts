// ============================================================
// 小夏同学Lite — Obsidian 插件入口
// ============================================================
import { Plugin, Notice, ItemView, WorkspaceLeaf } from "obsidian";
import { DEFAULT_SETTINGS, type LiteRAGCopilotSettings } from "./react/types";
import { LiteRAGCopilotSettingTab } from "./settings";
import { LiteRAGClient } from "./services/LiteRAGClient";
import { LLMClient } from "./services/LLMClient";
import { NoteWriter } from "./services/NoteWriter";
import { VaultSync } from "./services/VaultSync";

const VIEW_TYPE = "literag-copilot-chat";

export default class LiteRAGCopilotPlugin extends Plugin {
  settings!: LiteRAGCopilotSettings;
  liteRAGClient!: LiteRAGClient;
  llmClient!: LLMClient;
  noteWriter!: NoteWriter;
  vaultSync!: VaultSync;

  async onload() {
    await this.loadSettings();

    // 初始化服务
    this.initServices();

    // 注册右侧聊天面板
    this.registerView(VIEW_TYPE, (leaf) => new ChatView(leaf, this));
    this.addRibbonIcon("message-square", "小夏同学Lite", () => {
      this.activateView();
    });

    // 命令：打开聊天
    this.addCommand({
      id: "open-chat",
      name: "打开 Copilot 聊天",
      callback: () => this.activateView(),
    });

    // 命令：全量索引入库
    this.addCommand({
      id: "reindex-vault",
      name: "全量索引当前 Vault",
      callback: () => this.reindexVault(),
    });

    // 自动同步（如果启用）
    if (this.settings.autoIndex) {
      this.vaultSync.start();
    }

    // 启动时全量索引（如果启用）
    if (this.settings.indexOnStartup) {
      this.app.workspace.onLayoutReady(() => {
        setTimeout(() => this.reindexVault(), 2000);
      });
    }

    // 添加设置面板
    this.addSettingTab(new LiteRAGCopilotSettingTab(this.app, this));

    console.log("[小夏同学Lite] 已加载");
  }

  onunload() {
    this.vaultSync?.stop();
    console.log("[小夏同学Lite] 已卸载");
  }

  private initServices() {
    this.liteRAGClient = new LiteRAGClient(this.settings.liteRAGUrl);
    this.llmClient = new LLMClient({
      provider: this.settings.llmProvider,
      openaiBaseUrl: this.settings.openaiBaseUrl,
      openaiApiKey: this.settings.openaiApiKey,
      openaiModel: this.settings.openaiModel,
      deepseekBaseUrl: this.settings.deepseekBaseUrl,
      deepseekApiKey: this.settings.deepseekApiKey,
      deepseekModel: this.settings.deepseekModel,
      maxCacheEntries: this.settings.maxCacheEntries,
    });
    this.noteWriter = new NoteWriter(
      this.app.vault,
      this.liteRAGClient,
      this.settings
    );
    this.vaultSync = new VaultSync(
      this.app.vault,
      this.liteRAGClient,
      1000
    );
  }

  /** 重建 LLM Client（设置变更时调用） */
  reloadLLMClient() {
    this.llmClient = new LLMClient({
      provider: this.settings.llmProvider,
      openaiBaseUrl: this.settings.openaiBaseUrl,
      openaiApiKey: this.settings.openaiApiKey,
      openaiModel: this.settings.openaiModel,
      deepseekBaseUrl: this.settings.deepseekBaseUrl,
      deepseekApiKey: this.settings.deepseekApiKey,
      deepseekModel: this.settings.deepseekModel,
      maxCacheEntries: this.settings.maxCacheEntries,
    });
    this.noteWriter = new NoteWriter(
      this.app.vault,
      this.liteRAGClient,
      this.settings
    );
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  private async activateView() {
    const { workspace } = this.app;
    let leaf: WorkspaceLeaf | null = workspace.getLeavesOfType(VIEW_TYPE)[0] || null;
    if (!leaf) {
      leaf = workspace.getRightLeaf(false);
      if (leaf) {
        await leaf.setViewState({ type: VIEW_TYPE, active: true });
      }
    }
    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }

  private async reindexVault() {
    new Notice("🔄 开始全量索引 Vault...");
    const count = await this.vaultSync.reindexVault((current, total) => {
      if (current % 10 === 0) {
        new Notice(`索引中... ${current}/${total}`);
      }
    });
    new Notice(`✅ 索引完成: ${count} 个文件`);
  }
}

// ============================================================
// ChatView — React 挂载到 Obsidian ItemView
// ============================================================

class ChatView extends ItemView {
  private plugin: LiteRAGCopilotPlugin;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private root: any = null;
  private container: HTMLElement | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: LiteRAGCopilotPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE;
  }

  getDisplayText(): string {
    return "小夏同学Lite";
  }

  getIcon(): string {
    return "message-square";
  }

  async onOpen() {
    this.container = this.containerEl.children[1] as HTMLElement;
    this.container.addClass("literag-chat-view");
    this.renderReact();
  }

  async onClose() {
    this.root?.unmount?.();
    this.root = null;
    this.container = null;
  }

  private async renderReact() {
    if (!this.container) return;

    // 动态导入 React（esbuild 会正确打包）
    try {
      const { createRoot } = await import("react-dom/client");
      const { createElement } = await import("react");
      const { App } = await import("./react/App");

      this.root = createRoot(this.container);
      if (this.root) {
        this.root.render(
        createElement(App, {
          app: this.plugin.app,
          liteRAG: this.plugin.liteRAGClient,
          llm: this.plugin.llmClient,
          noteWriter: this.plugin.noteWriter,
          settings: this.plugin.settings,
          onSettingsChange: async () => {
            await this.plugin.saveSettings();
          },
          onWriteFile: async (path: string, content: string) => {
            const file = this.plugin.app.vault.getAbstractFileByPath(path);
            if (file) {
              // 文件存在，修改内容
              const { TFile } = await import("obsidian");
              if (file instanceof TFile) {
                await this.plugin.app.vault.modify(file, content);
              }
            } else {
              // 文件不存在，创建
              await this.plugin.app.vault.create(path, content);
            }
          },
        })
      );
      }
    } catch (err) {
      console.error("[LiteRAG] React 渲染失败:", err);
      if (this.container) {
        this.container.createEl("div", {
          text: "React 加载失败，请重新打开此面板。错误: " + (err as Error).message,
        });
      }
    }
  }
}
