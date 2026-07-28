---
name: requirements-driven-dev
description: Use when the user wants to add a new feature or implement a new requirement in the current project. Supports Subagent parallel mode for large (≥3 independent files) new features. **This is a sub-tool of junsi-dev-toolkit. Do not trigger directly unless routed by junsi-dev-toolkit.**
---

# Requirements-Driven Development

> 覆盖 `brainstorming` 的代码修改任务。新项目构思走 brainstorming，本技能负责添加/修改/重构代码。

三个强制阶段：**CLARIFY → IMPLEMENT → VERIFY**。无阶段可跳过。

## Phase 1: CLARIFY（零模糊点才出方案）

### 1.1 复述意图
用自己的话复述：要做什么、为什么、预期结果。

### 1.2 读取相关代码
若涉及修改已有功能，先读相关代码再提问。不读代码就提问是浅的。

### 1.3 逐个澄清
一次问一个问题，直到零模糊：

- **范围**：改什么、不改什么
- **行为**：输入/输出、边界、错误状态
- **约束**：性能、兼容性、依赖
- **优先级**：必须做的 vs 可选的

**硬性门禁**：还有任何一个未回答的问题就不得出方案。

### 1.4 UI 示意（前端/可视化工作）
涉及 UI 时，先用 ASCII/Mermaid 画示意图，用户确认布局后再讨论实现。

### 1.5 提方案
澄清完成后，提 2-3 种方案（含优缺点和推荐），每种几句话。

### 1.6 出计划 & 等确认
方案确认后出计划：改哪些文件、每个文件做什么、顺序、风险。
用户确认后才写代码。

## Phase 2: IMPLEMENT

### 2.1 拆包 & 选择实施方式

拆为原子步骤，每步可独立 build 和测试。评估规模后给选项：

| 方式 | 适用场景 |
|------|----------|
| 当前会话直接写 | 改动 ≤2 文件，逻辑简单 |
| Subagent 并行 | ≥3 个独立文件/模块，无文件依赖，纯新增代码 |

**Subagent 并行硬性条件（全部满足才可用）：**
1. 原子包 ≥3
2. 无文件级依赖（不读写同一个文件）
3. 纯新增代码，不修改已有复杂逻辑

### 2.2 Subagent 并行（当满足条件且用户选择时）

- 主控为每个原子包启动一个 CodeGen Subagent（`task(subagent_type="general")`）
- 输入：需求描述 + 项目架构约定
- 输出：新文件完整代码 + 简要说明
- 并行上限：3
- 主控等所有 Subagent 返回后统一 build

### 2.3 每步纪律

- **改前 checkpoint**：首次修改代码前 `git stash` 或 `git commit -m "checkpoint: 改前快照"`
- **实现**：最小代码、匹配现有风格、不加未要求的功能
- **验证**：lint → typecheck → build → 相关测试
- **失败**：诊断根因、修复、重新验证
- **进度**：用 todo 跟踪，实时更新状态

### 2.4 最终集成检查

所有步骤完成后：
1. 步骤间交互是否正确？
2. 一致性和无重复代码？
3. 计划中的每一项都完成了？
4. todo 全部标记 `completed`

## Phase 3: VERIFY

### 3.1 质量门禁（实际运行，非肉眼检查）

- [ ] Lint 通过
- [ ] Typecheck 通过
- [ ] Build 通过
- [ ] 现有测试全部通过

### 3.2 提议测试场景

```markdown
## 建议验证点
1. [正常] — 输入: `...`，预期: `...`
2. [边界] — 输入: `...`，预期: `...`
3. [异常] — 输入: `...`，预期: `...`
```

### 3.3 影响分析

- 谁调用了这段代码？（搜索并输出结果）
- 改动是否破坏了下游？
- 有无未注意的副作用？

### 3.4 意图匹配

逐条对比最终结果与 Phase 1 澄清内容。不符合就修。

### 3.5 更新文档

对照根路由的「更新文档清单」检查，更新 `docs/` 或 `AGENTS.md`。

## 完成标准（全部满足）

- [ ] Lint/Typecheck/Build 通过
- [ ] 现有测试全部通过
- [ ] 测试场景已提议并验证
- [ ] 影响分析已执行
- [ ] 结果与意图匹配
- [ ] docs/ 或 AGENTS.md 已更新（如需要）

有任何一项未完成，禁止说"做完了"。

## 引用

详见 `../shared/ai-compliance.md` 中的 RDD 部分和通用陷阱。
