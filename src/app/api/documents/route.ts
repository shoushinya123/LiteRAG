/**
 * DELETE /api/documents?filePath=xxx
 * 按文件路径删除文档及向量索引
 */
import { NextRequest, NextResponse } from "next/server";
import { deleteByFilePath } from "@/lib/db/operations";

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get("filePath");

    if (!filePath) {
      return NextResponse.json(
        { success: false, error: "缺少 filePath 参数" },
        { status: 400 }
      );
    }

    const deletedCount = deleteByFilePath(filePath);

    return NextResponse.json({
      success: true,
      deletedCount,
      filePath,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
