# 项目文档索引

这是 `junsi-dev-toolkit` 项目知识中枢的文档模板。

安装工具包后，AI 会自动将项目文档管理在此目录下。

## 目录结构

```
docs/junsi-dev-docs/
├── 1-决策记录/     # ADR 架构决策记录
├── 2-架构设计/     # 系统架构、模块设计
├── 3-API规范/      # RESTful API 设计规范
├── 4-编码规范/     # 各语言编码规范
├── 5-数据库设计/   # 表结构、ER 图
├── 6-UI/组件设计/  # UI 控件、组件设计规范
├── 7-调用规范/     # 服务间调用、异常处理、日志规范
├── 8-部署运维/     # 部署架构、环境配置
└── 9-系统要求/     # 功能需求、非功能需求
```

## 使用方式

通过 `project-docs` MCP Server 管理文档，无需手动操作：

- 查询文档：`query_docs(keywords="关键词")`
- 创建 ADR：`create_adr(title, background, decision)`
- 更新文档：`update_doc(doc_path, content, change_description)`
- 整理文档：`organize_docs()`
- 生成文档：`generate_docs(doc_types=[...])`
