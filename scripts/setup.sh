#!/usr/bin/env bash
# ============================================================
# LiteRAG 跨平台初始化脚本
# 自动检测系统环境，安装依赖，初始化数据库
# ============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "╔══════════════════════════════════════════════════╗"
echo "║        LiteRAG - 跨平台轻量 RAG 方案初始化          ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# 检测平台
detect_platform() {
  case "$(uname -s)" in
    Linux*)     PLATFORM="linux" ;;
    Darwin*)    PLATFORM="macos" ;;
    CYGWIN*|MINGW*|MSYS*) PLATFORM="windows" ;;
    *)          PLATFORM="unknown" ;;
  esac
  echo "  检测平台: $PLATFORM"
}

# 检查 Node.js
check_node() {
  if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo "  Node.js:   $NODE_VERSION ✅"
  else
    echo "  Node.js:   未安装 ❌"
    echo "  请安装 Node.js 18+: https://nodejs.org/"
    exit 1
  fi
}

# 检查 Python (better-sqlite3 编译需要)
check_python() {
  if command -v python3 &> /dev/null; then
    echo "  Python:    $(python3 --version) ✅"
  elif command -v python &> /dev/null; then
    echo "  Python:    $(python --version) ✅"
  else
    echo "  Python:    未安装 ⚠️  (better-sqlite3 编译可能需要)"
  fi
}

# 安装 npm 依赖
install_deps() {
  echo ""
  echo "📦 安装依赖..."
  cd "$PROJECT_DIR"

  if command -v pnpm &> /dev/null; then
    pnpm install
  else
    npm install
  fi
}

# 配置环境变量
setup_env() {
  echo ""
  echo "🔧 配置环境变量..."
  cd "$PROJECT_DIR"

  if [ ! -f .env.local ]; then
    cp .env.example .env.local
    echo "  已创建 .env.local (从 .env.example 复制)"
    echo "  ⚠️  请编辑 .env.local 配置 API 密钥和模型参数"
  else
    echo "  .env.local 已存在，跳过"
  fi
}

# 初始化数据库目录
init_data() {
  echo ""
  echo "📂 初始化数据目录..."
  mkdir -p "$PROJECT_DIR/data"
  echo "  data/ 目录已就绪"
}

# 验证安装
verify() {
  echo ""
  echo "🔍 验证安装..."
  cd "$PROJECT_DIR"

  if npx tsx scripts/cli.ts health 2>&1; then
    echo ""
    echo "🎉 LiteRAG 初始化完成！"
    echo ""
    echo "快速开始:"
    echo "  npx tsx scripts/cli.ts --help"
  else
    echo ""
    echo "⚠️  初始化完成，但健康检查未通过。"
    echo "  请检查 .env.local 配置是否正确。"
  fi
}

# 主流程
main() {
  detect_platform
  check_node
  check_python
  install_deps
  setup_env
  init_data
  verify
}

main "$@"
