---
name: junsi-dev-toolkit
description: 开发任务工具包。根据用户意图自动路由到专用子工具：移植代码 (code-migrater)、修复Bug (diagnose-before-fix)、添加新功能 (requirements-driven-dev)、文档管理 (project-docs)、上下文记忆 (memory-skill)。路由由 OpenCode Plugin 代码级匹配并注入精简指令，本文件为兜底路由表。
---

# 开发任务路由（junsi-dev-toolkit Plugin）

所有开发任务先按路由表匹配，**无需 `/skill` 调用**。路由后读对应的子技能文件获取详细步骤。

> **v2.1 机制**：插件 `junsi-dev-toolkit.js` 用关键词正则对用户消息做代码级路由，命中 → 注入**对应子技能 SKILL.md 全文** + 强制路由宣告（`📌 路由宣告: {id}`）+ 强制完成清单；纯问答零注入。若注入缺失或意图复杂，按下表自行路由（LLM 兜底），并同样输出路由宣告。

## 路由表

| 优先级 | 用户意图 | 路由到 |
|--------|---------|--------|
| 最高 | 集群/多agent/并行分工/多模型 | `cluster` |
| 次高 | 移植/迁移/migrate/port/跨语言/跨框架 | `code-migrater` |
| 中高 | 报错/不对/不工作/返回错误/空列表/崩溃/白屏 | `diagnose-before-fix` |
| 中上 | advisor/顾问/权衡/利弊/方案对比/选哪个/优缺点 | `advisor` |
| 中 | 记住/记录/记一下/决策/保存进度/换会话/降智 | `memory-skill` |
| 中下 | computer_use/操作电脑/桌面自动化/浏览器自动化 | `computer-use` |
| 中低 | 文档/规范/ADR/架构/设计/API/组件/决策记录 | `project-docs` |
| 最低 | 添加/新增/实现/优化/重构/改进/加个新功能/页面/接口/组件 | `requirements-driven-dev` |

纯知识问答不触发路由。同时匹配多项取优先级最高。

## Cluster 模式

多 Agent 集群：主 Agent（`cluster`，primary 模式，Tab 切换）总体规划 → 动态检测本机可用模型（`cluster-scan-models`）→ 生成分配方案（`cluster-allocation`）→ **question 工具问用户确认** → 派发给 5 个专精 subagent（`cluster-planner`/`cluster-frontend`/`cluster-backend`/`cluster-qa`/`cluster-docs`）→ 汇总验证。

- subagent 模型按本机可用性动态注入（无 key 自动降级回退），详见 `./cluster/SKILL.md`

## 工作流

```
HANDOFF恢复(自动) → 路由宣告 → 【远程更新预检】 → MCP定范围(直接调MCP工具)
  → 读子技能SKILL.md → 执行 → 更新文档 → 保存进度
```

- **远程更新预检（各子技能必备前置）**：动手前先 `git fetch` + 查远程分支 `git log`/近期提交/`CHANGELOG`/`Release Notes`（可 `web_search` 查上游 issue/PR/发布说明），确认用户提出的问题/需求是否已被上游最新版实现或修复。**若已实现/已修复** → 提示用户"上游已提供（版本/提交 X），建议升级/改用/拉新"，给出依据，不重复实现/修复；仅当升级不适用时再自研。加功能（`requirements-driven-dev`）、修 Bug（`diagnose-before-fix`）、移植（`code-migrater`）三个子技能都把此项列为前置 Gate 0。
- **HANDOFF 恢复**：新会话插件检测 `.memory/HANDOFF.md`，自动注入恢复指令，先调 `restore-handoff` 工具。
- 降智/上下文将满 → 生成 HANDOFF（调 `prepare-handoff` 工具）→ 提示开新会话。
- 上下文压缩时插件自动注入 `.memory` 摘要。

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

## Memory 工具（插件注册，直接调用）

| 工具 | 触发时机 |
|------|---------|
| `store-decision` | **必须**：阶段确认后 / 用户说"记住、记录、方案确认" |
| `save-progress` | **必须**：VERIFY 通过后 / 用户说"保存进度" |
| `prepare-handoff` | 降智/上下文将满/用户说"换会话" |
| `restore-handoff` | 新会话检测到 HANDOFF / 用户说"恢复进度" |

工具不可用（依赖未装）时按 `memory-skill/SKILL.md` 约定格式手工写 `.memory/` 文件。

## 实用工具（插件注册，直接调用）

| 工具 | 触发时机 |
|------|---------|
| `tool-search` | 不知道用哪个工具完成任务时 / 用户说"找工具、用哪个" |
| `cron-create` | 用户说"定时提醒/每天执行/计划任务"（Windows schtasks） |

## 文档强制规则

涉及 API、架构、UI、行为变更 → **必须**调用 project-docs 的 `update_doc`/`create_adr`，禁止自己乱写文档。各子技能完成清单已含此强制项，缺一项不得宣称完成。

## 子技能文件（路由后读取详细步骤）

| 子工具 | 文件 |
|--------|------|
| `cluster` | `./cluster/SKILL.md` |
| `code-migrater` | `./code-migrater/SKILL.md` |
| `diagnose-before-fix` | `./diagnose-before-fix/SKILL.md` |
| `advisor` | `./advisor/SKILL.md` |
| `requirements-driven-dev` | `./requirements-driven-dev/SKILL.md` |
| `computer-use` | `./computer-use/SKILL.md` |
| `project-docs` | `./project-docs/SKILL.md` |
| `memory-skill` | `./memory-skill/SKILL.md` |

## 任务完成清单

- [ ] 新增/修改 API、模块、UI、架构决策 → 更新 docs/
- [ ] 新增/修改 构建命令/依赖 → 更新 AGENTS.md

## 违规范例

- 不澄清/不枚举原因直接写代码 / 用户提意见不等确认直接改
- 验证时说"通过"但不粘贴命令输出
- 改代码前不做 checkpoint / 编译通过就当完事 / 改完不更新文档
- 用 PowerShell `Set-Content`/`-replace` 改源码（破坏 UTF-8 编码，见 `shared/ai-compliance.md` 文件编辑禁忌）
