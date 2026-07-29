# Junsi Dev Toolkit

> 开发任务工具包 — AI 助手同时具备代码移植、Bug修复、新功能开发、项目文档管理、任务记忆五种能力。

## 工具

| 工具 | 用途 | 触发词 |
|:---|:---|:---|
| **code-migrater** | 跨语言/跨框架代码移植 | 移植、迁移、migrate、port |
| **diagnose-before-fix** | Bug 修复（枚举原因 -> 用户确认 -> 改 -> 原始复测） | 报错、不对、不工作、崩溃、白屏 |
| **requirements-driven-dev** | 新功能开发（澄清 -> 实现 -> 验证） | 添加、新增、实现、加个 |
| **project-docs** | 项目知识中枢（MCP Server：15 个代码感知工具） | 文档、规范、ADR、架构、API、路由 |
| **memory-skill** | 决策记忆、进度保存、跨会话恢复（handoff） | 记住、记一下、保存进度、换会话、降智 |

## 架构

```
用户意图 → 路由表(唯一门禁) → MCP定范围(输出范围定义)
  → 子技能(只在范围内精细解析)
    → 更新文档(强制) → 保存进度(自动)
```

**MCP 预检**：路由前直接调用 MCP 工具输出范围定义（目录、端点、组件、文件），子技能只在范围内精细解析，不扫全文。支持子代理并行时也限定范围。

**MCP 代码感知工具**：`project_tree`、`api_endpoints`、`frontend_routes`、`component_inventory`、`project_config`、`tauri_commands`、`tauri_capabilities`、`api_client`、`stores`、`hooks`、`code_context`、`query_docs`、`create_adr`、`update_doc`、`generate_docs`。

**Memory 持久化**：任务进度、关键决策写入 `.memory/`，支持跨会话 HANDOFF。降智/上下文将满时自动生成交接包，开新会话恢复。

## 安装

```bash
git clone git@github.com:TheMyceliumOfAntan/junsi-dev-toolkit.git
cd junsi-dev-toolkit
./install.sh
pip install mcp pydantic
```

MCP Server 配置方法见 [INSTALL.md](INSTALL.md)。

## 快速使用

| 你想做什么 | 对 AI 说 |
|:---|:---|
| 移植代码 | "把 Java 项目移植到 Go" |
| 修复 Bug | "这个接口返回空列表了" |
| 添加功能 | "加一个导出 CSV 功能" |
| 查询文档 | "API 响应格式是什么规范？" |
| 保存进度 | "记一下做到哪了" |

## 触发指令

```
请帮我安装 junsi-dev-toolkit 开发工具包。
克隆 https://github.com/TheMyceliumOfAntan/junsi-dev-toolkit，
执行 ./install.sh，安装 pip install mcp pydantic，配置 MCP Server。
```

## 许可

MIT
