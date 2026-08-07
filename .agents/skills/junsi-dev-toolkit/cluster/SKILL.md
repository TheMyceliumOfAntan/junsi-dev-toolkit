---
name: cluster
description: Cluster 模式 — Agent 集群。主 Agent 统筹规划、细化需求，按任务类型分块派发给不同专精模型的 Subagent 并行执行，最后汇总验证。**This is a sub-tool of junsi-dev-toolkit. Do not trigger directly unless routed by junsi-dev-toolkit.**
---

# Cluster 模式：Agent 集群

> 一个主 Agent 当"项目经理"：总体规划 → 细化需求 → 任务分块 → 按专精模型派发给 Subagent → 汇总验证。

## 强制路由宣告

收到任务后回复开头必须输出 `📌 路由宣告: cluster`，未输出视为违规。

## 工作流（7 步，顺序执行）

### 步骤 1：总体规划

1. 复述任务意图，用 MCP 工具定范围（`project_tree`/`project_config`/`api_endpoints`/`component_inventory`）
2. 输出总体规划：目标、约束、拆分成哪些独立任务块
3. 绘制任务块依赖图（无依赖的块可并行）

### 步骤 2：动态检测可用模型（必须）

1. 调用 `cluster-scan-models` 工具（插件注册），获取本机**实际可用**的 provider 和模型清单（含多模态标记 ✅、成本）
2. 推荐必须**只从检测结果中选择**，检测结果里没有的模型不得推荐

### 步骤 3：问用户倾向 + 确认分配（必须，缺此项视为违规）

1. **先问用户倾向**（question 工具），选项：
   - 💰 **性价比优先**（cost）：选最便宜的可用模型，防止消费过高
   - 🚀 **性能优先**（performance）：选最强模型（贵），适合重要任务
   - ⚖️ **平衡**（balanced，默认）
   - 用户可自选其他选项或手动指定模型
2. 调用 `cluster-allocation`（传 `preference`）生成任务块 → 模型映射表
3. **套餐额度必须询问**：检测到套餐计费 provider（如 `zhipuai-coding-plan`、`zai-coding-plan`，标注 $0 但扣套餐额度）时，必须用 question 工具**逐项**询问用户是否使用每个套餐内的模型：
   - "是否使用 `zhipuai-coding-plan` 内的模型？"（✅ 使用 / 🚫 不用）
   - 用户同意 → 传 `usePlan: "yes"` 重新分配；全部拒绝 → 传 `usePlan: "no"` 只按量
   - 套餐开销与按量比例相当，不是免费；用户回答前不得派发
4. **多模态要求**：前端/看图/UI 校验类任务必须选 ✅ 多模态模型（能看图确认页面效果），如任务含"截图/看图/页面/界面/UI/视觉/样式"关键词
5. **思考强度（自动设置，可在确认时调整）**：插件按模型能力自动注入 `reasoningEffort`（effort 档位）或 `reasoning: on/off`——`effort` 档位模型（deepseek-v4-flash、glm-5.2 等）给最高档，仅 toggle 模型（glm-4.6v/glm-5v-turbo 等）开启思考。复杂任务（规划/重构/多步骤集成）可手动要求更高档，简单任务可关掉省 token
6. 模型擅长领域参考 https://arena.ai/leaderboard 的 WebDev / Image-to-WebDev / Vision / Coding 分榜
7. **必须用 question 工具向用户确认分配**（可沿用或手动调整模型/思考强度）；用户确认前禁止调用任何 Subagent

### 步骤 4：派发 Subagent（必须走 cluster-task-prompt）

1. **每个任务块派发前必须调用 `cluster-task-prompt` 工具**，生成完整 prompt（任务描述 + 验收标准 + 通用合规层 + 对应子技能 SKILL.md 全文）
2. 按确认的映射，用 task 工具派发对应 Subagent（`cluster-planner`/`cluster-frontend`/`cluster-backend`/`cluster-qa`/`cluster-docs`），prompt 使用 `cluster-task-prompt` 的输出
3. **无依赖的任务块并行派发**，并行上限 3 个
4. 有依赖的块等前置完成后才派发

> Subagent 必须遵守：通用合规层（`store-decision`/`save-progress`/project-docs 文档强制/完成清单/ai-compliance）+ 任务类型子技能流程（feature/frontend/backend→RDD；bugfix/qa→diagnose-before-fix；migrate→code-migrater；docs→project-docs）。这些已在 agent 定义和 `cluster-task-prompt` 输出中固化。

### 步骤 5：汇总验证

1. 所有 Subagent 返回后，主 Agent 统一验证：build/测试运行（**粘贴输出**）
2. 冲突（文件覆盖/接口不一致）→ 主 Agent 亲自协调，或再派发修复

### 步骤 6：完成清单（全部为必须项，缺一项不得说"完成"）

- [ ] 已输出 `📌 路由宣告: cluster`
- [ ] 已调用 `cluster-scan-models` 检测可用模型
- [ ] 已用 `question` 工具问用户倾向（性价比/性能/平衡，或手动指定）
- [ ] 检测到套餐 provider 时已用 `question` 询问是否用套餐额度（yes/no）
- [ ] 前端/看图任务已确认使用多模态（✅）模型
- [ ] 已用 `question` 工具确认模型分配
- [ ] 每个任务块已用 `cluster-task-prompt` 生成派发 prompt
- [ ] 已按映射派发 Subagent（粘贴每个 Subagent 的返回值摘要）
- [ ] build/测试通过（粘贴输出）
- [ ] 涉及 API/架构/UI 变更 → 已用 project-docs 的 `update_doc`/`create_adr`
- [ ] 已调用 `store-decision` 记录模型分配与分块决策
- [ ] 已调用 `save-progress`

### 步骤 7：Memory

- **分配确认后** → 调用 `store-decision`，记录每个任务块的模型分配
- **全部完成后** → 调用 `save-progress`
- **感觉到降智/上下文将满** → 调用 `prepare-handoff` → 提示用户开新会话

## 禁止

- 不检测可用模型就推荐/派发
- 不问用户倾向（性价比/性能/手动）就分配模型
- 不经过用户确认就派发 Subagent
- 推荐检测结果之外的模型
- 前端/看图任务使用非多模态（无 ✅）模型
- 派发不走 `cluster-task-prompt`（Subagent 收不到子技能流程和通用合规层）
- 有依赖的任务块提前并行
- 派发时不带验收标准
- 跳过步骤 6 的完成清单

## Subagent 一览

| Subagent | 职责 | 默认模型（插件按可用性注入） |
|----------|------|------------------------------|
| `cluster-planner` | 需求细化、任务拆分、技术方案 | DeepSeek V4 Flash（0731，超 v4-pro preview 且更便宜） |
| `cluster-frontend` | 前端实现（TS/React/Vue 等） | Kimi K3 |
| `cluster-backend` | 后端实现（API/数据库/服务） | DeepSeek V4 Flash |
| `cluster-qa` | 测试用例、构建验证、回归 | GLM-5.2 |
| `cluster-docs` | 文档、ADR、README | GLM-5.2 |

> 模型优先级：DeepSeek V4 Flash（2026-07-31 公测版）> V4 Pro（preview 未 GA，等 GA 后再启用）。模型不可用时插件自动回退到可用模型（启动时检测并注入）。
