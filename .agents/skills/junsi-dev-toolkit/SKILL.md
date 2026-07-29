---
name: junsi-dev-toolkit
description: 开发任务工具包。根据用户意图自动路由到专用子工具：移植代码 (code-migrater)、修复Bug (diagnose-before-fix)、添加新功能 (requirements-driven-dev)、文档管理 (project-docs)、上下文记忆 (memory-skill)。路由表由 OpenCode Plugin 自动注入，始终生效。
---

# 开发任务路由（junsi-dev-toolkit Plugin）

所有开发任务先按路由表匹配，**无需 `/skill` 调用**。路由后读对应的子技能文件获取详细步骤。

## 路由表

| 优先级 | 用户意图 | 路由到 |
|--------|---------|--------|
| 最高 | 移植/迁移/migrate/port/跨语言/跨框架 | `code-migrater` |
| 次高 | 报错/不对/不工作/返回错误/空列表/崩溃/白屏 | `diagnose-before-fix` |
| 中高 | 记住/记录/记一下/决策/保存进度/换会话/降智 | `memory-skill` |
| 中 | 文档/规范/ADR/架构/设计/API/组件/决策记录 | `project-docs` |
| 最低 | 添加/新增/实现/加个一个新功能/页面/接口/组件 | `requirements-driven-dev` |

纯知识问答不触发路由。同时匹配多项取优先级最高。

## 工作流

```
HANDOFF恢复(自动) → 路由宣告 → MCP定范围(直接调MCP工具)
  → 读子技能SKILL.md → 执行 → 更新文档 → 保存进度
```

降智/上下文将满 → 生成 HANDOFF → 提示开新会话

## MCP 定范围

路由前直接调 MCP 工具定位范围（不用 task() 子代理）：

| 路由 | MCP 工具 |
|------|---------|
| `code-migrater` | `project_tree` + `project_config` + `code_context`(关键文件) |
| `diagnose-before-fix` | `project_tree` + 按报错位置选 `api_endpoints`/`frontend_routes`/`tauri_commands`/`hooks`/`stores` |
| `requirements-driven-dev` | `project_tree` + `project_config` + `api_endpoints` + `frontend_routes` + `component_inventory` |

`memory-skill` 和 `project-docs` 不需要定范围。MCP 不可用时提示后继续。

输出范围定义：
```
📌 范围
- 目录：{path1}, {path2}
- 端点：{GET /api/xxx}
- 组件：{ComponentA}
- 文件：{file1.tsx, file2.cs}
- 约束：{关键约束}
```

子技能和子代理**只在范围内精细解析**，不扫全文。

## 子技能文件（路由后读取详细步骤）

| 子工具 | 文件 |
|--------|------|
| `code-migrater` | `./code-migrater/SKILL.md` |
| `diagnose-before-fix` | `./diagnose-before-fix/SKILL.md` |
| `requirements-driven-dev` | `./requirements-driven-dev/SKILL.md` |
| `project-docs` | `./project-docs/SKILL.md` |
| `memory-skill` | `./memory-skill/SKILL.md` |

## 任务完成清单

- [ ] 新增/修改 API、模块、UI、架构决策 → 更新 docs/
- [ ] 新增/修改 构建命令/依赖 → 更新 AGENTS.md

## 违规范例

- 不澄清/不枚举原因直接写代码 / 用户提意见不等确认直接改
- 验证时说"通过"但不粘贴命令输出
- 改代码前不做 checkpoint / 编译通过就当完事 / 改完不更新文档
