#!/usr/bin/env node
/**
 * LiteRAG MCP Server - 独立启动脚本
 *
 * tsx 原生支持 tsconfig paths，无需额外配置。
 *
 * 在 MCP Client 中配置:
 *
 * Claude Desktop (~/Library/Application Support/Claude/claude_desktop_config.json):
 * {
 *   "mcpServers": {
 *     "literag": {
 *       "command": "npx",
 *       "args": ["tsx", "scripts/mcp-server.ts"],
 *       "cwd": "/path/to/LiteRAG"
 *     }
 *   }
 * }
 */

import * as path from "path";
import * as fs from "fs";

// 加载 .env.local
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...rest] = trimmed.split("=");
    const value = rest.join("=").replace(/^["']|["']$/g, "");
    if (key && !process.env[key]) {
      process.env[key] = value;
    }
  }
}

// 动态导入 MCP Server（tsx 自动解析 @/ 别名）
import("../src/lib/mcp/server").catch((error) => {
  console.error("MCP Server 启动失败:", error);
  process.exit(1);
});
