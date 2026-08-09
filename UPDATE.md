# 更新指南

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
