# Junsi Dev Toolkit

> 开发任务工具包 — AI 助手自动路由：代码移植、Bug修复、新功能开发、文档管理、任务记忆、Agent 集群。

## v2.3 核心能力

- **Cluster 模式（Agent 集群）**：主 Agent（`cluster`，Tab 切换）总体规划 → **动态检测本机可用模型**（`cluster-scan-models`，读 auth.json + 环境变量，标注多模态 ✅ 与成本）→ **问用户倾向**（💰性价比/🚀性能/⚖️平衡，或手动指定模型）→ 生成任务块→专精模型分配方案（`cluster-allocation`）→ **question 工具确认** → `cluster-task-prompt` 生成派发 prompt → 派发给 5 个专精 Subagent 并行执行 → 汇总验证。
- **模型按用途专精**：前端/看图任务自动选多模态模型（能识图确认页面效果）；模型擅长领域参考 https://arena.ai/leaderboard 的 WebDev/Image-to-WebDev/Vision/Coding 分榜。
- **Subagent 思考强度**：按模型能力自动注入 `reasoningEffort`（effort 档位模型给最高档）或 `reasoning: on`（toggle 模型），可手动调档。
- **Subagent 遵循子技能流程**：所有 Subagent 固化**通用合规层**（memory 强制 + project-docs 文档强制 + 完成清单 + ai-compliance + 文件编辑禁忌）；`cluster-task-prompt` 按任务类型注入对应子技能全文（feature/frontend/backend→RDD、bugfix/qa→diagnose、migrate→code-migrater、docs→project-docs）。
- **代码级路由 + 子技能全文注入**：插件用关键词正则匹配用户消息（含"优化/重构/改进/集群"等），命中 → 注入**对应子技能 SKILL.md 全文** + 强制路由宣告（`📌 路由宣告: {id}`）+ 强制完成清单；纯问答零注入，省 token。
- **Memory 工具**：`store-decision` / `save-progress` / `prepare-handoff` / `restore-handoff` 注册为真实工具，自动维护 `.memory/`、`INDEX.md`、`.gitignore`。
- **强制记忆与文档**：子技能完成清单强制调用 `store-decision`/`save-progress`，涉及 API/架构/UI 变更强制走 project-docs 的 `update_doc`/`create_adr`，禁止乱写文档。
- **文件编辑禁忌（硬性）**：禁止 PowerShell `Set-Content`/`-replace`/`Out-File` 修改源码（会破坏 UTF-8 编码），一律用编辑工具（详见 `shared/ai-compliance.md`）。
- **HANDOFF 自动恢复**：新会话检测 `.memory/HANDOFF.md` 自动注入恢复指令。
- **压缩上下文保护**：会话压缩时自动注入 `.memory` 摘要，跨压缩保留任务状态。
- **idle 自动痕迹**：会话空闲时自动初始化 `.memory/` 骨架并记录会话痕迹。

## 工具

| 工具 | 用途 | 触发词 |
|:---|:---|:---|
| **cluster** | Agent 集群：主控统筹 + 专精模型 Subagent 并行 | 集群、多agent、并行分工 |
| **code-migrater** | 跨语言/跨框架代码移植 | 移植、迁移、migrate |
| **diagnose-before-fix** | Bug 修复（8步流程 + 原始复测） | 报错、不工作、崩溃、白屏 |
| **requirements-driven-dev** | 新功能开发（澄清 -> 实现 -> 验证） | 添加、新增、实现 |
| **project-docs** | 项目知识中枢（15个MCP代码感知工具） | 文档、规范、ADR、API、路由 |
| **memory-skill** | 决策记忆、进度保存、跨会话恢复 | 记住、保存进度、换会话 |

## Cluster 模式

| Subagent | 职责 | 首选模型 |
|:---|:---|:---|
| `cluster`（主控） | 总体规划、分块、派发、汇总 | DeepSeek V4 Pro |
| `cluster-planner` | 需求细化、任务拆分（只读） | DeepSeek V4 Pro |
| `cluster-frontend` | 前端实现（多模态，可看图） | Kimi K3（未配 key 自动降级） |
| `cluster-backend` | 后端实现 | DeepSeek V4 Flash |
| `cluster-qa` | 测试/构建验证 | GLM-5.2 |
| `cluster-docs` | 文档/ADR | GLM-5.2 |

模型按本机实际配置（auth.json / 环境变量）自动检测注入，无 key 自动降级；任务分配时先问用户倾向（性价比/性能/平衡）再用 `question` 确认方案。

**流程遵循**：Subagent 派发 prompt 由 `cluster-task-prompt` 生成 = 任务描述 + 验收标准 + 通用合规层（memory/docs/完成清单/ai-compliance/编辑禁忌）+ 任务类型对应子技能全文。每个 Subagent 的 agent 定义也已固化通用合规层。

## 安装（OpenCode）

在 `opencode.jsonc` 的 `plugin` 数组添加：

```json
"junsi-dev-toolkit@git+https://github.com/TheMyceliumOfAntan/junsi-dev-toolkit.git"
```

或本地路径（克隆后）：

```json
"E:/my-skill"
```

重启 OpenCode。无需 `/skill` 调用，路由自动生效。

MCP Server 配置见 [INSTALL.md](INSTALL.md)。

## 架构

```
用户意图 → 插件代码级路由(关键词匹配，按需注入) → MCP定范围(直接调MCP工具)
  → 子技能SKILL.md(按需读取) → 执行 → 更新文档 → 保存进度(工具)
```

- **插件路由**：`junsi-dev-toolkit.js` 正则匹配开发意图关键词，命中才注入对应子技能全文；HANDOFF 检测与 memory/cluster 工具由插件承载。
- **MCP 定范围**：路由前直接调 MCP 工具定位目录/端点/组件/文件，子技能只在范围内精细解析。
- **MCP 工具**：`project_tree`、`api_endpoints`、`frontend_routes`、`component_inventory`、`project_config`、`tauri_commands`、`tauri_capabilities`、`api_client`、`stores`、`hooks`、`code_context`、`query_docs`、`create_adr`、`update_doc`、`generate_docs`。
- **Memory 工具**：插件注册 4 个真实工具，`.memory/` 目录持久化进度和决策，HANDOFF 支持跨会话恢复。
- **Cluster 工具**：`cluster-scan-models`（动态检测）、`cluster-allocation`（分配方案）、`cluster-task-prompt`（派发 prompt 注入子技能流程）。

## 快速使用

| 你想做什么 | 对 AI 说 |
|:---|:---|
| 移植代码 | "把 Java 项目移植到 Go" |
| 修复 Bug | "这个接口返回空列表了" |
| 添加功能 | "加一个导出 CSV 功能" |
| 查询文档 | "API 响应格式是什么规范？" |
| 保存进度 | "记一下做到哪了" |

## 许可

MIT
