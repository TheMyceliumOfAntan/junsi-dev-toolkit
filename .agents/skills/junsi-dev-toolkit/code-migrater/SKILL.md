---
name: code-migrater
description: Use when the user requests code migration, porting, or translation from one language/framework to another, including cross-language (C# to Python, WPF to Avalonia) and cross-framework scenarios. **This is a sub-tool of junsi-dev-toolkit. Do not trigger directly unless routed by junsi-dev-toolkit.**
---

# 代码移植专家

## 概述
系统化的代码移植流程。核心原则：先分析理解并确认，再动手移植；逐模块验证，绝不跳过测试。

**REQUIRED SKILL：** 遇到任何错误时必须使用 `diagnose-before-fix` 排查修复，禁止凭感觉修改。

## ⛔ 互锁门禁（与其它 Skill 的边界）

本 Skill 与以下 Skill 互斥，按优先级触发：

| 优先级 | 触发条件 | 执行 Skill |
|:---|:---|:---|
| 最高 | 用户说"移植/迁移/migrate/port" | `code-migrater`（其他 Skill 静默） |
| 次高 | 用户说"报错/不对/不工作/返回错误/显示不对/空列表"等不符合预期的行为 | `diagnose-before-fix`（若同时含"移植"关键词，让位于 code-migrater） |
| 最低 | 用户说"添加/新增/实现一个新功能" | `requirements-driven-dev`（若同时含"修/不对/报错"，让位于 diagnose-before-fix） |

**纯知识问答（如"这个 API 怎么用"）不触发任何 Skill。**

## 触发条件
- 用户提出"移植"、"迁移"、"port"、"migrate"
- 跨语言转换（C# → Python、Java → Go 等）
- 跨框架升级（WPF → Avalonia、Spring → Quarkus 等）
- 代码搬迁（纯搬运不改逻辑）

> **注意**：本 Skill 仅在用户明确说"移植/迁移/port/migrate"时触发。若用户说"加功能"（走 `requirements-driven-dev`）或"修 bug/不对/报错"（走 `diagnose-before-fix`），请勿触发本 Skill。

## 工作流

### 强制契约：与项目知识中枢（project-docs MCP）的交互

**执行前：上下文已由路由器通过 MCP 注入**

路由器已在分发前调用了 `project-docs.query_docs`，相关文档摘要已包含在输入中。

如果未收到注入的上下文：
1. 主动调用 MCP 工具 `project-docs.query_docs`，关键词根据当前任务提取。
2. 使用返回结果作为上下文。

**执行后：必须通过 MCP 写回**

任务完成后，必须调用 `project-docs` MCP 工具更新文档：

| 场景 | 调用的工具 | 说明 |
|:---|:---|:---|
| 新增了架构决策 | `create_adr` | 记录决策 |
| 新增/修改了 API | `update_doc` | 更新 API 规范 |
| 新增了模块 | `update_doc` | 更新模块划分 |
| 新增了 UI 组件 | `update_doc` | 更新组件设计规范 |

**违反此契约视为违规，任务不计为完成。**

### 模式检测（第一步）

检测当前处于 Plan 模式还是 Build 模式。

#### 如果在 Plan 模式下：

**你的职责是：分析移植范围 → 输出移植计划 → 指引切换**

执行：
1. 双轨扫描（源项目 + 目标项目）
2. 输出冲突矩阵
3. 用户确认分析结果
4. **输出详细的移植计划**，包括：
   - MAPPING_TABLE.yaml 的完整内容（类型/API映射）
   - 原子包拆分清单（每个包包含哪些文件）
   - 每个包的依赖关系
   - 验证策略（快照比对的接口列表）
5. **在计划末尾输出模式切换指引**（参见 `../shared/mode-switch-guide.md`）。

#### 如果在 Build 模式下：

直接按以下原流程执行，无需额外步骤。

---

### 阶段零：可行性门禁（Gate 0）

1. **依赖与规模扫描** — 扫描源项目的依赖清单（`package.json` / `go.mod` / `pom.xml` / `requirements.txt` / `.csproj` 等）和总代码行数（LOC）。
2. **风险评估**：
    - 若存在目标项目**无法替代**的中间件/数据库/私有 SDK（如 Oracle Coherence、特定私有云 SDK），或单次迁移代码量 > 5000 行，AI 必须立即输出《风险评估报告》并**暂停**，等待用户输入"继续"后才可进入阶段一。
    - 若迁移量 ≤ 5000 行且无不可替代依赖，直接进入阶段一，无需人工授权。

### 阶段一：双轨扫描

3. **源项目分析** — 梳理目录结构、模块依赖、语言/框架特性、外部依赖
4. **目标项目扫描** — 梳理目标项目在同业务域的现有实现、命名规范、测试写法、架构约定
5. **输出冲突矩阵** — 列出哪些源功能目标已有、需覆盖、需新建。若目标已有类似功能，**必须暂停询问用户"覆盖还是共存"**，禁止默认覆盖

### 阶段二：分析确认

6. **分析实现思路** — 核心逻辑是什么、为什么这么写、数据流转路径
7. **向用户确认** — 呈现分析结果 + 冲突矩阵，**等用户确认后才能继续**，理解错了后面全白费
8. **明确移植范围** — 精确到目标文件或段落：全量/部分、多文件映射
9. **提出多种移植方向** — 至少 2 种实现思路，分析优缺点和适配场景
10. **确定移植方法**：
    - **逐字翻译**：保持源项目结构、命名、组织方式
    - **适配新架构**：按目标项目架构重组，仅参考源项目实现思路
    - **混合模式**：核心逻辑逐字翻译，外围适配新架构

### 阶段三：准备

# [PATCH] 修改：快照脚本必须包含种子数据初始化
11. **生成快照脚本** — 编写脚本请求源项目核心接口，输出 `source_snapshot.json` 作为比对基线。**脚本必须包含数据库种子数据初始化逻辑**：在执行请求前，先对源项目和目标项目的数据库执行相同的 `TRUNCATE` + 插入固定测试数据集的操作（或通过 API 重置测试账号状态），消除因环境数据不同导致的快照字段误报（详见 `../shared/templates/snapshot-diff-guide.md`）

**若源项目或目标项目需要启动后端服务才能生成快照**：
- 快照脚本必须包含 `../shared/services.md` 中的服务生命周期管理逻辑。
- 脚本应在 启动服务 → 等待就绪 → 生成快照 → **关闭服务** 的完整流程中执行。

12. **创建独立开发分支** — 从 main 拉出新分支用于移植（如 `migrate/xxx`），禁止直接在 main 上改。移植前先 commit/stash 当前工作

### 阶段四：执行（原子化循环）

# [PATCH-SUBAGENT] 执行模式切换到 Subagent 调度
**执行模式变更**：本阶段起，主控 Orchestrator（即你）不再直接编写业务代码，而是调度专职 Subagent。
- Translator Subagent：负责翻译（路径：`subagents/translator/SKILL.md`）
- 主控职责：拆包、调用 Subagent、编译检查、提交 Checkpoint

# [PATCH] 新增断点续传（Resume Mode）
13. **断点续传检查** — 每次启动移植任务时，AI 必须首先检查当前工作目录下是否存在任何 `CHECKPOINT_n.md` 文件。
    - **若存在**：读取编号最大的检查点文件，**仅从下一个原子包继续移植**，严禁重新分析或重复执行已完成原子包。
    - **若不存在**：按正常流程从原子包 1 开始。

# [PATCH] 修改：映射表必须物理化为 MAPPING_TABLE.yaml
14. **建立映射表** — 在第一个原子包执行时，必须在项目根目录生成并提交 `MAPPING_TABLE.yaml` 文件，固化所有类型、API 路由、枚举值、配置项的源→目标映射关系。后续所有原子包中的映射决策**必须查阅此 YAML 文件**，严禁创建新的不一致映射。若发现需要新增映射，**必须先更新 `MAPPING_TABLE.yaml` 再写代码**。
15. **拆分原子包** — 将移植计划拆为 N 个原子包，每包 ≤200 行代码变更

# [PATCH-CLUSTER] 新增依赖分析与批次分组
15.5. **依赖分析与批次分组（并行化前置）**：
    - 主控扫描所有原子包的文件路径，分析包间的**文件级依赖关系**（import/require/include）。
    - 构建依赖图（DAG），识别出**互不依赖**的原子包集合。
    - 按依赖深度将原子包划分为多个 **并行批次（Batch）**：
      - Batch 1：零依赖的原子包（可并行执行）。
      - Batch 2：仅依赖 Batch 1 的原子包。
      - Batch N：依此类推。
    - **并行度控制**：每个 Batch 同时启动的 Subagent 数量上限为 **3 个**（可根据实际上下文窗口调整，但建议 ≤5）。
    - 输出 `BATCH_PLAN.md`，记录每个 Batch 包含哪些原子包、并行度、预计顺序。

# [PATCH-CLUSTER] 替换：批量并行调用 Translator Subagent
16. **批量并行调用 Translator Subagent**：
    - 主控按 `BATCH_PLAN.md` 的顺序处理每个 Batch。
    - **对于当前 Batch**，主控同时（并发）调用 `Translator Subagent` 处理该 Batch 内的**所有**原子包。
    - 调用参数与原规定一致（传入源文件、MAPPING_TABLE.yaml 等）。
    - **文件锁机制**：主控在启动每个 Batch 前，先将该 Batch 内所有原子包涉及的**目标文件路径**加入"写锁列表"，确保同一 Batch 内不会有两个 Subagent 写入同一个文件。
    - 主控等待当前 Batch 内**所有** Subagent 返回结果后，再进入下一步。
    - **失败处理（批量驳回）**：
      - 若 Batch 内任一原子包被驳回（未定义映射或编译失败），**整个 Batch 暂停**。
      - 主控仅驳回失败的原子包，让用户选择：
        - "跳过失败包，继续后续 Batch"（失败包标记 `[MANUAL_REQUIRED]`）
        - "停止所有，人工介入"
      - 严禁因单个包失败而重启整个 Batch 的所有 Subagent（浪费 Token）。

# [PATCH-CLUSTER] 新增并行结果合并与冲突处理
16.5. **并行结果合并与冲突处理**：
    - 当 Batch 内所有 Subagent 返回后，主控执行以下合并操作：
      - 将每个 Subagent 输出的目标文件写入对应路径。
      - 若多个 Subagent 修改了**同一个文件**（理论上不应发生，但若发生则触发冲突流程），主控执行：
        - 调用 `git diff` 查看冲突片段。
        - **自动合并策略**：优先保留目标项目原有代码风格，仅在冲突行插入 `<<<<<<<` 标记并暂停，等待人工裁决。
        - 标记冲突文件到 `CONFLICT_LOG.md`。
    - 合并完成后，统一执行一次编译/静态检查（而非每个包单独检查）。
    - 若编译失败，主控调用 **Diagnose Subagent** 诊断整个 Batch 的编译错误（而非逐包诊断），输出汇总报告。
    - 所有通过检查的原子包，统一生成一个 **批次 Checkpoint**：`CHECKPOINT_BATCH_{n}.md`（记录本批次完成了哪些包、合并结果、遗留问题）。
    - 执行 `git commit -m "migrate: batch_{n} (parallel)"`。

### 阶段五：系统化测试

17. **单元测试** — 为移植模块编写并运行单元测试，覆盖核心逻辑和边界
# [PATCH-SUBAGENT] 替换：调用 QA Subagent 执行快照比对
18. **自动快照比对（调用 QA Subagent）**：
    - 主控调用 `QA Subagent`（路径：`subagents/qa/SKILL.md`），传入：
      ```
      {
        "snapshot_script": "快照脚本路径",
        "source_snapshot": "./source_snapshot.json",
        "target_snapshot": "./target_snapshot.json",
        "ignore_fields": ["timestamp", "traceId", "requestId"]
      }
      ```
    - QA Subagent 输出结构化报告，主控解析 `status` 字段。
    - 若 `status: PASS` → 继续下一步。
    - 若 `status: FAIL` → 进入第 22 步（调用 Diagnose Subagent）。

# [PATCH-CLUSTER] 新增并行 QA 集群
18.5. **并行快照比对（QA 集群）**：
    - 若当前 Batch 包含多个接口/API 端点，主控可同时启动多个 **QA Subagent** 实例（上限 = min(3, Batch内接口数)）。
    - 每个 QA Subagent 负责一个独立的接口/API 端点快照比对。
    - 分配规则：按接口路径哈希取模，确保同一 Subagent 不会重复比对同一个接口。
    - 主控等待所有 QA Subagent 返回报告后，汇总生成 `QA_SUMMARY_BATCH_{n}.json`。
    - 若任一 QA 报告 FAIL：
      - 仅对该接口调用 Diagnose Subagent 进行诊断修复。
      - 已 PASS 的接口不受影响，无需重测。
19. **实际运行测试** — 启动项目，传入真实参数，比对源项目输出结果
20. **异常路径测试** — 非法输入、边界值，确认行为与源项目一致
21. **回归测试** — 运行已有测试套件，确保无破坏
# [PATCH-SUBAGENT] 替换：调用 Diagnose Subagent 处理失败
22. **失败处理（调用 Diagnose Subagent）**：
    - 若 QA 报告为 `FAIL`，主控**不得直接改代码**。
    - 调用 `Diagnose Subagent`（路径：`subagents/diagnose/SKILL.md`），传入：
      ```
      {
        "diff_report": "QA 输出的 diff_details",
        "source_code": "对应源文件代码片段",
        "translated_code": "当前目标文件代码片段",
        "mapping_table": "./MAPPING_TABLE.yaml"
      }
      ```
    - 解析 Diagnose 输出的 `patch_type`：
      - `update_mapping` → 主控更新 `MAPPING_TABLE.yaml`，重新提交该原子包给 Translator。
      - `retranslate` → 主控将诊断结论作为额外约束，重新调用 Translator。
      - `manual` → 主控标记该原子包为 `[MANUAL_REQUIRED]`，暂停等待人工介入。
    - **若同一原子包 QA 失败 ≥2 次** → 标记 `[MANUAL_REQUIRED]`，暂停，等待人工介入，禁止无限重试。

### 阶段六：解耦回滚

23. **冻结基线** — 若单次修复耗时 >30 分钟或 >3 次尝试失败，**禁止继续在原分支硬修**。执行：
    - `git checkout main` → 拉取新分支 `hotfix/rollback_xxx`
    - 在新分支上带前序失败经验重新移植
    - 禁止在污染的移植分支上 `rebase`/`force push`

### 阶段七：合并

24. 所有测试通过后，将移植分支合并回 main，清理开发分支

### 阶段八：知识蒸馏

25. **输出移植决策日志（ADR）** — 合并后强制输出，内容包含（模板见 `../shared/templates/adr-template.md`）：
    - 源项目用了 X 为什么目标项目改成了 Y
    - 移植过程中的关键决策及原因
# [PATCH] ADR 强制增加「遗留技术债」章节
    - **必须包含 `## 遗留技术债（待人工决策的优化点）` 章节**：列出在源项目中发现的 Bad Smell（性能隐患、废弃 API、死代码等），标注发现位置、问题描述和潜在影响

## 速查：禁止事项

- 不扫描目标项目就动手
- 发现冲突不询问用户，默认覆盖
- 不理解源码就移植
- 不向用户确认分析结果
- 直接在 main 上移植（必须用独立分支）
# [PATCH] 修改：禁止当场重构，但必须记录技术债
- 移植过程中若发现源项目的 Bad Smell（性能隐患、废弃 API、死代码等）**严禁当场修改**，但必须在 ADR「遗留技术债」章节中完整记录
- 只给一种方案
- 遇到问题凭感觉修（必须走 diagnose-before-fix）
- 不限大小的批量移植、不写 checkpoint
- 人工肉眼对比结果（必须用快照自动比对）
- 在污染的移植分支上反复硬修
- 测试 = 编译通过 / 肉眼看一遍
- 不输出 ADR
- 不生成 MAPPING_TABLE.yaml
- 不检查断点续传（导致重复执行已完成原子包）
- 执行前不向 project-docs 请求上下文（违反强制契约）
- 执行后不向 project-docs 写回信息（违反强制契约）
- 绕过 project-docs 直接读写 `docs/junsi-dev-docs/` 下的文档
- 有 MCP 可用时不使用，手动维护文档
- 执行完成后不通过 MCP 写回信息
# [PATCH-SUBAGENT] 新增 Subagent 相关禁止事项
- 主控亲自写业务代码（必须走 Translator Subagent）
- QA 失败后主控直接改代码（必须走 Diagnose Subagent）
- 同一原子包重试 >2 次不标记 MANUAL_REQUIRED
- Subagent 输出新映射类型（未在 MAPPING_TABLE.yaml 中定义）
# [PATCH-CLUSTER] 新增集群并行相关禁止事项
- 不分析依赖图就盲目并行（导致文件冲突或死锁）
- 同一 Batch 内并行度超过 5（导致上下文溢出或 API 限流）
- 因单个包失败而重启整个 Batch（浪费 Token）
- 并行合并后不执行统一编译检查（遗漏跨文件语法错误）
- QA 并行时不隔离接口（导致重复比对或数据污染）

## 关联 Skill
- **diagnose-before-fix**：移植过程中任何错误必须使用此 skill 排查
# [PATCH-SUBAGENT] 新增子代理关联
- **translator-subagent**：纯翻译子代理（路径：`subagents/translator/SKILL.md`）
- **qa-subagent**：质检子代理（路径：`subagents/qa/SKILL.md`）
- **diagnose-subagent**：诊断子代理（路径：`subagents/diagnose/SKILL.md`）

# [PATCH-SUBAGENT] 新增主控对话模板
## 主控对话模板（快速启动）

当用户触发本 Skill 时，主控开场白：
> "我将作为主控 Orchestrator 为你执行**集群化**移植。先构建依赖图，将原子包分为并行批次（每批最多 3 个 Subagent 并发），处理完一批再处理下一批。
>
> 请确认：
> 1. 源项目路径：`...`
> 2. 目标项目路径：`...`
> 3. 移植范围（模块/文件）：`...`
>
> 确认后我先执行 Gate 0 扫描，输出风险评估报告。"
