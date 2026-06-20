/**
 * POST /api/rag
 * RAG 检索接口 - 接收查询文本，返回语义检索结果
 */
import { NextRequest, NextResponse } from "next/server";
import { ragQuery } from "@/lib/rag/orchestrator";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, topK, hybridSearch, rerank, filters } = body;

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "缺少查询参数 query" },
        { status: 400 }
      );
    }

    const response = await ragQuery({
      query: query.trim(),
      topK,
      hybridSearch,
      rerank,
      filters,
    });

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
