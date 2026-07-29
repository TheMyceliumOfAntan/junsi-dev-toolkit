---
name: junsi-dev-toolkit
description: 开发任务工具包。根据用户意图自动路由到专用子工具：移植代码 (code-migrater)、修复Bug (diagnose-before-fix)、添加新功能 (requirements-driven-dev)、文档管理 (project-docs)、上下文记忆 (memory-skill)。当用户提出开发需求时触发。
---

# Junsi 开发工具包

开发任务总入口。路由到最合适的专用子工具。

**遵守项目规范**：本技能不覆盖 AGENTS.md、opencode.md、CLAUDE.md 中的硬性要求，执行时必须同时遵守。

**及时更新文档**：任务完成后，若涉及架构/API/模块/UI 变更，需更新 `docs/` 或 `AGENTS.md`。

## 路由表（唯一门禁）

| 优先级 | 意图 | 路由 |
|--------|------|------|
| 最高 | 移植/迁移/migrate/port/跨语言/跨框架 | `code-migrater` |
| 次高 | 报错/不对/不工作/返回错误/空列表/崩溃/白屏 | `diagnose-before-fix` |
| 中高 | 记住/记录/记一下/决策/保存进度/换会话/降智 | `memory-skill` |
| 中 | 文档/规范/ADR/架构/设计/API/组件/决策记录 | `project-docs` |
| 最低 | 添加/新增/实现/加个一个新功能/页面/接口/组件 | `requirements-driven-dev` |

同时匹配多项 → 取优先级最高者。纯知识问答不触发任何子工具。

## MCP 预检（强制，直接调用，不用子代理）

路由前**直接调用** MCP 工具获取项目上下文（不加 `task()` 包装），按任务类型选择工具：

| 路由目标 | MCP 预检工具 | 目的 |
|---------|-------------|------|
| `code-migrater` | `project_tree` + `project_config` + `code_context`(关键文件) | 理解源/目标项目结构和依赖 |
| `diagnose-before-fix` | `project_tree` + 按报错位置选: `api_endpoints` / `frontend_routes` / `tauri_commands` / `hooks` / `stores` | 定位问题域 |
| `requirements-driven-dev` | `project_tree` + `project_config` + `api_endpoints` + `frontend_routes` + `component_inventory` | 了解现有架构，规划新增位置 |

`memory-skill` 和 `project-docs` 不需要预检。MCP 不可用时提示后继续，不阻塞任务。

## 工作流

```
HANDOFF 恢复(自动) → 路由宣告 → MCP 预检(直接调用，免子代理) → 转发子技能
  → 子技能执行 → 更新文档(强制) → 保存进度(自动)

降智/上下文将满 → prepare-handoff → 提示用户开新会话
```

### 路由宣告格式

```markdown
## 路由宣告
- 意图：[移植 / 修复Bug / 新功能 / 文档]
- 匹配：[关键词]
- 路由到：`./[子工具]/SKILL.md`
- MCP 预检：[已注入 / 不可用]
```

### 更新文档清单（任务完成后检查）

- [ ] 新增/修改 API → 更新 `docs/API规范/`
- [ ] 新增/修改 模块 → 更新 `docs/架构设计/`
- [ ] 新增/修改 UI 组件 → 更新 `docs/UI设计/`
- [ ] 新增/修改 架构决策 → 创建/更新 ADR
- [ ] 新增/修改 构建/运行命令 → 更新 `AGENTS.md`
- [ ] 新增/修改 依赖 → 更新 `AGENTS.md`

## 子工具

| 子工具 | 触发条件 |
|--------|----------|
| `code-migrater` | 移植/迁移任务 |
| `diagnose-before-fix` | Bug 修复 |
| `requirements-driven-dev` | 新功能开发 |
| `project-docs` | 文档操作 |
| `memory-skill` | 决策记忆/进度保存/跨会话恢复 |

## 违规范例

以下行为将被视为**未遵循本工具包指令**：

- 不澄清/不枚举原因直接写代码
- 用户提了意见直接改，不更新方案、不等确认
- 验证时说"通过"但不粘贴实际命令输出
- 改代码前不做 checkpoint
- 编译通过就当完事，不实际运行验证
- 改完不更新 docs/ 或 AGENTS.md

## 禁止

- 路由器不得自行修业务代码
- 路由器不得绕过子工具直接输出结果
- 多任务同时命中时不得并行执行
