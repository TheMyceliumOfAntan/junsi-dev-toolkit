---
name: requirements-driven-dev
description: Use when the user wants to add a new feature or implement a new requirement in the current project. Supports Subagent parallel mode for large (≥3 independent files) new features. **This is a sub-tool of junsi-dev-toolkit. Do not trigger directly unless routed by junsi-dev-toolkit.**
---

# RDD

三个阶段，**不可跳过、不能调换顺序**。

## 流程

```
CLARIFY（复述→澄清→方案→等确认）
    → IMPLEMENT（拆包→checkpoint→改→验证）
    → VERIFY（build→测试→影响分析→意图匹配→更新文档）
```

## 强制规则

1. **CLARIFY 阶段**：复述意图 → 逐个澄清至零模糊 → 提 ≥2 种方案 → 用户确认后才写代码
2. **用户提意见**：先更新方案、问确认，再改代码。禁止直接改。
3. **checkpoint**：首次改代码前必须 `git stash` 或 `git commit -m "checkpoint:..."`。无 checkpoint = 违规。
4. **验证**：每步验证**实际运行命令并粘贴输出**。说"验证通过"但不贴输出 = 未验证。
5. **完成**：对照完成清单逐项确认，缺任何一项不得说"做完了"。

## 完成清单

- [ ] Lint/Typecheck/Build 通过（有输出粘贴）
- [ ] 现有测试全部通过（有输出粘贴）
- [ ] 测试场景已提议并验证
- [ ] 影响分析已执行
- [ ] 结果与意图匹配
- [ ] docs/ 或 AGENTS.md 已更新
