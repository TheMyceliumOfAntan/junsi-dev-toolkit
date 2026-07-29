# Junsi Dev Toolkit

> 开发任务工具包 — AI 助手自动路由：代码移植、Bug修复、新功能开发、文档管理、任务记忆。

## 工具

| 工具 | 用途 | 触发词 |
|:---|:---|:---|
| **code-migrater** | 跨语言/跨框架代码移植 | 移植、迁移、migrate |
| **diagnose-before-fix** | Bug 修复（8步流程 + 原始复测） | 报错、不工作、崩溃、白屏 |
| **requirements-driven-dev** | 新功能开发（澄清 -> 实现 -> 验证） | 添加、新增、实现 |
| **project-docs** | 项目知识中枢（15个MCP代码感知工具） | 文档、规范、ADR、API、路由 |
| **memory-skill** | 决策记忆、进度保存、跨会话恢复 | 记住、保存进度、换会话 |

## 安装（OpenCode）

在 `opencode.jsonc` 的 `plugin` 数组添加：

```json
"junsi-dev-toolkit@git+https://github.com/TheMyceliumOfAntan/junsi-dev-toolkit.git"
```

或本地路径（克隆后）：

```json
"E:/my-skill"
```

重启 OpenCode。无需 `/skill` 调用，路由自动生效。

MCP Server 配置见 [INSTALL.md](INSTALL.md)。

## 架构

```
用户意图 → 路由表(插件自动注入) → MCP定范围(直接调MCP工具)
  → 子技能SKILL.md(按需读取) → 执行 → 更新文档 → 保存进度
```

- **MCP 定范围**：路由前直接调 MCP 工具定位目录/端点/组件/文件，子技能只在范围内精细解析。
- **MCP 工具**：`project_tree`、`api_endpoints`、`frontend_routes`、`component_inventory`、`project_config`、`tauri_commands`、`tauri_capabilities`、`api_client`、`stores`、`hooks`、`code_context`、`query_docs`、`create_adr`、`update_doc`、`generate_docs`。
- **Memory**：`.memory/` 目录持久化进度和决策，HANDOFF 支持跨会话恢复。

## 快速使用

| 你想做什么 | 对 AI 说 |
|:---|:---|
| 移植代码 | "把 Java 项目移植到 Go" |
| 修复 Bug | "这个接口返回空列表了" |
| 添加功能 | "加一个导出 CSV 功能" |
| 查询文档 | "API 响应格式是什么规范？" |
| 保存进度 | "记一下做到哪了" |

## 许可

MIT
