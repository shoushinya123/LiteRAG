# 小夏同学Lite

Obsidian AI 对话助手 —— 基于 LiteRAG 检索你的笔记，LLM 生成回答，一键保存到 Obsidian 并自动入库。

## 功能

- 🗨️ **右侧聊天面板**：React 实现，轻量不卡顿
- 🔍 **RAG 检索**：自动从你的 Obsidian 笔记中召回相关内容
- 🤖 **LLM 对话**：支持 DeepSeek / OpenAI 兼容 API
- ✏️ **编辑再保存**：调整 AI 回复后一键写入 Obsidian
- 📥 **自动入库**：保存的笔记自动提交 LiteRAG，下次对话可召回
- 🔄 **Vault 监听**：笔记变更自动同步到 LiteRAG
- ⚡ **DeepSeek 优化**：查询缓存 + 精简 prompt + token 控制

## 安装

1. 复制 `LiteRAG-Copilot` 文件夹到你的 Obsidian Vault 的 `.obsidian/plugins/` 目录
2. 安装依赖并构建：

```bash
cd .obsidian/plugins/LiteRAG-Copilot
npm install
npm run build
```

3. 在 Obsidian 中启用插件（设置 → 第三方插件 → LiteRAG Copilot）

## 前置依赖

启动 LiteRAG 服务（插件依赖它做向量检索和入库）：

```bash
git clone https://github.com/shoushinya123/LiteRAG.git
cd LiteRAG
npm install && cp .env.example .env.local
npx tsx scripts/cli.ts next-dev
```

## 配置

| 设置项 | 默认值 | 说明 |
|--------|--------|------|
| LiteRAG API 地址 | `http://localhost:3000` | RAG 检索服务地址 |
| DeepSeek API Key | (空) | 从 platform.deepseek.com 获取 |
| DeepSeek Model | `deepseek-chat` | 对话模型 |
| OpenAI API Key | (空) | OpenAI API Key |
| TopK | 5 | 检索返回条数 |
| 保存路径 | `Copilot/` | AI 回复保存目录 |

## 使用

1. 点击左侧 Ribbon 图标（💬）打开聊天面板
2. 输入问题，按 Enter 发送
3. 查看 AI 回复（含检索到的相关笔记来源）
4. 点击 ✏️ 编辑 调整内容
5. 点击 💾 保存到笔记 → 自动写入 Obsidian 并入库 LiteRAG

## 技术栈

- React 18 + TypeScript
- esbuild 打包
- Obsidian Plugin API
