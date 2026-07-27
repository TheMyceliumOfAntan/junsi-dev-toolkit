---
name: project-docs
description: 项目知识中枢。通过 MCP Server 统一管理所有项目文档。触发词：文档、规范、ADR、架构、设计、UI、控件、组件、调用规范、系统设计、决策记录、整理文档、生成文档。
---

# 项目知识中枢（Project Docs MCP 路由层）

## 概述

本项目知识中枢基于 **MCP (Model Context Protocol)** 实现，所有文档操作通过 MCP Server 执行。

## 工作流

### 1. 路由用户请求到 MCP 工具

| 用户意图 | 调用的 MCP 工具 | 说明 |
|:---|:---|:---|
| 查询文档 | `query_docs` | 搜索并返回匹配的文档 |
| 创建 ADR | `create_adr` | 创建架构决策记录 |
| 更新文档 | `update_doc` | 更新现有文档 |
| 整理文档 | `organize_docs` | 扫描并归类散落文档 |
| 生成专题文档 | `generate_docs` | 生成任意类型的专题文档（如启动流程、联机流程），AI 先分析代码再生成 |

### 2. MCP 调用方式

所有操作通过 MCP 协议调用 `project-docs` Server：

```
调用 MCP 工具：project-docs.[tool_name]
参数：[根据工具定义的参数]
```

### 3. Plan 模式检测

同 junsi-dev-toolkit 统一规则。

### 4. 错误处理

如果 MCP Server 未响应：
- 提示用户："⚠️ MCP Server `project-docs` 不可用。请检查：1) MCP 配置是否正确 2) Python 环境是否就绪 3) 依赖是否已安装"
- 降级方案：可手动在 `docs/junsi-dev-docs/` 下操作，但建议先修复 MCP 连接。
