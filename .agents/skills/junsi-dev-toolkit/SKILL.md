---
name: junsi-dev-toolkit
description: 开发任务工具包。根据用户意图自动路由到专用子工具：移植代码 (code-migrater)、修复Bug (diagnose-before-fix)、添加新功能 (requirements-driven-dev)、文档管理 (project-docs)、上下文记忆 (memory-skill)。路由逻辑见 opencode.md。
---

# Junsi Dev Toolkit

路由表和 MCP 定范围逻辑已集成到 `opencode.md`，始终生效，无需 `/skill` 调用。

本目录下是各子技能的详细实现文件，路由后按需读取：

| 子工具 | 文件 |
|--------|------|
| `code-migrater` | `./code-migrater/SKILL.md` |
| `diagnose-before-fix` | `./diagnose-before-fix/SKILL.md` |
| `requirements-driven-dev` | `./requirements-driven-dev/SKILL.md` |
| `project-docs` | `./project-docs/SKILL.md` |
| `memory-skill` | `./memory-skill/SKILL.md` |
