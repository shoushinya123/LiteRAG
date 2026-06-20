// ============================================================
// 小夏同学Lite - 全局类型定义
// ============================================================

/** 聊天模式 */
export type ChatMode = "ark" | "agent";

/** LLM 提供商 */
export type LLMProvider = "deepseek" | "openai";

/** 插件设置 */
export interface LiteRAGCopilotSettings {
  // === 聊天模式 ===
  chatMode: ChatMode;

  // === LiteRAG 连接 ===
  liteRAGUrl: string;
  autoIndex: boolean;
  indexOnStartup: boolean;

  // === LLM 配置 ===
  llmProvider: LLMProvider;
  openaiBaseUrl: string;
  openaiApiKey: string;
  openaiModel: string;

  deepseekBaseUrl: string;
  deepseekApiKey: string;
  deepseekModel: string;

  // === 检索配置 ===
  topK: number;
  useHybridSearch: boolean;
  useRerank: boolean;

  // === 笔记保存 ===
  savePath: string;
  saveWithFrontmatter: boolean;

  // === 缓存 ===
  enableEmbeddingCache: boolean;
  maxCacheEntries: number;

  // === 文件编辑 ===
  autoApplyFileEdits: boolean;
}

export const DEFAULT_SETTINGS: LiteRAGCopilotSettings = {
  chatMode: "agent",

  liteRAGUrl: "http://localhost:3000",
  autoIndex: true,
  indexOnStartup: false,

  llmProvider: "deepseek",
  openaiBaseUrl: "https://api.openai.com/v1",
  openaiApiKey: "",
  openaiModel: "gpt-4o-mini",

  deepseekBaseUrl: "https://api.deepseek.com/v1",
  deepseekApiKey: "",
  deepseekModel: "deepseek-chat",

  topK: 5,
  useHybridSearch: true,
  useRerank: true,

  savePath: "Copilot/",
  saveWithFrontmatter: true,

  enableEmbeddingCache: true,
  maxCacheEntries: 500,

  // === 文件编辑 ===
  autoApplyFileEdits: false,
};

/** RAG 检索结果 */
export interface RAGResult {
  chunkId: number;
  text: string;
  score: number;
  metadata: {
    filePath?: string;
    chunkIndex?: number;
    [key: string]: unknown;
  };
}

/** RAG 检索响应 */
export interface RAGResponse {
  success: boolean;
  results: RAGResult[];
  queryTime?: number;
  error?: string;
}

/** 入库响应 */
export interface IngestResponse {
  success: boolean;
  chunkCount?: number;
  documentId?: string;
  error?: string;
}

/** LLM 消息 */
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** LLM 响应 */
export interface LLMResponse {
  content: string;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/** 引用的文件上下文 */
export interface FileContext {
  /** vault 内的相对路径，如 "Notes/AI笔记.md" */
  path: string;
  /** 显示名称（不含扩展名） */
  name: string;
  /** 文件完整内容（读取时填入） */
  content: string;
}

/** 引用的文件夹上下文 */
export interface FolderContext {
  /** vault 内的文件夹路径，如 "Notes/AI" */
  folderPath: string;
  /** 显示名称（最后一段） */
  folderName: string;
  /** 文件夹内所有 .md 文件的内容（展开后填入） */
  files: FileContext[];
}

/** 聊天消息（UI 层） */
export interface UIMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  /** 本条消息是否跳过了 RAG（agent 模式下 LiteRAG 未连接时标记） */
  ragSkipped?: boolean;
  ragSources?: RAGResult[];
  /** 消息附带的文件引用 */
  fileContexts?: FileContext[];
  isEditing?: boolean;
  editedContent?: string;
  savedPath?: string;
  /** AI 建议的文件操作（edit 指令时填入） */
  fileEdit?: FileEditSuggestion;
}

/** AI 建议的文件编辑 */
export interface FileEditSuggestion {
  /** 目标文件路径 */
  targetPath: string;
  /** 新内容 */
  newContent: string;
  /** 操作说明 */
  description: string;
  /** 用户是否已确认 */
  confirmed?: boolean;
}

/** 向量缓存条目 */
export interface VectorCacheEntry {
  text: string;
  embedding: number[];
  timestamp: number;
}
