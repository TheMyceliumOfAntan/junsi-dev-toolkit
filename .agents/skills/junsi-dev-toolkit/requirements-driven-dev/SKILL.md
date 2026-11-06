---
name: requirements-driven-dev
description: Use when the user wants to add a new feature or implement a new requirement in the current project. Supports Subagent parallel mode for large (≥3 independent files) new features. **This is a sub-tool of junsi-dev-toolkit. Do not trigger directly unless routed by junsi-dev-toolkit.**
---

# RDD

三个阶段：**CLARIFY → IMPLEMENT → VERIFY**，外加一道插件强制的**阶段门禁**。

> **铁律：没拿到用户明确的「开始」，一行代码都不许写。**
> 调研完直接开工 = 违规。方案没经过确认 = 违规。checkpoint 没贴 hash = 违规。

## 阶段门禁（插件强制执行，优先级高于用户催促）

路由层会在每轮注入 `## 阶段门禁：<PHASE>` 横幅，并读取 `.memory/route-state.json` 里本会话的阶段。阶段不对，横幅就一直拦。

| 阶段 | 进入方式 | 允许 | 禁止 |
|:--|:--|:--|:--|
| `clarify` | 路由命中自动进入 | 读代码、提问、复述、出方案 | 改文件、跑构建、写实现 |
| `plan-pending` | 调 `rdd-phase(action:"plan")` | 输出/修订完整方案 | 任何代码改动 |
| `implement` | 用户明确说「开始」→ `rdd-phase(action:"start")` | 改代码（先 checkpoint） | 跳过 checkpoint、扩大范围 |
| `verify` | 实现完成 → `rdd-phase(action:"done")` | 验证、收尾 | 新增功能 |

- 横幅写着 🚫 时，**不管用户怎么催，都不许改代码**。用户催得急，就一句话说明"方案还没确认，确认后立刻开工"。
- 用户只回「开始 / 开干 / 确认 / 可以 / 按这个来 / OK」这类短句时，插件会自动放行到 `implement`，你仍需先做 checkpoint。
- 只有用户主动说「直接做 / 跳过方案 / 别问了」，才允许跳过方案确认。

## Gate 0：远程更新预检（动手前必做）

在进入任何实现阶段前，先确认目标仓库/上游**最新版是否已经把本次需求实现了**，避免重复造轮子：

- `git fetch` 拉到最新远程，`git log origin/<分支>` 看近期提交，重点查 `CHANGELOG`/`Release Notes`/PR 标题里是否提到本需求关键词（功能名、特性、能力）。
- 可 `web_search` 查上游 issue/PR/发布说明确认是否已实现。
- **若已实现/已合入**：不要重复实现；提示用户"上游已提供（版本/提交 X），建议升级/改用/拉取新版本"，并给出依据。必要时才协助做升级适配，而不是新写一套。
- 若未实现或需求是本项目私有 → 正常进入 CLARIFY → IMPLEMENT → VERIFY。
- 在方案或最终总结里说明「已确认上游未实现/未包含，故自研」或「上游已实现，改用之」。

## Phase 1: CLARIFY

### 1.1 复述意图
用自己的话复述：要做什么、为什么、期望结果是什么。

### 1.2 先读代码，再提问
涉及改现有功能时，**先把相关模块读进上下文**（在路由注入的范围内，不扫全文）。没读代码就提问是浅的，浪费用户时间。

### 1.3 逐个澄清至零模糊
一次问一个，直到范围、行为、约束、优先级全部无歧义：

- **范围**：具体改什么？什么绝对不能动？
- **行为**：输入/输出、边界、错误处理、状态
- **约束**：性能、兼容性、依赖
- **优先级**：必须有 vs 锦上添花

<HARD-GATE>
澄清没问完，不许出方案。"我觉得差不多了" = 违规。只要还有一个关于范围/行为/约束的问题没答，就没到出方案的时候。
</HARD-GATE>

### 1.4 UI 变更先画图
涉及前端/视觉输出时，先用 ASCII/Mermaid/表格画出布局、组件层级、交互流程，确认视觉设计后再谈实现。

### 1.5 提 ≥2 种方案
澄清完成后，给 2-3 种方案 + 优缺点 + 推荐，每个方案几句话即可。

### 1.6 输出完整实施方案（用户确认的对象）

方案确认前必须给出下面这份**完整方案**，缺项视为没出方案：

```markdown
## 实施方案：<一句话标题>

### 1. 目标与范围
- 做什么：
- 不做什么（边界）：

### 2. 改动清单
| 文件 | 动作（新增/修改/删除） | 说明 |
|:--|:--|:--|

### 3. 分步计划
1. <步骤> —— 验收：<命令/现象>
2. ...

### 4. 关键决策
- 选了：<方案>，因为 <理由>
- 舍弃：<方案>，因为 <理由>

### 5. 风险与回滚
- 风险：
- 回滚：<git 命令 / 还原方式>

### 6. 验收标准
- [ ] <可验证条件 + 命令>
```

### 1.7 确认闸门（最容易违规的一步）

1. 输出完整方案后，**调用 `rdd-phase(action:"plan")`**。
2. 明确写一句："**方案已给出，等你确认；回复「开始」我就动手。**"
3. **然后停下**。不写代码、不跑构建、不"顺手先改一点"。
4. 用户说「开始 / 开干 / 确认」→ 调 `rdd-phase(action:"start")` → 进入 Phase 2。
5. 用户提修改意见 → **先更新方案** → 再调 `rdd-phase(action:"plan")` → 继续等确认。**不许边改方案边改代码。**
6. 方案确认后，调 `store-decision` 记录选型理由与舍弃方案。

| 借口 | 现实 |
|:--|:--|
| "剩下的显然" | 显然的话就不需要澄清了 |
| "实现时再想细节" | 未解的问题会变成错误的实现 |
| "用户不满意会说" | 让用户替你发现缺口不可接受 |
| "改动很小不用问" | 小改动藏最多假设 |
| "先写个雏形给用户看" | 方案没确认前，雏形也是违规 |

## 中途补充信息（分级处理）

干活过程中用户补充信息时，**先判断属于哪一类**：

| 类型 | 例子 | 处理 |
|:--|:--|:--|
| 细节纠正 | 改字段名、换文案、调整路径、纠正我的理解 | 直接并入当前步骤继续，回复里说明"已按你说的改了什么" |
| 范围变更 | 新增功能、改行为、换方案、加页面/接口 | 停手 → 更新完整方案 → `rdd-phase(action:"plan")` → 等确认 |
| 任务已完成后再提新需求 | "再帮我加个 X" | 当作新任务，重新走 Phase 1（插件会把阶段打回 `clarify`） |

判断不了时按**范围变更**处理（宁可多确认一次）。

## Phase 2: IMPLEMENT

### 2.1 阶段 checkpoint（强制，必须贴 hash）

动手改代码前执行：

```bash
git add -A && git -c commit.gpgsign=false commit -m "checkpoint: <本次改动摘要>"
```

- 必须禁用 GPG 签名（`-c commit.gpgsign=false`），否则会弹窗卡死。
- 回复里**贴出 commit hash**。没贴 hash = 没做 checkpoint = 违规。
- 工作区干净无变更时，记录 `git rev-parse HEAD` 作为回滚基线。
- 步骤失败需要回滚：`git reset --hard <checkpoint-hash>`。
- **checkpoint 只提交在当前分支**：禁止为了备份新建、切换或 stash 到别的分支。

### 2.1.1 分支纪律（开工先记基线）

1. 开工前记录基线分支：`git rev-parse --abbrev-ref HEAD`（通常 `main`/`master`）。插件也会在放行时自动记进 `route-state.json`。
2. 需要走 PR 的项目：从基线切工作分支（`fix/xxx`、`feat/xxx`），**全程在这个分支上 checkpoint**。
3. 不走 PR / 直接推的项目：直接在基线分支上干活，checkpoint 就是普通提交。
4. 无论哪种，**收尾都必须回到基线分支**，见 3.5。

### 2.2 拆成原子步骤
按方案拆步骤，每步可独立 build/测试。维护 todo 列表，同一时间只有一个 `in_progress`，验证通过才 `completed`。

### 2.3 Subagent 并行（可选）
同时满足才用：① 原子包 ≥3 ② 无文件级依赖 ③ 纯新增代码（不改已有复杂逻辑）。并行上限 3，全部返回后统一 build。不满足就当前会话直接写。

### 2.4 每步纪律
- 最小改动，只做方案内的东西，不加未要求的功能。
- 每步验证：lint → typecheck → build → 相关测试。
- 验证失败：先诊断根因（可用 diagnose-before-fix 的排查纪律），修完再验。
- 超出方案范围 → 立刻停下回到 CLARIFY，不许"顺手做了"。

## Phase 3: VERIFY

### 3.0 VERIFY 前 checkpoint
实现完成、进入验证前再提交一次：

```bash
git add -A && git -c commit.gpgsign=false commit -m "checkpoint: <功能名> 实现完成，进入验证"
```

贴出 hash，然后调 `rdd-phase(action:"done")`。

### 3.1 质量门禁 —— 实际运行，不是肉眼检查
- Lint / Typecheck / Build / 现有测试，全部实际执行并**粘贴关键输出**。
- `编译通过 ≠ 代码能跑`，`grep/阅读 ≠ 验证`。

### 3.2 提议并执行测试场景
正常 / 边界 / 异常各至少一条，写明输入与预期，实际跑或给出可执行命令。

### 3.3 影响分析
搜索调用方，列出谁依赖这段代码，确认没有下游破坏。

### 3.4 意图匹配
逐条对比 Phase 1 澄清与最终结果，不符合就修。

### 3.5 收尾（缺一不可）

**先回基线分支，再保存进度。**

- **走 PR 的项目**：推送工作分支 → 开 PR → 合并后
  ```bash
  git checkout <base> && git pull --ff-only && git branch -d <work>
  ```
  PR 因审查未合并时：**明确报告**当前所在分支、PR 链接、合并后如何切回，禁止静默把用户留在工作分支。
- **不走 PR / 直接推的项目**：
  ```bash
  git checkout <base> && git merge --ff-only <work> && git branch -d <work>
  ```
  已在基线分支上干活则跳过合并，直接确认 `git status` 干净。
- 收尾回复必须报告：**当前分支**、是否已回到基线、工作分支是否已删除。

然后依次调用：
- `store-decision`（涉及选型时）
- project-docs 的 `update_doc`/`create_adr`（涉及 API/架构/UI/行为变更）
- `save-progress`（阶段填 `VERIFY`，会同时解锁本会话路由）

## 完成清单（Hard Gate）

- [ ] 方案经用户明确确认（有「开始」）
- [ ] IMPLEMENT 前 checkpoint 已提交并贴出 hash
- [ ] VERIFY 前 checkpoint 已提交并贴出 hash
- [ ] checkpoint 全部在当前工作分支，没有为备份另建分支
- [ ] 已回到基线分支（PR 合并后切回并 pull / 本地 merge 回 main），工作分支已删除或已说明未合并原因
- [ ] Lint / Typecheck / Build 实际运行通过（粘贴输出）
- [ ] 现有测试全部通过（粘贴输出）
- [ ] 测试场景已提议并验证
- [ ] 影响分析已执行
- [ ] 结果与 Phase 1 意图逐条匹配
- [ ] `store-decision` / project-docs 写回 / `save-progress` 已调用

**任何一项未完成，禁止说"做完了"。**

## 速查：禁止事项

- 调研完直接开工（方案未经确认）
- 用户提意见时边改方案边改代码
- 跳过 checkpoint，或做了不贴 hash
- 为 checkpoint 新建/切换分支
- 干完把用户留在 `fix/`、`feat/` 工作分支上，不合并也不说明
- 范围变更后不更新方案就继续写
- Build/测试不跑就声称完成
- 加了方案里没有的功能
- 绕过 project-docs 直接改 `docs/` 下的文档

## Memory 集成

- **方案确认后** → `store-decision`
- **VERIFY 通过后** → `save-progress`
- **上下文将满/降智** → `prepare-handoff`，提示用户开新会话继续
