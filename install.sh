#!/bin/bash
# Junsi Dev Toolkit 安装脚本
set -e

SKILL_DIR="$HOME/.agents/skills/junsi-dev-toolkit"
SRC_DIR="$(cd "$(dirname "$0")" && pwd)/.agents/skills/junsi-dev-toolkit"

echo "[INSTALL] Junsi Dev Toolkit..."

mkdir -p "$SKILL_DIR"

for item in SKILL.md code-migrater diagnose-before-fix requirements-driven-dev project-docs memory-skill shared; do
    if [ -e "$SRC_DIR/$item" ]; then
        cp -rf "$SRC_DIR/$item" "$SKILL_DIR/$item"
        echo "  + $item"
    fi
done

echo ""
echo "[INFO] Initialize docs directory..."
mkdir -p docs/junsi-dev-docs

echo ""
echo "[INFO] Install MCP Server dependencies..."
pip install mcp pydantic 2>/dev/null || echo "  [WARN] pip install failed, run manually: pip install mcp pydantic"

echo ""
echo "[INFO] Install complete."
echo ""
echo "Next steps:"
echo "1. Configure MCP Server (see INSTALL.md)"
echo "2. Restart your AI tool"
