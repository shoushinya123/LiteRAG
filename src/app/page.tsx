/**
 * LiteRAG 首页
 * 纯 API 服务，此页面仅作为服务状态展示
 */
import { config } from "@/lib/utils/config";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-lg w-full space-y-6 text-center">
        <h1 className="text-3xl font-bold tracking-tight">LiteRAG</h1>
        <p className="text-gray-500">
          轻量级跨平台 RAG 知识库
        </p>

        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6 text-left space-y-3 text-sm font-mono">
          <div className="flex justify-between">
            <span>状态</span>
            <span className="text-green-600">运行中</span>
          </div>
          <div className="flex justify-between">
            <span>模型模式</span>
            <span>{config.modelSource}</span>
          </div>
          <div className="flex justify-between">
            <span>向量维度</span>
            <span>{config.vectorDimensions}</span>
          </div>
          <div className="flex justify-between">
            <span>数据库</span>
            <span>{config.databasePath}</span>
          </div>
        </div>

        <div className="text-sm text-gray-400 space-y-1">
          <p>API 端点:</p>
          <code className="block bg-gray-100 dark:bg-gray-800 rounded px-3 py-1 text-xs">
            POST /api/rag - RAG 检索
          </code>
          <code className="block bg-gray-100 dark:bg-gray-800 rounded px-3 py-1 text-xs">
            POST /api/ingest - 文档入库
          </code>
          <code className="block bg-gray-100 dark:bg-gray-800 rounded px-3 py-1 text-xs">
            GET /api/health - 健康检查
          </code>
        </div>

        <p className="text-xs text-gray-400">
          使用 CLI 管理: <code>npx tsx scripts/cli.ts --help</code>
        </p>
      </div>
    </main>
  );
}
