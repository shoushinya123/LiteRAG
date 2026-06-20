/**
 * MCP Server - RAG 检索工具
 * 注册 3 个 MCP 工具：search_documents, ingest_document, get_stats
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ragQuery, ingestDocument, getRagStats } from "@/lib/rag/orchestrator";

/**
 * 向 MCP Server 注册 RAG 工具
 */
export function registerRagTools(server: McpServer): void {
  // ============================================================
  // 工具 1: search_documents - RAG 语义检索
  // ============================================================
  server.tool(
    "search_documents",
    "在知识库中执行 RAG 语义检索。输入自然语言查询，返回最相关的文档片段及其相关性得分。支持混合检索（向量+关键词）和重排序。",
    {
      query: z.string().describe("查询文本，可以是自然语言问题或关键词"),
      topK: z
        .number()
        .min(1)
        .max(20)
        .default(5)
        .describe("返回的最相关结果条数"),
      hybridSearch: z
        .boolean()
        .default(true)
        .describe("是否启用混合检索（向量+关键词）"),
      rerank: z
        .boolean()
        .default(true)
        .describe("是否启用 Rerank 重排序"),
    },
    async ({ query, topK, hybridSearch, rerank }) => {
      const result = await ragQuery({
        query,
        topK,
        hybridSearch,
        rerank,
      });

      if (!result.success) {
        return {
          content: [{ type: "text", text: `检索失败: ${result.error}` }],
          isError: true,
        };
      }

      const formattedResults = result.results
        .map(
          (r, i) =>
            `[${i + 1}] 得分: ${r.score.toFixed(4)}\n文本: ${r.text.slice(0, 500)}${r.text.length > 500 ? "..." : ""}\n源文件: ${r.metadata.filePath || "N/A"}`
        )
        .join("\n\n---\n\n");

      return {
        content: [
          {
            type: "text",
            text: `检索完成 (${result.queryTime}ms)，共找到 ${result.results.length} 条结果:\n\n${formattedResults}`,
          },
        ],
      };
    }
  );

  // ============================================================
  // 工具 2: ingest_document - 文档入库
  // ============================================================
  server.tool(
    "ingest_document",
    "将文档内容存入 RAG 知识库。文档会被自动分块、向量化，并建立索引供后续检索使用。",
    {
      content: z.string().describe("要入库的文档文本内容"),
      filePath: z
        .string()
        .optional()
        .describe("源文件路径（用于元数据标记）"),
      metadata: z
        .string()
        .optional()
        .describe("额外的元数据（JSON 字符串）"),
    },
    async ({ content, filePath, metadata }) => {
      let parsedMeta: Record<string, unknown> | undefined;
      if (metadata) {
        try {
          parsedMeta = JSON.parse(metadata);
        } catch {
          return {
            content: [
              { type: "text", text: "metadata 参数不是有效的 JSON 字符串" },
            ],
            isError: true,
          };
        }
      }

      const result = await ingestDocument(content, {
        filePath,
        metadata: parsedMeta,
      });

      return {
        content: [
          {
            type: "text",
            text: `文档入库成功！\n- 分块数: ${result.chunkCount}\n- 文档ID: ${result.documentId}`,
          },
        ],
      };
    }
  );

  // ============================================================
  // 工具 3: get_stats - 获取统计信息
  // ============================================================
  server.tool(
    "get_stats",
    "获取 RAG 知识库的统计信息，包括文档块数量、向量数量、数据库大小等。",
    {},
    async () => {
      const stats = getRagStats();

      return {
        content: [
          {
            type: "text",
            text: [
              "RAG 知识库统计:",
              `- 文档块数: ${stats.chunkCount}`,
              `- 向量数: ${stats.vectorCount}`,
              `- 数据库大小: ${(stats.dbSizeBytes / 1024 / 1024).toFixed(2)} MB`,
            ].join("\n"),
          },
        ],
      };
    }
  );
}
