/**
 * POST /api/ingest
 * 文档入库接口
 */
import { NextRequest, NextResponse } from "next/server";
import { ingestDocument } from "@/lib/rag/orchestrator";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content, metadata, filePath, chunkSize, chunkOverlap } = body;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "缺少文档内容 content" },
        { status: 400 }
      );
    }

    const result = await ingestDocument(content, {
      filePath,
      metadata,
      chunkSize,
      chunkOverlap,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
