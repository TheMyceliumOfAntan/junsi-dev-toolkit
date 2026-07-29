---
name: memory-skill
description: >-
  任务状态持久化 + 决策记忆 + 上下文缓存。
  记录关键决策、保存进度、跨会话恢复。
  **This is a sub-tool of junsi-dev-toolkit. Do not trigger directly unless routed by junsi-dev-toolkit.**
---

# Memory Skill

## 存储结构

项目根 `.memory/` 目录，自动创建，**需手动 gitignore**：

首次使用时检查项目 `.gitignore`，若没有 `.memory/` 则添加一行。避免 `.memory/` 被误提交。

| 文件 | 加载策略 | 大小 | 用途 |
|------|----------|------|------|
| `INDEX.md` | 每次会话自动加载 | ~20 行 | 任务标题 + 当前进度概要 |
| `HANDOFF.md` | 新会话自动检测 | ~50 行 | 跨会话完整转移包 |
| `decisions/` | 按需读取 | ~10 行/文件 | 关键决策记录 |
| `progress/` | 按需读取 | ~15 行/文件 | 任务进度快照 |
| `sessions/` | 仅参考用途 | ~20 行/文件 | 历史会话摘要 |

## 工具

| 工具 | 用户触发词 | 动作 |
|------|-----------|------|
| `store-decision` | 记住/记录/记一下/决定/方案确认 | 追加 `decisions/{timestamp}-{slug}.md` |
| `save-progress` | 保存进度/做到哪了/记进度 | 更新 `progress/current.md` + 重写 `INDEX.md` |
| `prepare-handoff` | 换会话/换窗口/上下文不够/降智/重开/clean slate | 生成完整 `HANDOFF.md` |
| `restore-handoff` | 新会话自动（主路由检测） | 加载 `HANDOFF.md` 注入上下文 |

## 自动触发点（由主路由/子工具在关键点调用）

- **工作流开始** → 检测 `.memory/HANDOFF.md`，存在则执行 `restore-handoff`
- **阶段确认后**（CLARIFY phase 结束） → 自动 `store-decision`
- **任务完成**（VERIFY phase 通过） → 自动 `save-progress`
- **感觉到降智/上下文将满** → 自动 `prepare-handoff` → 提示用户开新会话

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
