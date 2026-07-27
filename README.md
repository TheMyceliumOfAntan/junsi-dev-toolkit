# Junsi Dev Toolkit

> 🛠️ 开发任务工具包 - 4 合 1 AI 开发助手

让 AI 助手同时具备**代码移植、Bug修复、新功能开发、项目知识管理**四种能力。

## ✨ 包含工具

| 工具 | 用途 | 触发词 |
|:---|:---|:---|
| 🔄 **code-migrater** | 跨语言/跨框架代码移植 | "移植"、"迁移" |
| 🐛 **diagnose-before-fix** | Bug 修复（含强制行为回测） | "报错"、"不对"、"不工作" |
| 🚀 **requirements-driven-dev** | 新功能开发 | "添加"、"新增"、"实现" |
| 📚 **project-docs** | 项目知识中枢（MCP） | "文档"、"规范"、"ADR" |

## ⚡ 一键安装

对你的 AI 助手说：

> **"帮我安装 https://github.com/TheMyceliumOfAntan/junsi-dev-toolkit"**

AI 会自动完成所有配置。

## 📦 手动安装

```bash
git clone git@github.com:TheMyceliumOfAntan/junsi-dev-toolkit.git
cd junsi-dev-toolkit
./install.sh
```

## 🔧 MCP Server 配置

`project-docs` 作为 MCP Server 运行，需要在 AI 工具中添加配置：

**opencode**：添加到 `opencode.jsonc` 的 `mcp` 字段

**Cursor/Claude**：添加到 MCP 配置文件

详见 [INSTALL.md](./INSTALL.md)。

## 🚀 快速开始

| 你想做什么 | 对 AI 说 |
|:---|:---|
| 移植代码 | "把 Java 项目移植到 Go" |
| 修复 Bug | "这个接口返回空列表了" |
| 添加功能 | "加一个导出 CSV 功能" |
| 查询文档 | "API 响应格式是什么规范？" |

## 📚 文档

- [安装指南](./INSTALL.md)
- [触发指令](./INSTALL_TRIGGER.md)

## 📄 许可证

MIT
