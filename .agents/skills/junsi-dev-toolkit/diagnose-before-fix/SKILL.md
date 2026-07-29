---
name: diagnose-before-fix
description: >-
  Use when user reports ANY code problem, error, or unexpected behavior.
  **No Subagent**: bug fixes require sequential context.
  **This is a sub-tool of junsi-dev-toolkit. Do not trigger directly unless routed by junsi-dev-toolkit.**
---

# Diagnose Before Fix

修复前必须诊断、枚举可能原因、确认方向。修复后必须实际运行验证并粘贴输出。

## 核心流程（8 步，顺序执行）

### 1. 理解问题
- 读用户描述的错误/日志/堆栈
- 读相关代码，理解设计意图
- `git log --oneline -20` + `git diff HEAD~3` 检查近期改动
- 🔴 **此阶段不写代码**

无日志时：问实际 vs 预期、操作步骤、F12 Network/Console。

### 2. 枚举可能原因（≥2 个）
输出分析结果，不可脑中过一遍就跳。每个原因引用具体代码位置。

🔴 至少 2 个具体原因。只列 1 个 = 违规。

### 3. 询问修复方向
呈现原因，问用户倾向哪个。

🔴 **用户确认后才改。** 问+改在同一回复 = 没问 = 违规。

用户提出调整方向时：先更新分析/方案，问"这样可以吗？"，确认后再改。

### 4. 实施修复
🔴 **改前先 checkpoint**：`git stash` 或 `git commit -m "checkpoint: 改前快照"`。未 checkpoint 直接改代码 = 违规。

- 最小修改，不重构无关代码
- 一次只改一个因素，改完 build 再改下一个
- 每次阶段完成后创建 checkpoint

### 5. Build 验证
用项目 build 命令编译，**粘贴输出**。通过才进入下一步。

涉及后端 API → 实际调用端点验证返回结果。

### 6. 原始场景复测（强制）
用与用户报告时完全相同的操作/输入/参数运行一次。

🔴 **必须粘贴实际命令输出**，说"已复测通过"但不附输出 = 未验证。

- 不报错 ≠ 正确：确认返回内容/展示结果符合业务预期
- 记录到 `VERIFICATION_LOG.md`
- **FAIL → 回到步骤 2 重新诊断**

### 7. 提议测试场景
输出建议测试点表格。

### 8. 结果处理
- 原始场景复测通过 → 修复完成
- 输出不符合预期 → 思路问题则回滚重诊，小调整则继续
- **同一问题 3 次修复失败 → 停止修代码，讨论架构**

## 完成清单
- [ ] 修改前已 checkpoint
- [ ] 用户确认了方向
- [ ] Build 通过（有输出粘贴）
- [ ] 后端 API 已实际调用验证
- [ ] 原始场景复测通过（有输出粘贴）
- [ ] 调试日志已清理
- [ ] 文档/AGENTS.md 已更新（如需要）

🔴 有一项未完成，禁止说"修好了"。

## 引用
详见 `../shared/ai-compliance.md` 中的 Diagnose 部分和验证输出规范。
