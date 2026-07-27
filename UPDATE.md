# Junsi Dev Toolkit 更新指南（从旧版升级到 MCP 版）

> 本文档由 AI 自动执行。用户已说"请按照此文件更新"，请严格按以下步骤操作。

## 更新前检查

1. 确认当前项目根目录下存在 `.agents/skills/junsi-dev-toolkit/` 文件夹。
2. 确认用户使用的是支持 Skill 的 IDE（Cursor / Claude Code / Codex / OpenCode）。

**如果以上任意一项不满足，请提示用户并退出。**

## 自动更新流程

### 步骤 1：备份旧版本（安全措施）

```bash
cp -r .agents/skills/junsi-dev-toolkit .agents/skills/junsi-dev-toolkit.backup.$(date +%Y%m%d%H%M%S)
```

### 步骤 2：拉取最新版本

```bash
cd .agents/skills

if [ -d "junsi-dev-toolkit/.git" ]; then
    cd junsi-dev-toolkit
    git pull origin main
    cd ..
else
    rm -rf junsi-dev-toolkit
    git clone https://github.com/TheMyceliumOfAntan/junsi-dev-toolkit.git
fi
cd ..
```

AI 操作指引：
- 如果用户没有安装 git，提示安装或手动下载 ZIP。
- 如果用户有 git，直接执行拉取。

### 步骤 3：安装新增的 Python 依赖（MCP Server）

```bash
cd .agents/skills/junsi-dev-toolkit/project-docs

if [ -f "requirements.txt" ]; then
    if [ -d "../../../../.venv" ]; then
        source ../../../../.venv/bin/activate  # Windows: .venv\Scripts\activate
    fi
    pip install -r requirements.txt
else
    echo "⚠️ requirements.txt 缺失，跳过依赖安装"
fi

cd ../../../..
```

AI 操作指引：
- 如果用户已有虚拟环境，使用它；否则询问是否创建。
- 如果 pip install 失败，提示用户手动安装 mcp 包。

### 步骤 4：配置 MCP Server（新增步骤）

根据用户使用的 IDE，在对应位置添加或更新 MCP 配置：

**检测 IDE 类型**：
- 检查是否存在 `~/.cursor/mcp.json` → Cursor
- 检查是否存在 `~/.claude/mcp.json` → Claude Code
- 检查是否存在 `~/.codex/config.json` → Codex
- 如果无法检测，询问用户使用哪种 IDE。

**配置内容**，在 MCP 配置文件中添加（或合并）以下条目：

```json
{
  "mcpServers": {
    "project-docs": {
      "command": "python",
      "args": [
        "${workspaceFolder}/.agents/skills/junsi-dev-toolkit/project-docs/mcp_server.py"
      ],
      "env": {
        "PYTHONUNBUFFERED": "1"
      }
    }
  }
}
```

AI 操作指引：
- 如果配置文件不存在，创建它。
- 如果已存在，读取并合并 project-docs 条目，保留其他配置。
- 确认路径中的 `${workspaceFolder}` 能正确解析。

### 步骤 5：验证更新

```bash
ls .agents/skills/junsi-dev-toolkit/SKILL.md && echo "✅ 路由器存在"
ls .agents/skills/junsi-dev-toolkit/project-docs/mcp_server.py && echo "✅ MCP Server 存在"
python -c "import mcp" 2>/dev/null && echo "✅ MCP 依赖已安装" || echo "⚠️ MCP 依赖未安装，请运行 pip install mcp"
```

AI 操作指引：
- 输出验证结果。
- 如果有失败项，给出修复建议。

### 步骤 6：清理备份（可选）

```bash
read -p "更新成功，是否删除备份文件？(y/N) " -n 1 -r
if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -rf .agents/skills/junsi-dev-toolkit.backup.*
    echo "✅ 备份已删除"
else
    echo "📁 备份保留在 .agents/skills/ 下，可手动删除"
fi
```

## 更新后验证

在 IDE 对话中输入：

> "帮我查一下项目文档"

如果看到路由宣告并返回文档列表，说明 MCP 配置成功，更新完成！

## 故障排除

| 问题 | 解决方案 |
|:---|:---|
| git pull 失败 | 手动下载 ZIP 替换 `.agents/skills/junsi-dev-toolkit` |
| pip install 失败 | 手动运行 `pip install mcp` |
| MCP Server 启动失败 | 检查 Python 版本是否 3.10+，`python` 命令是否可用 |
| 找不到 MCP 配置路径 | 手动在 IDE 设置中添加 MCP Server 配置 |
| 更新后原 Skill 无法使用 | 重启 IDE 后再试 |

## 更新完成！

恭喜！你的 Junsi Dev Toolkit 已升级到最新 MCP 版本。

现在你可以享受：
- 📚 项目知识中枢自动挂载
- 🔄 强制上下文注入，不再需要手动查文档
- 🚀 更快的响应速度（MCP 零开销）

开始使用吧！
