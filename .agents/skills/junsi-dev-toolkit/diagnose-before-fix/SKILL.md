---
name: diagnose-before-fix
description: >-
  Use when user reports ANY code problem, error, or unexpected behavior.
  **No Subagent**: bug fixes require sequential context.
  **This is a sub-tool of junsi-dev-toolkit. Do not trigger directly unless routed by junsi-dev-toolkit.**
---

# Diagnose Before Fix

## 流程（8 步，顺序执行）

1. **理解问题** — **MCP 范围探测（强制）**：直接调用 `project_tree` + 按报错位置选 `api_endpoints`/`frontend_routes`/`tauri_commands`/`hooks`/`stores`。不加 `task()` 包装。再读错误/日志/堆栈，读相关代码，`git log --oneline -20` 查近期改动。此阶段不写代码。
2. **枚举原因** — ≥2 个具体原因，每个引用代码位置。对比同类正常代码找差异。
3. **问方向** — 呈现原因，**用户确认后才改**。问+改在同一回复 = 没问。
4. **修复** — 改前先 `git stash` 或 `git commit -m "checkpoint:..."`。一次只改一个因素，改完 build 再改下一个。
5. **Build 验证** — 用项目 build 命令编译，**粘贴输出**。涉及 API 时实际调用端点验证。
6. **原始复测** — 用与报告时完全相同的操作/输入运行一次。**粘贴输出**。不报错 ≠ 正确，FAIL 则回步骤 2。
7. **建议测试** — 提议边界/异常测试点。
8. **收尾** — 复测通过则完成。**3 次失败 → 停止修代码，讨论架构**。

## 完成清单

- [ ] 修改前已 checkpoint
- [ ] Build 通过（粘贴输出）
- [ ] 原始场景复测通过（粘贴输出）
- [ ] 调试日志已清理
- [ ] 文档/AGENTS.md 已更新（如需要）

缺任何一项不得说"修好了"。

## Memory 集成

- **根因确认后** → 自动 `store-decision`，记录原因、修复方案和验证方法
- **完成复测后** → 自动 `save-progress`
- **感觉到降智/上下文将满** → 自动 `prepare-handoff` → 提示用户开新会话后继续
