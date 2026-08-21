# 安装指南

## OpenCode（推荐 — Plugin）

### 1. 安装插件

`opencode.jsonc` 的 `plugin` 数组添加：

```json
"junsi-dev-toolkit@git+https://github.com/TheMyceliumOfAntan/junsi-dev-toolkit.git"
```

或使用本地克隆路径：

```json
"E:/my-skill"
```

### 2. 注册 MCP（必装：project-docs + wsl-pentest）

两个 MCP 都是工具包核心能力，缺一不可。在 `opencode.jsonc` 的 `mcp` 中添加（路径替换为插件实际安装路径）：

```json
{
  "mcp": {
    "project-docs": {
      "type": "local",
      "command": ["python", "<junsi-dev-toolkit 安装路径>/.agents/skills/junsi-dev-toolkit/project-docs/mcp-server.py"],
      "enabled": true
    },
    "wsl-pentest": {
      "type": "local",
      "command": ["node", "<junsi-dev-toolkit 安装路径>/.agents/skills/junsi-dev-toolkit/penetration-testing/mcp-wsl-tools.mjs"],
      "enabled": true
    }
  }
}
```

前置：
- `project-docs`（项目知识中枢，15 个代码感知/文档工具）：Python 3 + `pip install mcp pydantic`
- `wsl-pentest`（渗透测试工具封装）：Windows 需 WSL（`wsl --install`），渗透工具可在会话内经 `wsl-install` 安装；Linux 等自带 bash 的系统直接本机执行，无需 WSL。环境不可用时工具返回 `WSL_NOT_AVAILABLE`，按提示警告用户并回退 pwsh 同类工具

### 3. 重启 OpenCode

路由自动生效，无需 `/skill` 调用。

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

> 桌面级操作（整个屏幕 + 鼠标键盘）需另配第三方 computer-use MCP（如 `@zavora-ai/computer-use-mcp`，experimental）。⚠️ Anthropic 官方未发布 npm 包，`@anthropic-ai/mcp-server-computer-use` 在 registry 不存在（404），详见 `computer-use` 子技能。

## Penetration 模式（渗透测试）

Tab 切换到 `penetration` agent 起专属渗透测试会话：按 OWASP WSTG 8 阶段经 WSL 渗透工具执行，报告以 Markdown 写入 `docs/penetration-reports/YYYY-MM-DD-<目标slug>.md`。

- MCP 注册见上方「注册 wsl-pentest MCP（必装）」；未配置时自动回退 bash 执行 `wsl -e bash -c "<命令>"`。
- ⚠️ **仅对您拥有或已获书面授权的系统进行测试**；除报告目录外不得修改任何文件。

## 验证

对 AI 说"帮我查一下项目文档"或"加个功能"，如果能自动路由到对应子技能，说明安装成功。新工具验证：说"找一下处理文件的工具"（应触发 `tool-search`）；说"权衡一下这两个方案"（应路由到 `advisor`）。
