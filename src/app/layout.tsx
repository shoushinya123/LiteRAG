import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LiteRAG - 轻量级 RAG 知识库",
  description:
    "跨平台轻量 RAG 方案 - Next.js + SQLite + sqlite-vec，支持 1536 维向量检索",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
