---
name: diagnose-before-fix
description: >-
  Use when user reports ANY code problem, error, or unexpected behavior.
  **No Subagent**: bug fixes require sequential context.
  **This is a sub-tool of junsi-dev-toolkit. Do not trigger directly unless routed by junsi-dev-toolkit.**
---

# Diagnose Before Fix

诊断前不动手。修复后必须**粘贴实际输出**证明问题已消除。

## 流程

```
理解问题 → 枚举原因(≥2个) → 等用户确认 → checkpoint+改 → build → 原始复测 → 建议测试 → 收尾
```

## 强制规则

1. **枚举 ≥2 个具体原因**（含代码位置）。只列 1 个 = 违规。
2. **等用户确认方向后再改**。问方向 + 在同一回复里改代码 = 违规。
3. **改前 checkpoint**：`git stash` 或 `git commit -m "checkpoint:..."`。无 checkpoint = 违规。
4. **原始复测必须粘贴命令输出**。说"已复测"但不贴输出 = 未验证。
5. **复测通过才算修好**。编译通过 ≠ 修好。

## 完成清单

- [ ] 修改前已 checkpoint
- [ ] Build 通过（有输出粘贴）
- [ ] 原始场景复测通过（有输出粘贴）
- [ ] 调试日志已清理
- [ ] 文档已更新（如需要）
