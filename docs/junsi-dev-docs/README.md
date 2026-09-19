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


### 2026-09-19 更新
## 归档与标签（archive + tag）

新增工具（处理已按自定义目录整理的文档树，如 `docs/cookbook/`、`docs/subsystems/`）：

- 原地登记索引：`index_docs(dry_run=false)` — 扫描 `docs/**` 与项目根，登记到 `docs/junsi-dev-docs/docs-index.json`，不移动文件
- 归档整理：`organize_docs(assignments=[{path,category}], dry_run=false)` — 按 9 大分类归档，原路径写入索引并转为 tag；默认 `dry_run=true` 仅预览
- 打标签：`tag_docs(paths, tags, mode="add|remove|set")` — 写入索引，不改动文档文件
- 查标签：`list_tags(tag)`
- 回滚：`revert_docs(dry_run=false)` — 按 `original_path` 把文档移回原位
- 按标签检索：`query_docs(tags=["cookbook","core"])` — tag 为 AND 匹配，跨全 `docs/` 检索

标签来源 = 原路径目录段（自动派生）+ `explicit_tags`（手动叠加）。
