# 安装指南

## OpenCode（推荐 — Plugin）

`opencode.jsonc` 的 `plugin` 数组添加：

```json
"junsi-dev-toolkit@git+https://github.com/TheMyceliumOfAntan/junsi-dev-toolkit.git"
```

或使用本地克隆路径：

```json
"E:/my-skill"
```

重启 OpenCode。路由自动生效，无需 `/skill` 调用。

## 其他 AI 工具（Cursor / Claude Code / Codex）

### 1. 克隆仓库

```bash
git clone git@github.com:TheMyceliumOfAntan/junsi-dev-toolkit.git
```

### 2. 安装 Skill 文件

```bash
cp -r junsi-dev-toolkit/.agents/skills/junsi-dev-toolkit ~/.agents/skills/junsi-dev-toolkit
```

或运行 `./install.sh`。

### 3. 安装 MCP Server 依赖

```bash
pip install mcp pydantic
```

### 4. 注册 MCP Server

```json
{
  "mcpServers": {
    "project-docs": {
      "command": "python",
      "args": ["~/.agents/skills/junsi-dev-toolkit/project-docs/mcp-server.py"],
      "env": { "PYTHONUNBUFFERED": "1" }
    }
  }
}
```

### 5. 重启 AI 工具

## 浏览器自动化（computer-use，可选）

`opencode.json` 添加 playwright MCP 后重启：

```json
{
  "mcp": {
    "playwright": {
      "type": "local",
      "command": ["npx", "@playwright/mcp@latest"],
      "enabled": true
    }
  }
}
```

## 验证

对 AI 说"帮我查一下项目文档"或"加个功能"，如果能自动路由到对应子技能，说明安装成功。新工具验证：说"找一下处理文件的工具"（应触发 `tool-search`）；说"权衡一下这两个方案"（应路由到 `advisor`）。
