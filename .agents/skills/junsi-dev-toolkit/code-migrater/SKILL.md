---
name: code-migrater
description: Use when the user requests code migration, porting, or translation from one language/framework to another. **This is a sub-tool of junsi-dev-toolkit. Do not trigger directly unless routed by junsi-dev-toolkit.**
---

# 代码移植专家

系统化的移植流程：先分析确认 → 再逐模块移植 → 快照比对验证。

**遇任何错误用 `diagnose-before-fix` 排查**，禁止凭感觉改。

> **流程提示**：本技能全文由插件在路由时注入。按本流程执行，并在每个阶段完成后更新 `MAPPING_TABLE.yaml` 与 `CHECKPOINT_BATCH_{n}.md`，否则视为未完成。

## 工作流

### Gate 0：远程更新预检 + 可行性门禁

**远程更新预检（动手前必做）：** 先确认本次移植所针对的"问题/缺口/需求"是否已在上游最新版被实现或修复——若用户移植是因为 A 不好用/缺功能/有 bug，先 `git fetch` + `git log origin/<分支>` + `CHANGELOG`/`Release Notes` 查上游是否已新增/修复该点（可 `web_search` 查 issue/PR/发布说明）。**若上游已实现/修复**：提示用户"目标缺口已被上游解决（版本/提交 X），建议升级/拉新而不再移植"，给出依据；仅当升级不适用（架构不兼容/上游无此仓库）才继续移植。**若确需移植**：正常进入下方可行性门禁。

**可行性门禁：**

0. **在路由层注入的范围内解析源/目标项目**，不扫全文。
1. 扫描源项目依赖 + 代码量
2. 若存在目标项目无法替代的中间件/SDK，或 >5000 行 → 输出风险评估报告，等用户说"继续"
3. ≤5000 行且无不替代依赖 → 直接进入阶段一

### 阶段一：双轨扫描

1. 梳理源项目结构、模块依赖、外部依赖
2. 梳理目标项目同业务域的实现、命名规范、测试写法
3. **输出冲突矩阵**：哪些已有、需覆盖、需新建
4. 若目标已有同类功能 → 问用户"覆盖还是共存"，不默认覆盖

### 阶段二：确认

1. 分析源项目核心逻辑、数据流转
2. 向用户呈现分析 + 冲突矩阵，**等确认后才继续**
3. 确定移植方向：逐字翻译 / 适配新架构 / 混合模式
4. **方向确认后** → **必须**调用 `store-decision`，记录移植策略和冲突取舍

### 阶段三：准备

1. 生成快照脚本，源和目标都初始化为相同测试数据集再对比
2. 从 main 拉独立分支（`migrate/xxx`），禁止直接在 main 上改

### 阶段四：原子化移植

1. **MAPPING_TABLE.yaml**：在项目根目录生成，固化所有类型/API/枚举的源→目标映射。后续映射决策必须查阅此文件。发现新映射需先更新文件再写代码。
2. **拆原子包**：每包 ≤200 行变更
3. **依赖分析 + 批次分组**：
   - 扫描包间 import 依赖，构建 DAG
   - Batch 1：零依赖包 → Batch 2：依赖 Batch 1 → 依此类推
   - 并行上限：每批 **3** 个 Subagent 并发
4. **执行**：按 Batch 顺序调用 Translator Subagent，等一个 Batch 全部返回再进入下一批
5. **合并 + 编译检查**：每批完成后统一 build，失败则调用 Diagnose Subagent
6. 每批成功 → 创建 `CHECKPOINT_BATCH_{n}.md` + `git commit`

### 阶段五：验证

1. 单元测试 + 边界测试
2. **快照自动比对**：调用 QA Subagent 比对源和目标快照
3. 失败 → Diagnose Subagent 诊断（不得自行修代码）
4. 同一原子包 QA 失败 ≥2 次 → 标记 `[MANUAL_REQUIRED]`

### 阶段六：合并 + ADR

1. 所有测试通过后合并回 main
2. **必须输出 ADR**（含：关键映射决策、遗留技术债记录）——用 project-docs 的 `create_adr`，禁止自己乱写文档
3. **完成后必须** → 调用 `save-progress` 和 `store-decision`（记录映射策略和冲突取舍）

## 相关子代理

| 子代理 | 用途 |
|--------|------|
| `subagents/translator/SKILL.md` | 逐文件翻译 |
| `subagents/qa/SKILL.md` | 快照比对 |
| `subagents/diagnose/SKILL.md` | 诊断修复 |

## Memory 集成

- **方向确认后** → **必须**调用 `store-decision`，记录移植策略和冲突取舍
- **感觉到降智/上下文将满** → 调用 `prepare-handoff` → 提示用户开新会话后继续

## 完成清单（全部为必须项，缺一项不得说"移植完成"）

- [ ] 阶段二方向确认后已 `store-decision`
- [ ] MAPPING_TABLE.yaml 已生成并更新
- [ ] 每批有 CHECKPOINT_BATCH_{n}.md + git commit
- [ ] QA 快照比对通过（粘贴输出）
- [ ] ADR 已用 `create_adr` 输出
- [ ] 完成后已 `save-progress`

## 禁止

- 不扫描目标项目就动手
- 映射决策不写入 MAPPING_TABLE.yaml
- 主控直接写业务代码（必须走 Translator）
- QA 失败后主控直接修（必须走 Diagnose）
- 同一原子包重试 >2 次不标记 MANUAL_REQUIRED
- 不分析依赖图就并行（导致文件冲突）
- 不输出 ADR

## 引用

详见 `../shared/ai-compliance.md` 中的 Migrate 部分和通用陷阱。
