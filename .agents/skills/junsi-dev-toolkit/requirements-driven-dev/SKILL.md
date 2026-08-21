---
name: requirements-driven-dev
description: Use when the user wants to add a new feature or implement a new requirement in the current project. Supports Subagent parallel mode for large (≥3 independent files) new features. **This is a sub-tool of junsi-dev-toolkit. Do not trigger directly unless routed by junsi-dev-toolkit.**
---

# RDD

三个强制阶段：**CLARIFY → IMPLEMENT → VERIFY**。

## Gate 0：远程更新预检（动手前必做）

在进入任何实现阶段前，先确认目标仓库/上游**最新版是否已经把本次需求实现了**，避免重复造轮子：

- `git fetch` 拉到最新远程，`git log origin/<分支>` 看近期提交，重点查 `CHANGELOG`/`Release Notes`/PR 标题里是否提到本需求关键词（功能名、特性、能力）。
- 可 `web_search` 查上游 issue/PR/发布说明确认是否已实现。
- **若已实现/已合入**：不要重复实现；提示用户"上游已提供（版本/提交 X），建议升级/改用/拉取新版本"，并给出依据。必要时才协助做升级适配，而不是新写一套。
- 若未实现或需求是本项目私有 → 正常进入 CLARIFY → IMPLEMENT → VERIFY。
- 在阶段确认或最终总结里说明「已确认上游未实现/未包含，故自研」或「上游已实现，改用之」。

## Phase 1: CLARIFY

- **依据 MCP 范围精细解析**：在路由层注入的范围内读代码、分析模式，不扫全文。提方案前先理解范围内现有实现。
- 复述意图
- 读相关代码后再提问（不读代码就提问是浅的）
- 逐个澄清至零模糊：范围、行为、约束、优先级
- **涉及 UI 时**：先用 ASCII/Mermaid 画示意图，确认布局后再讨论实现（避免反复改浪费 token）
- 提 ≥2 种方案（含优缺点），用户确认后才写代码
- **用户提意见时**：先更新方案、问确认，再改代码。不得直接改。
- **方案确认后**：自动执行 `store-decision`，记录选型理由和舍弃方案。

## Phase 2: IMPLEMENT

- 拆为原子步骤，每步可独立 build 和测试
- **改前 checkpoint**：首次改代码前 `git stash` 或 `git commit -m "checkpoint:..."`
- 最小改动，不加未要求的功能

### Subagent 并行（节约上下文 + 加速）

当同时满足以下条件时可启动 Subagent 并行：
1. 原子包 ≥3
2. 无文件级依赖（不读写同一个文件）
3. 纯新增代码（不修改已有复杂逻辑）

每个 Subagent 的检索范围**限定在路由层注入的范围内**，不得全项目扫描。

主控为每个原子包启动一个 CodeGen Subagent，并行上限 3，全部返回后统一 build。

不满足上述条件时默认当前会话直接写。

## Phase 3: VERIFY

- [ ] Lint/Typecheck/Build 通过（**实际运行命令，粘贴输出**）
- [ ] 现有测试全部通过（粘贴输出）
- [ ] 提议测试场景并验证（正常/边界/异常）
- [ ] 影响分析：搜索调用方，确认无下游破坏
- [ ] 意图匹配：逐条对比 Phase 1 澄清与最终结果
- [ ] 方案确认后必须调用 `store-decision`（记录选型理由和舍弃方案）
- [ ] 涉及 API/架构/UI 变更必须调用 project-docs 的 `update_doc`/`create_adr`，禁止自己乱写文档
- [ ] 全部通过后必须调用 `save-progress`

缺任何一项不得说"做完了"。

## Memory 集成

- **方案确认后** → **必须**调用 `store-decision`，记录选型理由和舍弃方案
- **VERIFY 通过后** → **必须**调用 `save-progress`
- **感觉到降智/上下文将满** → 调用 `prepare-handoff` → 提示用户开新会话后继续
