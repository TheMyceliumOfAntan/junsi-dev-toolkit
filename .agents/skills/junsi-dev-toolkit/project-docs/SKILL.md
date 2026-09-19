---
name: project-docs
description: 项目知识中枢。通过 MCP Server 统一管理项目文档 + 提供代码感知分析。触发词：文档、规范、ADR、架构、设计、API、组件、项目结构、端点、路由。
---

# 项目知识中枢（Project Docs MCP）

## 概述

MCP Server 提供两类能力：
1. **文档管理**：查询、创建 ADR、更新、整理归档、标签、生成文档
2. **代码感知**：项目树、API 端点、前端路由、组件清单、配置摘要

## 路由规则

| 用户意图 | 调用的 MCP 工具 |
|---------|----------------|
| 查询文档 | `query_docs`（支持 `tags` 过滤，跨全 `docs/` 检索） |
| 创建 ADR | `create_adr` |
| 更新/创建文档 | `update_doc` |
| 登记/刷新文档索引 | `index_docs` |
| 归档散落文档（不移动的超集：默认 dry_run 预览） | `organize_docs` |
| 回滚归档 | `revert_docs` |
| 打标签 | `tag_docs` |
| 查标签 | `list_tags` |
| 生成专题文档 | `generate_docs` |
| 看项目结构 | `project_tree` |
| 看后端 API | `api_endpoints` |
| 看前端路由 | `frontend_routes` |
| 看组件清单 | `component_inventory` |
| 看配置摘要 | `project_config` |
| 看 Tauri command | `tauri_commands` |
| 看 Tauri 权限 | `tauri_capabilities` |
| 看前端 API 调用 | `api_client` |
| 看状态管理 | `stores` |
| 看自定义 Hook | `hooks` |

## 在 junsi-dev-toolkit 中的使用

根路由的 MCP 子代理调度会调用 `query_docs` 查询项目知识，并自动带出代码感知工具的上下文（端点、路由、组件等），注入给子技能。

## 归档与标签

- 标签来源 = 原路径目录段（`original_path` 自动派生）+ `explicit_tags`（`tag_docs` 叠加），索引存于 `docs/junsi-dev-docs/docs-index.json`，不改动文档文件。
- `organize_docs` **默认 `dry_run=true` 仅预览**；要真正移动必须传 `assignments=[{path,category}]` 且 `dry_run=false`。未显式分类的文档只给启发式建议、不移动（避免误分破坏仓库）。移动前先跑 dry_run 复核。
- 分类不确定时先 `query_docs`/`list_tags` 了解现状，再定 `assignments`；移动后原功能结构保留为 tag，可 `revert_docs` 回滚。

## 错误处理

MCP Server 不可用时提示用户检查 Python 环境和 MCP 配置，不阻塞任务。
