/**
 * MCP Server 入口
 * 通过 stdio 传输，可被 MCP Client 发现和调用
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerRagTools } from "./tools";
import { getDb } from "@/lib/db/connection";
import { config } from "@/lib/utils/config";

// 初始化数据库（确保扩展加载和表创建）
getDb();

// 创建 MCP Server
const server = new McpServer({
  name: "LiteRAG",
  version: "0.1.0",
  description: "轻量级跨平台 RAG 知识库 - 支持 1536 维向量语义检索",
});

// 注册 RAG 工具
registerRagTools(server);

// 启动 stdio 传输
async function startMcpServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `[LiteRAG MCP] Server started (model: ${config.modelSource})`
  );
}

startMcpServer().catch((error) => {
  console.error("[LiteRAG MCP] Failed to start:", error);
  process.exit(1);
});
