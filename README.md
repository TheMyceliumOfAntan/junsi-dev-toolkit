# Junsi Dev Toolkit

> 开发任务工具包 — AI 助手自动路由：代码移植、Bug修复、新功能开发、文档管理、任务记忆、Agent 集群、决策顾问、浏览器自动化。

## v3.1 核心能力

- **决策顾问（advisor）**：多方案权衡矩阵 → 明确推荐 → question 确认 → store-decision 落地，覆盖"哪个方案好/怎么选"类复杂决策。
- **浏览器自动化（computer-use）**：playwright MCP 操作闭环（截图 → 定位 → 操作 → 验证），含 opencode.json 配置模板。
- **工具检索（tool-search）**：内置工具索引，按关键词返回最合适工具 + 使用时机，解决"不知道用哪个工具"。
- **定时任务（cron-create）**：Windows 计划任务（schtasks）创建/列出/删除，支持"定时提醒/每天执行"。

- **Cluster 模式（Agent 集群）**：主 Agent（`cluster`，Tab 切换）总体规划 → **动态检测本机可用模型**（`cluster-scan-models`，读 auth.json + 环境变量）→ 生成任务块→专精模型分配方案（`cluster-allocation`）→ **question 工具问用户确认** → 派发给 5 个专精 Subagent 并行执行 → 汇总验证。Subagent 模型按本机可用性自动降级。
- **代码级路由 + 子技能全文注入**：插件用关键词正则匹配用户消息（含"优化/重构/改进/集群"等），命中 → 注入**对应子技能 SKILL.md 全文** + 强制路由宣告（`📌 路由宣告: {id}`）+ 强制完成清单；纯问答零注入，省 token。
- **Memory v3（7 个真实工具）**：`store-decision`（支持 `scope=global` 全局决策）/ `save-progress`（进度历史版本化，不覆盖）/ `prepare-handoff` / `restore-handoff`（`complete` 归档）/ `list-decisions`（分词模糊检索，合并项目+全局）/ `memory-doctor`（健康审计）/ `save-preference`（全局偏好）。自动维护 `.memory/`、`INDEX.md`（≤200 行硬上限）、`.gitignore`。
- **强制记忆与文档**：子技能完成清单强制调用 `store-decision`/`save-progress`，涉及 API/架构/UI 变更强制走 project-docs 的 `update_doc`/`create_adr`，禁止乱写文档。
- **HANDOFF 自动恢复**：新会话检测 `.memory/HANDOFF.md` 自动注入恢复指令；完成后 `complete: true` 归档到 `sessions/` 并移除，防过期残留。
- **全局记忆层**：`~/.config/opencode/.memory/` 存跨项目偏好与全局决策，新会话启动注入偏好，压缩时注入全局决策画像。
- **压缩上下文保护**：会话压缩时按预算装配注入（全局偏好 → 任务索引 → 项目/全局决策画像 → HANDOFF 摘要），跨压缩保留任务状态。
- **idle 自动痕迹**：会话空闲时写入真实会话摘要（进度 + 决策），形成任务时间线。

## 工具

| 工具 | 用途 | 触发词 |
|:---|:---|:---|
| **cluster** | Agent 集群：主控统筹 + 专精模型 Subagent 并行 | 集群、多agent、并行分工 |
| **code-migrater** | 跨语言/跨框架代码移植 | 移植、迁移、migrate |
| **diagnose-before-fix** | Bug 修复（证据优先：基线/三档证据/探针/回归验证会失败） | 报错、不工作、崩溃、白屏 |
| **requirements-driven-dev** | 新功能开发（澄清 -> 实现 -> 验证） | 添加、新增、实现 |
| **project-docs** | 项目知识中枢（15个MCP代码感知工具） | 文档、规范、ADR、API、路由 |
| **memory-skill** | 决策记忆、进度保存、跨会话恢复、记忆审计 | 记住、保存进度、换会话、有哪些决策、健康审计 |
| **advisor** | 决策顾问（权衡矩阵 + 推荐 + 确认） | 顾问、权衡、方案对比、选哪个 |
| **computer-use** | 浏览器自动化（playwright MCP 操作闭环） | computer_use、操作电脑、浏览器自动化 |
| **tool-search** | 工具索引检索（找最合适工具） | 找工具、用哪个工具 |
| **cron-create** | Windows 计划任务（schtasks） | 定时提醒、每天执行、计划任务 |

## Cluster 模式

| Subagent | 职责 | 首选模型 |
|:---|:---|:---|
| `cluster`（主控） | 总体规划、分块、派发、汇总 | DeepSeek V4 Pro |
| `cluster-planner` | 需求细化、任务拆分 | DeepSeek V4 Pro |
| `cluster-frontend` | 前端实现 | Kimi K3（未配 key 自动降级） |
| `cluster-backend` | 后端实现 | DeepSeek V4 Flash |
| `cluster-qa` | 测试/构建验证 | GLM-5.2 |
| `cluster-docs` | 文档/ADR | GLM-5.2 |

模型按本机实际配置（auth.json / 环境变量）自动检测注入；任务分配时用 `question` 工具向用户确认方案。

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

### Agent 自动化安装（Prompt 模板）

把下面这段 prompt 原样发给任意 AI 助手（opencode / Claude Code / Cursor / Codex），让它自动完成安装与校验：

````text
你是安装助手。请在本机自动安装/升级 junsi-dev-toolkit（v3.1）：
1. 定位 OpenCode 配置文件（全局 ~/.config/opencode/ 或项目根目录下的 opencode.json / opencode.jsonc）
2. 检查 plugin 数组中是否已包含 "junsi-dev-toolkit"；未包含则在末尾追加 "junsi-dev-toolkit@git+https://github.com/TheMyceliumOfAntan/junsi-dev-toolkit.git"（本地克隆存在时用绝对路径代替）
3. 运行 `pwsh scripts/verify-install.ps1 -RepoPath <本仓库路径>` 检验安装副本（任一项 FAIL 说明旧版或损坏）：FAIL 时先删除旧安装副本（opencode 缓存 packages 目录或 node_modules 下的 junsi-dev-toolkit），再重新安装插件或 git pull 后重装，重跑验证直到全部 PASS
4. 验证通过后输出摘要（工具数 12、子技能数、仓库 hash 是否一致），并提醒用户"重启 OpenCode 后生效"
约束：只改动 OpenCode 配置与本工具包安装副本，不得改动其他项目配置；配置存在冲突或不确定时先询问用户。
````

> 提示：给 opencode 发此 prompt 后，它会在验证阶段自动运行 `scripts/verify-install.ps1` 并粘贴输出；全部 PASS 才算安装成功。

### 可选：浏览器自动化（computer-use）

`computer-use` 子技能依赖 playwright MCP，在 `opencode.json` 添加后重启：

```json
{
  "mcp": {
    "playwright": {
      "type": "local",
      "command": ["npx", "@playwright/mcp@latest"],
      "enabled": true
    }
  }
}
```

未配置时触发该路由只会得到配置指引，不会报错；不使用时也可不装。桌面级操作（整个屏幕 + 鼠标键盘）可另配 Anthropic `@anthropic-ai/mcp-server-computer-use`（见 `computer-use` 子技能）。

### 可选：环境变量开关

| 能力 | 开关 | 说明 |
|:---|:---|:---|
| `websearch` 网络搜索 | `OPENCODE_ENABLE_EXA=1` | 启动前设置环境变量 |
| `lsp` 代码智能 | `OPENCODE_EXPERIMENTAL_LSP_TOOL=true` | 启动前设置环境变量 |

## 验证安装 / 升级

```powershell
# 快速检验：自动定位安装副本，检查文件完整性/语法/版本标记/12 工具注册
pwsh scripts/verify-install.ps1

# 与源码仓库对比（hash 一致性，确认已升级到最新）
pwsh scripts/verify-install.ps1 -RepoPath <仓库路径>

# 深度模式：真实加载插件验证工具注册 + memory-doctor 冒烟（需联网装依赖，一次性）
pwsh scripts/verify-install.ps1 -Full
```

任一项 FAIL 即未安装成功或未升级到位；全部 PASS 表示新会话即可使用。旧版安装副本会如实报 FAIL（如缺 `tool-search`/`cron-create`、缺 `advisor`/`computer-use` 子技能文件、hash 不一致），提示重新安装。

## 架构

```
用户意图 → 插件代码级路由(关键词匹配，按需注入) → MCP定范围(直接调MCP工具)
  → 子技能SKILL.md(按需读取) → 执行 → 更新文档 → 保存进度(工具)
```

- **插件路由**：`junsi-dev-toolkit.js` 正则匹配开发意图关键词，命中才注入精简指令；HANDOFF 检测与 memory 工具由插件承载。
- **MCP 定范围**：路由前直接调 MCP 工具定位目录/端点/组件/文件，子技能只在范围内精细解析。
- **MCP 工具**：`project_tree`、`api_endpoints`、`frontend_routes`、`component_inventory`、`project_config`、`tauri_commands`、`tauri_capabilities`、`api_client`、`stores`、`hooks`、`code_context`、`query_docs`、`create_adr`、`update_doc`、`generate_docs`。
- **Memory 工具**：插件注册 7 个真实工具，`.memory/` 目录持久化进度（含历史版本）和决策，HANDOFF 支持跨会话恢复；`~/.config/opencode/.memory/` 承载跨项目全局偏好与决策。

## 快速使用

| 你想做什么 | 对 AI 说 |
|:---|:---|
| 移植代码 | "把 Java 项目移植到 Go" |
| 修复 Bug | "这个接口返回空列表了" |
| 添加功能 | "加一个导出 CSV 功能" |
| 查询文档 | "API 响应格式是什么规范？" |
| 保存进度 | "记一下做到哪了" |
| 回顾决策 | "有哪些决策" / "回顾决策" |
| 记忆体检 | "健康审计" / "记忆体检" |
| 决策权衡 | "这两个方案怎么选" / "权衡一下利弊" |
| 浏览器操作 | "帮我打开网页点一下这个按钮" |
| 定时任务 | "每天早上 9 点执行这个脚本" |

## 许可

MIT
