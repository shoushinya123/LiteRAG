/**
 * POST /api/ingest-batch
 * 批量文档入库接口
 */
import { NextRequest, NextResponse } from "next/server";
import { ingestBatch } from "@/lib/rag/orchestrator";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { documents } = body;

    if (!Array.isArray(documents) || documents.length === 0) {
      return NextResponse.json(
        { success: false, error: "缺少文档列表 documents" },
        { status: 400 }
      );
    }

    const result = await ingestBatch(
      documents.map((d: { content: string; filePath?: string; metadata?: Record<string, unknown> }) => ({
        content: d.content,
        options: {
          filePath: d.filePath,
          metadata: d.metadata,
        },
      }))
    );

    return NextResponse.json({
      success: result.errors.length === 0,
      totalChunks: result.totalChunks,
      errorCount: result.errors.length,
      errors: result.errors,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
