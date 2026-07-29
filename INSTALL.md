# 安装指南

## 1. 克隆仓库

```bash
git clone git@github.com:TheMyceliumOfAntan/junsi-dev-toolkit.git
cd junsi-dev-toolkit
```

## 2. 安装 Skill 文件

将 `.agents/skills/junsi-dev-toolkit/` 复制到用户的 skills 目录：

```bash
cp -r .agents/skills/junsi-dev-toolkit ~/.agents/skills/junsi-dev-toolkit
```

或者运行安装脚本：

```bash
./install.sh
```

## 3. 安装 MCP Server 依赖

```bash
pip install mcp pydantic
```

## 4. 注册 MCP Server

### opencode

在 `~/.config/opencode/opencode.jsonc` 的 `mcp` 字段中添加：

```json
"project-docs": {
  "type": "local",
  "command": ["python", "~/.agents/skills/junsi-dev-toolkit/project-docs/mcp-server.py"],
  "enabled": true
}
```

### Cursor / Claude

在 MCP 配置文件中添加：

```json
{
  "mcpServers": {
    "project-docs": {
      "command": "python",
      "args": ["${workspaceFolder}/.agents/skills/junsi-dev-toolkit/project-docs/mcp-server.py"],
      "env": { "PYTHONUNBUFFERED": "1" }
    }
  }
}
```

## 5. 初始化文档目录

```bash
mkdir -p docs/junsi-dev-docs
```

## 6. 重启 AI 工具

重启 opencode / Cursor / Claude，MCP Server 会自动连接。

## 验证

对 AI 说 "帮我查一下项目文档"，如果 AI 调用 `project-docs` MCP 工具并返回结果，说明安装成功。
