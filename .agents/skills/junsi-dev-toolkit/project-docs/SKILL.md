---
name: project-docs
description: 项目知识中枢。通过 MCP Server 统一管理项目文档 + 提供代码感知分析。触发词：文档、规范、ADR、架构、设计、API、组件、项目结构、端点、路由。
---

# 项目知识中枢（Project Docs MCP）

## 概述

MCP Server 提供两类能力：
1. **文档管理**：查询、创建 ADR、更新、整理、生成文档
2. **代码感知**：项目树、API 端点、前端路由、组件清单、配置摘要

## 路由规则

| 用户意图 | 调用的 MCP 工具 |
|---------|----------------|
| 查询文档 | `query_docs` |
| 创建 ADR | `create_adr` |
| 更新/创建文档 | `update_doc` |
| 整理散落文档 | `organize_docs` |
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

## 错误处理

MCP Server 不可用时提示用户检查 Python 环境和 MCP 配置，不阻塞任务。
