---
name: requirements-driven-dev
description: Use when the user wants to add a new feature or implement a new requirement in the current project. Supports Subagent parallel mode for large (≥3 independent files) new features. **This is a sub-tool of junsi-dev-toolkit. Do not trigger directly unless routed by junsi-dev-toolkit.**
---

# RDD

三个强制阶段：**CLARIFY → IMPLEMENT → VERIFY**。

## Phase 1: CLARIFY

- 复述意图
- 读相关代码后再提问（不读代码就提问是浅的）
- 逐个澄清至零模糊：范围、行为、约束、优先级
- **涉及 UI 时**：先用 ASCII/Mermaid 画示意图，确认布局后再讨论实现（避免反复改浪费 token）
- 提 ≥2 种方案（含优缺点），用户确认后才写代码
- **用户提意见时**：先更新方案、问确认，再改代码。不得直接改。

## Phase 2: IMPLEMENT

- 拆为原子步骤，每步可独立 build 和测试
- **改前 checkpoint**：首次改代码前 `git stash` 或 `git commit -m "checkpoint:..."`
- 最小改动，不加未要求的功能

### Subagent 并行（节约上下文 + 加速）

当同时满足以下条件时可启动 Subagent 并行：
1. 原子包 ≥3
2. 无文件级依赖（不读写同一个文件）
3. 纯新增代码（不修改已有复杂逻辑）

主控为每个原子包启动一个 CodeGen Subagent，并行上限 3，全部返回后统一 build。

不满足上述条件时默认当前会话直接写。

## Phase 3: VERIFY

- [ ] Lint/Typecheck/Build 通过（**实际运行命令，粘贴输出**）
- [ ] 现有测试全部通过（粘贴输出）
- [ ] 提议测试场景并验证（正常/边界/异常）
- [ ] 影响分析：搜索调用方，确认无下游破坏
- [ ] 意图匹配：逐条对比 Phase 1 澄清与最终结果
- [ ] docs/ 或 AGENTS.md 已更新

缺任何一项不得说"做完了"。
