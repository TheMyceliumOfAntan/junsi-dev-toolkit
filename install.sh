#!/bin/bash
# Junsi Dev Toolkit 安装脚本
set -e

SKILL_DIR="$HOME/.agents/skills/junsi-dev-toolkit"
SRC_DIR="$(cd "$(dirname "$0")" && pwd)/.agents/skills/junsi-dev-toolkit"

echo "📦 安装 Junsi Dev Toolkit..."

mkdir -p "$SKILL_DIR"

for item in SKILL.md code-migrater diagnose-before-fix requirements-driven-dev project-docs shared; do
    if [ -e "$SRC_DIR/$item" ]; then
        cp -rf "$SRC_DIR/$item" "$SKILL_DIR/$item"
        echo "  ✅ $item"
    fi
done

echo ""
echo "📚 初始化文档目录..."
mkdir -p docs/junsi-dev-docs

echo ""
echo "🐍 安装 MCP Server 依赖..."
pip install mcp pydantic 2>/dev/null || echo "  ⚠️ pip 安装失败，请手动执行: pip install mcp pydantic"

echo ""
echo "✅ 安装完成！"
echo ""
echo "下一步："
echo "1. 配置 MCP Server（参见 INSTALL.md）"
echo "2. 重启 AI 工具"
