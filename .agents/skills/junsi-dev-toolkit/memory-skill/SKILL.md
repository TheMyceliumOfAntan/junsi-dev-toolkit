---
name: memory-skill
description: >-
  任务状态持久化 + 决策记忆 + 上下文缓存。
  记录关键决策、保存进度、跨会话恢复。
  **This is a sub-tool of junsi-dev-toolkit. Do not trigger directly unless routed by junsi-dev-toolkit.**
---

# Memory Skill

## 存储结构

项目根 `.memory/` 目录，自动创建（插件工具负责创建并维护 `.gitignore`，无需手工操作）：

| 文件 | 加载策略 | 大小 | 用途 |
|------|----------|------|------|
| `INDEX.md` | 每次会话自动加载 | ≤200 行 / 25KB | 任务标题 + 阶段 + 进度摘要 + 最近决策 + 状态；超限拒绝写入 |
| `HANDOFF.md` | 新会话自动检测 | ≤12KB | 跨会话完整转移包；恢复完成后归档移除 |
| `decisions/` | 按需读取 / 压缩时注入 | ~10 行/文件 | 关键决策记录（追加式，不覆盖） |
| `progress/current.md` | 按需读取 | ~15 行/文件 | 当前任务进度快照 |
| `progress/history/` | 仅参考用途 | ≤20 条自动裁剪 | 进度历史版本（每次保存自动归档旧版） |
| `sessions/` | 仅参考用途 | ~20 行/文件 | 会话痕迹 + HANDOFF 归档 |
| `~/.config/opencode/.memory/preferences.md` | **新会话启动注入** + 压缩时注入 | ≤2.4KB | 全局用户偏好（跨项目生效） |
| `~/.config/opencode/.memory/decisions/` | 压缩时注入 / list-decisions 合并 | ~10 行/文件 | 全局决策（scope=global 写入，跨项目生效） |

## 工具

> **v3**：7 个工具由插件 `junsi-dev-toolkit.js` 注册为真实可调用工具（自动写文件、维护 INDEX 和 .gitignore），**优先调用工具**，不要手工写文件。若工具未注册（依赖缺失），按下方"工具调用格式约定"手工写入。

| 工具 | 用户触发词 | 动作 |
|------|-----------|------|
| `store-decision` | 记住/记录/记一下/决定/方案确认 | 追加 `decisions/{timestamp}-{slug}.md`；`scope=global` 写入用户级全局记忆 |
| `save-progress` | 保存进度/做到哪了/记进度 | 归档旧版到 `progress/history/` → 更新 `current.md` → 重写 `INDEX.md` → 追加会话痕迹 |
| `prepare-handoff` | 换会话/换窗口/上下文不够/降智/重开/clean slate | 备份旧 HANDOFF → 生成完整 `HANDOFF.md` |
| `restore-handoff` | 新会话自动（插件检测 HANDOFF 注入）；恢复进度/接着上次做 | 加载 HANDOFF；`complete: true` 时归档到 sessions/ 并移除 |
| `list-decisions` | 有哪些决策/决策历史/回顾决策 | 列出决策历史（空格分词，AND 全命中优先、OR 兜底，时间倒序；默认合并项目+全局🌐） |
| `memory-doctor` | 健康审计/记忆体检 | 体检 INDEX/进度/HANDOFF 过期/容量/全局层，输出修复建议 |
| `save-preference` | 记住我的偏好/以后都用XX/默认XX | 追加全局偏好 `~/.config/opencode/.memory/preferences.md` |

## 自动触发点（由插件/主路由/子工具在关键点调用）

- **工作流开始** → 检测 `.memory/HANDOFF.md`，存在则执行 `restore-handoff`；存在全局偏好则注入（跨项目生效）
- **阶段确认后**（CLARIFY phase 结束） → 自动 `store-decision`（通用经验型决策用 `scope=global`）
- **任务完成**（VERIFY phase 通过） → 自动 `save-progress`；如有活动 HANDOFF → `restore-handoff`（`complete: true`）归档
- **感觉到降智/上下文将满** → 自动 `prepare-handoff` → 提示用户开新会话
- **会话压缩** → 自动注入：全局偏好 → 任务索引 → 最近 3 条项目决策画像 + 全局决策画像 → HANDOFF 摘要
- **会话空闲** → 自动写 `sessions/{timestamp}.md`（进度 + 决策摘要）

## 工具调用格式约定

### store-decision

```markdown
## 决策记录：{title}
- 日期：{YYYY-MM-DD}
- 场景：{什么上下文}
- 方案：{选了什么，为什么不选其他}
- 影响范围：{影响哪些文件/模块}
```

### save-progress

```markdown
## 进度：{task-title}
- 阶段：{CLARIFY / IMPLEMENT / VERIFY / 中断}
- 完成项：{list}
- 待办项：{list}
- 下一步：{建议下一步行动}
- 关键文件：{涉及的文件列表}
```

### prepare-handoff

HANDOFF.md 必须完全自包含：不加读代码、不加查项目结构，直接恢复工作状态。
