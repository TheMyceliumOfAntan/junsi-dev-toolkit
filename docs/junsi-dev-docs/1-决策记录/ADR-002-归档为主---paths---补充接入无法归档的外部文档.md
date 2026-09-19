# ADR-002：归档为主 + paths[] 补充接入无法归档的外部文档

| 属性 | 内容 |
|---|---|
| 状态 | 已采纳 |
| 日期 | 2026-09-19 |
| 决策者 | AI Agent |

## 背景

organize_docs 的核心能力是整理归档（把散落文档移动进 docs/junsi-dev-docs/ 的 9 大分类，原位置记为 original_path 并派生标签，可 revert_docs 回滚）。但部分文档树（如 Qomicex.Harness 的 docs/）被生成器硬编码路径、i18n 配对门禁、VitePress 路由表与成百条相对链接强绑定，物理移动会拆掉整条文档工具链，属于「实在无法归档」。需要让这类文档也能被检索，同时坚决不移动它们。

## 决策

在保留并强化归档能力的前提下，附加 paths[] 外部接入：① organize_docs 的归档移动语义完全保留（dry_run 默认 true，需 assignments 显式分类 + dry_run=false 才移动；original_path 派生标签；revert_docs 回滚）；② docs-index.json 新增顶层 paths[{id?, path}]，登记 junsi-dev-docs 之外无法归档的文档/目录；③ 扫描顺序 = 先 junsi-dev-docs（含 roots/include_root 散落文档），再续扫 paths[]；④ 外部文档 external=True、自动分配 id（paths 条目 id 可覆盖），organize_docs 归档时显式跳过 external 单元（绝不移动）；⑤ query_docs/list_tags 跨内外部检索，tags AND；tag_docs 内部用 paths、外部用 ids；index_docs 支持 paths 参数登记新外部路径。验证：Harness 只读探针 —— 未登记时 organize 列出 167 篇待归档；登记 path=docs 后 organize 报「没有待归档的散落文档」且 query 续扫 167 外部文档/全带 id；自检覆盖归档→回滚与 paths 接入→id 打标→tag 检索。

## 备选方案

### 方案 用 paths[] 取代物理移动
- 优点：对工具链绑定项目零风险
- 缺点：丢失 organize_docs 的核心归档能力，违反用户明确意图
- 为何不选：被用户否决（我误删归档功能）

### 方案 对无法归档的文档放弃检索
- 优点：实现最简单
- 缺点：Harness 等项目的全部文档搜不到
- 为何不选：paths[] 成本低且满足检索诉求

### 方案 移动 + 绑定预检 + force
- 优点：安全地移动
- 缺点：对 Harness 仍不可用，复杂度高
- 为何不选：paths[] 已覆盖此类场景

## 影响
- project-docs/mcp-server.py：_scan_units 续扫 paths[] 并标记 external/id；organize_docs 跳过 external；index_docs 支持 paths；tag_docs 支持 ids；search_docs 按 id 取标签
- project-docs/SKILL.md：归档与 paths[] 双能力说明
- docs/junsi-dev-docs/docs-index.json：schema v2 增加 paths[] 与 id/external 字段

## 修订记录
| 日期 | 版本 | 修改内容 | 修改人 |
|---|---|---|---|
| 2026-09-19 | v1.0 | 初版创建 | AI Agent |