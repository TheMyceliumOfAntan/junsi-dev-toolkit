---
name: advisor
description: 决策顾问。用户面临多个候选方案需要权衡（成本/收益/风险/兼容性），或询问"哪个方案更好/怎么选"时启用。输出权衡矩阵 + 明确推荐，question 确认后再行动。**This is a sub-tool of junsi-dev-toolkit. Do not trigger directly unless routed by junsi-dev-toolkit.**
---

# Advisor（决策顾问）

复杂决策工作流：**复述问题 → 枚举方案 → 权衡矩阵 → 推荐 → 确认 → 落地**。

## 流程

1. 复述决策问题：要选什么、约束条件、决策时效
2. 枚举 ≥2 个候选方案（含每个方案的成本/收益/风险/实施复杂度/兼容性）
3. 输出权衡矩阵（Markdown 表格：方案 × 成本 | 收益 | 风险 | 复杂度 | 兼容性）
4. 给出**明确推荐** + 理由（不推荐"视情况而定"）
5. 调 `list-decisions` 查历史决策，避免推翻已有选型；存在用户全局偏好（`save-preference`）时优先遵循
6. 用 question 工具向用户确认
7. 确认后 → **必须**调 `store-decision`（记录选型理由与舍弃方案）→ 涉及实施的进入对应子技能（requirements-driven-dev / code-migrater / diagnose-before-fix）

## 强制规则

- 必须列出被舍弃方案及其缺点（防止盲目选型）
- 不确定用哪个工具辅助 → 先调 `tool-search`
- 决策涉及 API/架构/UI 变更 → 落地后调 project-docs 的 `create_adr`
- 用户对推荐说"改一下"：先停 → 更新方案 → 问确认 → 再落地（见 shared/ai-compliance.md）
