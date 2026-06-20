// ============================================================
// 小夏同学Lite — Obsidian 设置面板
// ============================================================
import { App, PluginSettingTab, Setting } from "obsidian";
import type LiteRAGCopilotPlugin from "./main";
import type { LiteRAGCopilotSettings } from "./react/types";

export class LiteRAGCopilotSettingTab extends PluginSettingTab {
  plugin: LiteRAGCopilotPlugin;

  constructor(app: App, plugin: LiteRAGCopilotPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    this.renderChatModeSection(containerEl);
    this.renderLiteRAGSection(containerEl);
    this.renderLLMSection(containerEl);
    this.renderRetrievalSection(containerEl);
    this.renderSaveSection(containerEl);
    this.renderCacheSection(containerEl);
  }

  private renderChatModeSection(el: HTMLElement) {
    const s = this.plugin.settings;
    el.createEl("h2", { text: "聊天模式" });

    new Setting(el)
      .setName("默认模式")
      .setDesc("ARK：纯模型对话，不检索知识库 | Agent：检索知识库后综合回复（LiteRAG 未连接时自动跳过）")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("ark", "💬 ARK — 纯模型对话")
          .addOption("agent", "🤖 Agent — 知识库增强")
          .setValue(s.chatMode)
          .onChange(async (value) => {
            s.chatMode = value as "ark" | "agent";
            await this.plugin.saveSettings();
          })
      );
  }

  private renderLiteRAGSection(el: HTMLElement) {
    const s = this.plugin.settings;
    el.createEl("h2", { text: "LiteRAG 连接" });

    new Setting(el)
      .setName("API 地址")
      .setDesc("LiteRAG 服务的地址")
      .addText((text) =>
        text
          .setPlaceholder("http://localhost:3000")
          .setValue(s.liteRAGUrl)
          .onChange(async (value) => {
            s.liteRAGUrl = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(el)
      .setName("自动索引入库")
      .setDesc("笔记保存/修改时自动提交到 LiteRAG")
      .addToggle((toggle) =>
        toggle.setValue(s.autoIndex).onChange(async (value) => {
          s.autoIndex = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(el)
      .setName("启动时全量索引")
      .setDesc("每次打开 Obsidian 时重新索引整个 Vault")
      .addToggle((toggle) =>
        toggle.setValue(s.indexOnStartup).onChange(async (value) => {
          s.indexOnStartup = value;
          await this.plugin.saveSettings();
        })
      );
  }

  private renderLLMSection(el: HTMLElement) {
    const s = this.plugin.settings;
    el.createEl("h2", { text: "LLM 模型" });

    new Setting(el)
      .setName("提供商")
      .setDesc("DeepSeek 或 OpenAI 兼容接口")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("deepseek", "DeepSeek")
          .addOption("openai", "OpenAI 兼容")
          .setValue(s.llmProvider)
          .onChange(async (value) => {
            s.llmProvider = value as "deepseek" | "openai";
            await this.plugin.saveSettings();
            this.plugin.reloadLLMClient();
            this.display();
          })
      );

    // DeepSeek
    el.createEl("h3", { text: "DeepSeek" });
    new Setting(el)
      .setName("API 地址")
      .addText((text) =>
        text
          .setPlaceholder("https://api.deepseek.com/v1")
          .setValue(s.deepseekBaseUrl)
          .onChange(async (value) => {
            s.deepseekBaseUrl = value;
            await this.plugin.saveSettings();
          })
      );
    new Setting(el)
      .setName("API Key")
      .addText((text) =>
        text
          .setPlaceholder("sk-...")
          .setValue(s.deepseekApiKey)
          .onChange(async (value) => {
            s.deepseekApiKey = value;
            await this.plugin.saveSettings();
          })
      );
    new Setting(el)
      .setName("模型")
      .addText((text) =>
        text
          .setPlaceholder("deepseek-chat")
          .setValue(s.deepseekModel)
          .onChange(async (value) => {
            s.deepseekModel = value;
            await this.plugin.saveSettings();
          })
      );

    // OpenAI
    el.createEl("h3", { text: "OpenAI 兼容" });
    new Setting(el)
      .setName("API 地址")
      .addText((text) =>
        text
          .setPlaceholder("https://api.openai.com/v1")
          .setValue(s.openaiBaseUrl)
          .onChange(async (value) => {
            s.openaiBaseUrl = value;
            await this.plugin.saveSettings();
          })
      );
    new Setting(el)
      .setName("API Key")
      .addText((text) =>
        text
          .setPlaceholder("sk-...")
          .setValue(s.openaiApiKey)
          .onChange(async (value) => {
            s.openaiApiKey = value;
            await this.plugin.saveSettings();
          })
      );
    new Setting(el)
      .setName("模型")
      .addText((text) =>
        text
          .setPlaceholder("gpt-4o-mini")
          .setValue(s.openaiModel)
          .onChange(async (value) => {
            s.openaiModel = value;
            await this.plugin.saveSettings();
          })
      );
  }

  private renderRetrievalSection(el: HTMLElement) {
    const s = this.plugin.settings;
    el.createEl("h2", { text: "RAG 检索" });

    new Setting(el)
      .setName("返回结果数 (TopK)")
      .addSlider((slider) =>
        slider
          .setLimits(1, 20, 1)
          .setValue(s.topK)
          .setDynamicTooltip()
          .onChange(async (value) => {
            s.topK = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(el)
      .setName("混合检索")
      .setDesc("向量 + 关键词检索")
      .addToggle((toggle) =>
        toggle.setValue(s.useHybridSearch).onChange(async (value) => {
          s.useHybridSearch = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(el)
      .setName("Rerank 重排序")
      .setDesc("对检索结果二次排序（需要 Rerank 模型）")
      .addToggle((toggle) =>
        toggle.setValue(s.useRerank).onChange(async (value) => {
          s.useRerank = value;
          await this.plugin.saveSettings();
        })
      );
  }

  private renderSaveSection(el: HTMLElement) {
    const s = this.plugin.settings;
    el.createEl("h2", { text: "笔记保存" });

    new Setting(el)
      .setName("保存路径")
      .setDesc("AI 生成内容保存到 Vault 的哪个目录")
      .addText((text) =>
        text
          .setPlaceholder("Copilot/")
          .setValue(s.savePath)
          .onChange(async (value) => {
            s.savePath = value.endsWith("/") ? value : value + "/";
            await this.plugin.saveSettings();
          })
      );

    new Setting(el)
      .setName("添加 Frontmatter")
      .setDesc("保存时自动添加 YAML 元数据（created, source, tags）")
      .addToggle((toggle) =>
        toggle.setValue(s.saveWithFrontmatter).onChange(async (value) => {
          s.saveWithFrontmatter = value;
          await this.plugin.saveSettings();
        })
      );
  }

  private renderCacheSection(el: HTMLElement) {
    const s = this.plugin.settings;
    el.createEl("h2", { text: "缓存 (DeepSeek 优化)" });

    new Setting(el)
      .setName("启用查询缓存")
      .setDesc("相同问题直接返回缓存结果，节省 API 调用")
      .addToggle((toggle) =>
        toggle.setValue(s.enableEmbeddingCache).onChange(async (value) => {
          s.enableEmbeddingCache = value;
          if (!value) this.plugin.llmClient?.clearCache();
          await this.plugin.saveSettings();
        })
      );

    new Setting(el)
      .setName("最大缓存条目")
      .setDesc("LRU 淘汰策略，超过上限时移除最早的条目")
      .addSlider((slider) =>
        slider
          .setLimits(10, 1000, 10)
          .setValue(s.maxCacheEntries)
          .setDynamicTooltip()
          .onChange(async (value) => {
            s.maxCacheEntries = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
