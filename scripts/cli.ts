#!/usr/bin/env node
/**
 * LiteRAG CLI - 命令行管理工具
 *
 * 用法:
 *   npx tsx scripts/cli.ts ingest <file|text>        # 入库文档
 *   npx tsx scripts/cli.ts search "<query>"           # 语义检索
 *   npx tsx scripts/cli.ts stats                      # 查看统计
 *   npx tsx scripts/cli.ts clear                      # 清空数据
 *   npx tsx scripts/cli.ts serve                      # 启动 MCP Server
 *   npx tsx scripts/cli.ts health                     # 健康检查
 *   npx tsx scripts/cli.ts next-dev                   # 启动 Next.js 开发服务器
 *   npx tsx scripts/cli.ts next-start                 # 启动 Next.js 生产服务器
 */

import * as path from "path";
import * as fs from "fs";
import * as readline from "readline";

// 加载环境变量（简单版，不依赖 dotenv）
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

const command = process.argv[2];
const args = process.argv.slice(3);

async function main() {
  switch (command) {
    case "ingest":
      await cmdIngest(args);
      break;
    case "search":
      await cmdSearch(args);
      break;
    case "stats":
      await cmdStats();
      break;
    case "clear":
      await cmdClear();
      break;
    case "serve":
      await cmdServe();
      break;
    case "health":
      await cmdHealth();
      break;
    case "next-dev":
      await cmdNextDev();
      break;
    case "next-start":
      await cmdNextStart();
      break;
    default:
      printHelp();
      break;
  }
}

async function cmdIngest(args: string[]) {
  const { ingestDocument } = await import("../src/lib/rag/orchestrator");
  const { getRagStats } = await import("../src/lib/rag/orchestrator");

  if (args.length === 0) {
    console.log(
      "用法: npx tsx scripts/cli.ts ingest <file.txt|file.md|--text \"内容\">"
    );
    console.log("  npx tsx scripts/cli.ts ingest README.md");
    console.log('  npx tsx scripts/cli.ts ingest --text "这是一段测试文本"');
    process.exit(1);
  }

  if (args[0] === "--text") {
    const text = args[1];
    if (!text) {
      console.error("错误: --text 需要提供文本内容");
      process.exit(1);
    }
    console.log("正在入库文本...");
    const result = await ingestDocument(text, {
      filePath: `cli://${Date.now()}`,
    });
    console.log(`✅ 入库完成: ${result.chunkCount} 个文档块`);
  } else {
    const filePath = args[0];
    if (!fs.existsSync(filePath)) {
      console.error(`错误: 文件不存在: ${filePath}`);
      process.exit(1);
    }
    const content = fs.readFileSync(filePath, "utf-8");
    console.log(`正在入库文件: ${filePath} (${content.length} 字符)...`);
    const result = await ingestDocument(content, { filePath });
    console.log(`✅ 入库完成: ${result.chunkCount} 个文档块`);
  }

  const stats = getRagStats();
  console.log(
    `📊 知识库总计: ${stats.chunkCount} 个文档块, ${stats.vectorCount} 个向量`
  );
}

async function cmdSearch(args: string[]) {
  const { ragQuery } = await import("../src/lib/rag/orchestrator");

  const query = args.join(" ");
  if (!query.trim()) {
    console.log('用法: npx tsx scripts/cli.ts search "你的问题或关键词"');
    console.log('  npx tsx scripts/cli.ts search "什么是 RAG"');
    process.exit(1);
  }

  console.log(`🔍 检索中: "${query}"`);
  const result = await ragQuery({ query: query.trim() });

  if (!result.success) {
    console.error(`❌ 检索失败: ${result.error}`);
    process.exit(1);
  }

  console.log(
    `\n📋 找到 ${result.results.length} 条结果 (${result.queryTime}ms):\n`
  );

  result.results.forEach((r: { text: string; score: number; metadata: Record<string, unknown> }, i: number) => {
    console.log(`─── 结果 ${i + 1} (得分: ${r.score.toFixed(4)}) ───`);
    console.log(r.text.slice(0, 500) + (r.text.length > 500 ? "..." : ""));
    console.log(`  来源: ${r.metadata.filePath || "N/A"}`);
    console.log("");
  });
}

async function cmdStats() {
  const { getRagStats } = await import("../src/lib/rag/orchestrator");
  const stats = getRagStats();

  console.log("📊 LiteRAG 知识库统计:");
  console.log(`  文档块数: ${stats.chunkCount}`);
  console.log(`  向量数:   ${stats.vectorCount}`);
  console.log(`  数据库:   ${(stats.dbSizeBytes / 1024 / 1024).toFixed(2)} MB`);
}

async function cmdClear() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await new Promise<string>((resolve) => {
    rl.question("⚠️  确认清空所有数据？(yes/no): ", resolve);
  });
  rl.close();

  if (answer.toLowerCase() !== "yes") {
    console.log("已取消");
    return;
  }

  const { getDb } = await import("../src/lib/db/connection");
  const db = getDb();
  db.exec("DELETE FROM vector_chunk_map");
  db.exec("DELETE FROM documents");
  db.exec("DELETE FROM document_chunks");
  db.exec(
    "INSERT INTO document_chunks_fts(document_chunks_fts) VALUES('rebuild')"
  );
  console.log("✅ 数据已清空");
}

async function cmdServe() {
  console.log("🚀 启动 LiteRAG MCP Server...");
  await import("../src/lib/mcp/server");
}

async function cmdHealth() {
  const { isExtensionLoaded, getVectorCount } = await import(
    "../src/lib/db/connection"
  );
  const { checkModelAvailability } = await import(
    "../src/lib/models/factory"
  );
  const { config } = await import("../src/lib/utils/config");

  console.log("🩺 LiteRAG 健康检查:");
  console.log(`  扩展加载: ${isExtensionLoaded() ? "✅" : "❌"}`);
  console.log(`  向量数:   ${getVectorCount()}`);
  console.log(`  模型模式: ${config.modelSource}`);

  process.stdout.write("  模型检查: 检测中...");
  const modelStatus = await checkModelAvailability();
  console.log(
    `\r  模型检查: Embedding ${modelStatus.embedding ? "✅" : "❌"}, Rerank ${modelStatus.rerank ? "✅" : "❌"}`
  );
}

async function cmdNextDev() {
  const { spawn } = await import("child_process");
  console.log("🚀 启动 Next.js 开发服务器 (含 API)...");
  console.log("  API 端点:");
  console.log("    POST http://localhost:3000/api/rag       - RAG 检索");
  console.log("    POST http://localhost:3000/api/ingest    - 文档入库");
  console.log("    POST http://localhost:3000/api/ingest-batch - 批量入库");
  console.log("    GET  http://localhost:3000/api/health    - 健康检查");
  console.log("");

  const child = spawn("npx", ["next", "dev", "--turbopack"], {
    stdio: "inherit",
    shell: true,
  });
  child.on("exit", (code: number) => process.exit(code));
}

async function cmdNextStart() {
  const { spawn } = await import("child_process");
  console.log("🚀 启动 Next.js 生产服务器...");
  const child = spawn("npx", ["next", "start"], {
    stdio: "inherit",
    shell: true,
  });
  child.on("exit", (code: number) => process.exit(code));
}

function printHelp() {
  console.log(`
╔══════════════════════════════════════════════════╗
║        LiteRAG - 轻量级 RAG 知识库 CLI            ║
║        Next.js + SQLite + sqlite-vec              ║
╚══════════════════════════════════════════════════╝

用法: npx tsx scripts/cli.ts <command> [options]

命令:
  search <query>    语义检索知识库
  ingest <file>     入库文档 (支持 .txt .md)
  ingest --text <s> 入库纯文本
  stats             查看知识库统计信息
  clear             清空所有数据
  serve             启动 MCP Server (stdio)
  health            系统健康检查
  next-dev          启动 Next.js 开发服务器 (http://localhost:3000)
  next-start        启动 Next.js 生产服务器

示例:
  npx tsx scripts/cli.ts search "什么是向量检索"
  npx tsx scripts/cli.ts ingest README.md
  npx tsx scripts/cli.ts ingest --text "RAG 是检索增强生成技术"
  npx tsx scripts/cli.ts stats
  npx tsx scripts/cli.ts health
  npx tsx scripts/cli.ts serve
`);
}

main().catch((error: Error) => {
  console.error("CLI 执行失败:", error.message);
  process.exit(1);
});
