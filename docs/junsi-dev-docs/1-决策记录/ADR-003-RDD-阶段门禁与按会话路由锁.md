# ADR-003：RDD 阶段门禁与按会话路由锁

| 属性 | 内容 |
|---|---|
| 状态 | 已采纳 |
| 日期 | 2026-11-04 |
| 决策者 | AI Agent |

## 背景

requirements-driven-dev 流程被压缩后，模型调研完直接开工、方案未经确认就改代码；用户在干活中途补充信息时，更高优先级关键词（如“报错”）会顶掉当前路由锁，导致流程跑偏；git checkpoint 也未实际执行。

## 决策

插件层引入按 sessionID 隔离的 route-state v2，记录 route + phase（clarify/plan-pending/implement/verify），8 小时滑动续期；路由锁优先级高于关键词匹配，只有用户显式说“切换路由”才重新匹配。新增 rdd-phase 工具驱动阶段迁移，并在每轮 system 注入对应门禁横幅（未放行时明确禁止改代码）。用户确认口令（开始/开干/确认/OK 等整句短句）自动放行；中途补充按分级处理：细节纠正直接继续，范围变更打回 clarify 重新确认。git checkpoint 改为 IMPLEMENT 前与 VERIFY 前各一次，强制 -c commit.gpgsign=false 并贴出 hash。

## 备选方案

### 方案 仅强化 SKILL.md 文本
- 优点：改动小、零回归风险
- 缺点：已被实际使用证明压不住模型
- 为何不选：放弃

### 方案 每步都 git checkpoint
- 优点：回滚粒度最细
- 缺点：提交噪音大、拖慢流程
- 为何不选：放弃，改为每阶段一次

## 影响
- .opencode/plugins/junsi-dev-toolkit.js（路由状态 v2、rdd-phase、阶段横幅、补充信息分级）
- .agents/skills/junsi-dev-toolkit/requirements-driven-dev/SKILL.md（恢复 HARD-GATE 与完整方案模板）
- scripts/test-route-state.mjs（9 组回归场景）
- memory-skill 关键词收紧（记住→记住这个/记住我的），避免“记住密码”误路由

## 修订记录
| 日期 | 版本 | 修改内容 | 修改人 |
|---|---|---|---|
| 2026-11-04 | v1.0 | 初版创建 | AI Agent |