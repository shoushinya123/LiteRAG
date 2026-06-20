/**
 * MCP 模块类型导出
 */
export interface MCPToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}
