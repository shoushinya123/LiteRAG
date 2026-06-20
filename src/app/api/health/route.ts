/**
 * GET /api/health
 * 健康检查接口
 */
import { NextResponse } from "next/server";
import { isExtensionLoaded, getVectorCount } from "@/lib/db/connection";
import { checkModelAvailability } from "@/lib/models/factory";
import { config } from "@/lib/utils/config";

const startTime = Date.now();

export async function GET() {
  try {
    const modelStatus = await checkModelAvailability();

    return NextResponse.json({
      status: modelStatus.embedding ? "ok" : "error",
      database: {
        connected: isExtensionLoaded(),
        vectorCount: getVectorCount(),
        extensionLoaded: isExtensionLoaded(),
      },
      model: {
        source: config.modelSource,
        available: modelStatus.embedding,
        rerankAvailable: modelStatus.rerank,
      },
      uptime: Date.now() - startTime,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        error: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
