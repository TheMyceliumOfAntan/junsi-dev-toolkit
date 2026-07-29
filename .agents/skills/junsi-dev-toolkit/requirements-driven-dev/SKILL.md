---
name: requirements-driven-dev
description: Use when the user wants to add a new feature or implement a new requirement in the current project. Supports Subagent parallel mode for large (≥3 independent files) new features. **This is a sub-tool of junsi-dev-toolkit. Do not trigger directly unless routed by junsi-dev-toolkit.**
---

# Requirements-Driven Development

三个强制阶段：**CLARIFY → IMPLEMENT → VERIFY**。无阶段可跳过。

## Phase 1: CLARIFY（零模糊点才出方案）

### 1.1 复述意图
用自己的话复述：要做什么、为什么、预期结果。

### 1.2 读取相关代码
若涉及修改已有功能，先读相关代码再提问。不读代码就提问是浅的。

### 1.3 逐个澄清
一次问一个问题，直到零模糊：范围、行为、约束、优先级。

🔴 **硬性门禁**：还有任何一个未回答的问题就不得出方案。

### 1.4 UI 示意（前端/可视化工作）
涉及 UI 时，先用 ASCII/Mermaid 画示意图，用户确认布局后再讨论实现。

### 1.5 提方案
澄清完成后，提 2-3 种方案（含优缺点和推荐），每种几句话。

### 1.6 出计划 & 等确认
方案确认后出计划：改哪些文件、每个文件做什么、顺序、风险。
**用户确认后才写代码。**

### 1.7 用户提出修改意见时
**这是最常见的违规场景**：用户看完方案说"改一下"，AI 直接改代码不更新方案。

🔴 **必须**：
1. 先停下，不急着改代码
2. 更新方案描述，反映用户的修改意图
3. 输出更新后的方案，问"这样可以吗？"
4. 用户确认后才改代码

## Phase 2: IMPLEMENT

### 2.1 拆包 & 选择实施方式
拆为原子步骤，每步可独立 build 和测试。评估规模后给选项。

**Subagent 并行硬性条件（全部满足才可用）：** ≥3 个独立文件，无文件依赖，纯新增代码。

### 2.2 Subagent 并行
- 主控为每个原子包启动一个 CodeGen Subagent
- 并行上限 3，全部返回后统一 build

### 2.3 每步纪律

🔴 **改前 checkpoint**：**修改任何代码之前，先执行 `git stash` 或 `git commit -m "checkpoint: 改前快照"`。不 checkpoint 直接改代码 = 违规。**

- 实现：最小代码、匹配现有风格、不加未要求的功能
- 验证：lint → typecheck → build → 相关测试（实际运行，粘贴输出）
- 失败：诊断根因、修复、重新验证
- 进度：用 todo 跟踪，实时更新状态

### 2.4 最终集成检查
所有步骤完成后检查交互、一致性、完整性。todo 全部标记 completed。

## Phase 3: VERIFY

### 3.1 质量门禁（实际运行，粘贴输出）
- [ ] Lint 通过（粘贴命令输出）
- [ ] Typecheck 通过（粘贴命令输出）
- [ ] Build 通过（粘贴命令输出）
- [ ] 现有测试全部通过（粘贴命令输出）

🔴 **粘贴命令输出**：说"验证通过"但没贴实际结果 = 未验证。

### 3.2 提议测试场景
输出"建议验证点"表格：正常/边界/异常场景。

### 3.3 影响分析
谁调用了这段代码？改动是否破坏下游？有无未注意的副作用？

### 3.4 意图匹配
逐条对比最终结果与 Phase 1 澄清内容。不符合就修。

### 3.5 更新文档
对照根路由的「更新文档清单」检查，更新 docs/ 或 AGENTS.md。

## 完成标准（全部满足）
- [ ] Lint/Typecheck/Build 通过且有输出粘贴
- [ ] 现有测试全部通过且有输出粘贴
- [ ] 测试场景已提议并验证
- [ ] 影响分析已执行
- [ ] 结果与意图匹配
- [ ] docs/ 或 AGENTS.md 已更新

🔴 有任何一项未完成，禁止说"做完了"。

## 引用
详见 `../shared/ai-compliance.md` 中的 RDD 部分和验证输出规范。
