# ADR-001：文档归档与标签索引（archive + tag）

| 属性 | 内容 |
|---|---|
| 状态 | 已采纳 |
| 日期 | 2026-09-19 |
| 决策者 | AI Agent |

## 背景

project-docs 原来硬编码 9 大分类 + 单一 root（docs/junsi-dev-docs），search 只搜该目录、organize 只扫 docs 顶层。面对已按自定义目录（cookbook/cordis-api/subsystems/…）组织好的文档树时，既搜不到，整理时又会丢失原有的功能组织结构（如 Qomicex.Harness/docs，171 篇文档、15 个目录标签）。

## 决策

改为「归档式整理 + 标签保留原功能结构」：① organize_docs 扫描 docs/**、项目根 *.md（排除 README/AGENTS/LICENSE/CHANGELOG/INSTALL/CONTRIBUTING 等元文件）及 roots 指定目录；② i18n 三件套（.md/.zh.md/.i18n.yaml/.schema.json）作为整体单元移动，目标扁平化为 docs/junsi-dev-docs/<分类>/<源路径slug>.md（slug 由源相对路径 / 替换为 --），同名自动加 -2；③ 分类由 AI 经 assignments 显式指定，未指定仅启发式建议、不自动移动；④ 默认 dry_run=true，必须显式 dry_run=false + assignments 才真正移动；⑤ 索引 docs/junsi-dev-docs/docs-index.json 记录 original_path，tags 由 original_path 目录段派生 + explicit_tags 叠加，original_path 兼作 revert_docs 回滚依据；⑥ query_docs 支持 tags 过滤并跨全 docs/ 检索；新增 index_docs/tag_docs/list_tags/revert_docs；README.md 增生成「归档文档」「标签索引」两节。已通过 171 篇真实文档 dry-run 与临时项目端到端（归档→打标→检索→回滚）验证。

## 备选方案

### 方案 原地索引不移动
- 优点：零风险、不改动文件
- 缺点：不满足“全部归档到 junsi-dev-docs”的诉求
- 为何不选：被用户否决

### 方案 纯启发式自动分类
- 优点：零 AI 参与、全自动
- 缺点：关键词启发式易错分（实测 agent-lifecycle→部署运维、glossary→API规范），会破坏仓库
- 为何不选：误分风险高，改为仅建议不自动移动

### 方案 frontmatter 存标签
- 优点：标签随文件、可移植
- 缺点：需批量改动 100+ 现有文档，侵入性强
- 为何不选：改用独立 JSON 索引，文件零改动

## 影响
- project-docs/mcp-server.py：新增扫描/索引/标签/归档/回滚逻辑与 5 个工具
- project-docs/SKILL.md：路由表新增 index_docs/tag_docs/list_tags/revert_docs
- docs/junsi-dev-docs/docs-index.json：新增标签索引文件

## 修订记录
| 日期 | 版本 | 修改内容 | 修改人 |
|---|---|---|---|
| 2026-09-19 | v1.0 | 初版创建 | AI Agent |