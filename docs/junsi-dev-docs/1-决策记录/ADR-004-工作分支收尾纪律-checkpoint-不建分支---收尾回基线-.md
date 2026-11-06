# ADR-004：工作分支收尾纪律（checkpoint 不建分支 + 收尾回基线）

| 属性 | 内容 |
|---|---|
| 状态 | 已采纳 |
| 日期 | 2026-11-06 |
| 决策者 | AI Agent |

## 背景

RDD/diagnose 流程能正确做 checkpoint 了，但 agent 会为任务切到 fix/feat 分支并在收尾后把用户留在该分支，不合并、不切回 main。SKILL.md 里也没有任何分支纪律（只有 code-migrater 提到从 main 拉分支，未提收尾）。

## 决策

把分支纪律写进 shared/ai-compliance.md 与 RDD/diagnose/code-migrater 子技能：checkpoint 一律提交在当前分支，禁止为备份新建/切换分支；开工记录基线分支（插件用 origin/HEAD → main/master 推断，避免把上一轮遗留的 fix 分支当基线）；收尾必须回基线——走 PR 的项目在 PR 合并后 checkout base + pull --ff-only + branch -d work，不走 PR 的项目本地 merge --ff-only 回 base；PR 未合并必须报告分支名与链接。插件在 IMPLEMENT/VERIFY 横幅与 rdd-phase 返回值中注入当前分支/基线分支与收尾命令。

## 备选方案

### 方案 只在 SKILL.md 写规则
- 优点：改动最小
- 缺点：之前文本约束已被证明压不住，且模型不知道当前分支与基线
- 为何不选：放弃，补插件侧分支探测

### 方案 插件自动执行合并
- 优点：完全免手动
- 缺点：有 PR 审查规则时自动 merge 会绕过审查，风险高
- 为何不选：放弃，改为注入命令并要求模型执行+报告

## 影响
- .opencode/plugins/junsi-dev-toolkit.js（baseBranch 记录、IMPLEMENT/VERIFY 横幅、rdd-phase 返回收尾命令）
- .agents/skills/junsi-dev-toolkit/requirements-driven-dev/SKILL.md（2.1.1 分支纪律 + 3.5 收尾）
- .agents/skills/junsi-dev-toolkit/diagnose-before-fix/SKILL.md、code-migrater/SKILL.md
- .agents/skills/junsi-dev-toolkit/shared/ai-compliance.md
- scripts/test-route-state.mjs（git 仓库夹具 + 分支断言）

## 修订记录
| 日期 | 版本 | 修改内容 | 修改人 |
|---|---|---|---|
| 2026-11-06 | v1.0 | 初版创建 | AI Agent |