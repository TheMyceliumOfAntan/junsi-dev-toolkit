# 更新指南

## v2.0（2026-10）— OpenCode V2 移植

- **宿主 API 从 `@opencode-ai/plugin` (V1) 迁移到 `@opencode/plugin` (V2)**：入口由 `export const XxxPlugin = async ({ client, directory }) => ({ tool, ... })` 改为 `export default Plugin.define({ id, setup(ctx) })`。
- **注册机制重写**：`config.skills.paths.push` → `ctx.skill.transform(editor.add(...))`；`config.agent[name]=def` → `ctx.agent.transform(editor.update(id, ...))`（缺失即创建）；`tool` 映射 → `ctx.tool.transform(editor.add({ name, description, input: JSONSchema, execute }))`。
- **钩子重写**：`experimental.chat.messages.transform` / `chat.params` → `ctx.session.hook('prompt', ...)`（准入时注入路由）；`experimental.session.compacting` → `ctx.session.hook('compaction', ...)`（注入 `event.system` 记忆上下文）；`event` 回调 → `ctx.event.subscribe({ signal })` 异步迭代 + 卸载时 `AbortController.abort()`。
- **Agent 字段映射**：V1 `prompt` → V2 `system`；`temperature`/`options.reasoningEffort` → `request.body.*`；V1 `permission` 映射 → V2 `permissions: [{ action, resource, effect }]`；`model` 字符串 `"provider/model"` → `{ providerID, id }`。
- **配置改名**：`opencode.json` 的 `plugin` → `plugins`。
- **依赖**：`package.json` 依赖由 `@opencode-ai/plugin ^1.18.13` 改为 `@opencode/plugin ^2.0.29`。
- 验证脚本同步到 V2（`verify-registration.mjs` 用 mock ctx 触发 `setup` 并断言注册）。

## v3.2（2026-08）

- `diagnose-before-fix` 全盘融合 Claude Opus 5 对抗性审查流程：证据三档标签（已证明/已读证/潜在）、先立基线、warning 索引、一次性探针、改根因不改症状、回归必须验证"没修复时会失败"、实测细则（一次一变量/副作用/观测窗口/不动用户环境）、报告规范（严重度排序/修复前后对比）、反模式清单

## v3.1（2026-08）

- 新增 `advisor` 子技能（决策顾问：权衡矩阵 + question 确认，priority 3.5）
- 新增 `computer-use` 子技能（playwright MCP 浏览器自动化，priority 2.5）
- 新增 `tool-search` / `cron-create` 实用工具（12 工具共注册）
- 验证脚本同步：文件清单 + 工具数 10 → 12

## OpenCode（Plugin）

本地克隆方式：

```bash
cd E:/my-skill && git pull
```

npm 安装方式：重新安装或更新 package。

重启 OpenCode 后生效。

## 其他 AI 工具

```bash
cd ~/.agents/skills/junsi-dev-toolkit
git pull origin master
```

如有 MCP 依赖更新：

```bash
pip install --upgrade mcp pydantic
```
