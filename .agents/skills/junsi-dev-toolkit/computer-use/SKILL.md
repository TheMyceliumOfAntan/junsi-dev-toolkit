---
name: computer-use
description: 计算机操作/浏览器自动化。用户要操作电脑（模拟鼠标键盘、桌面自动化）或控制浏览器（截图、点击、填表、自动化测试）时启用。依赖 playwright MCP（官方 @playwright/mcp，跨平台），未配置则先给配置指引。**This is a sub-tool of junsi-dev-toolkit. Do not trigger directly unless routed by junsi-dev-toolkit.**
---

# Computer Use（计算机操作 / 浏览器自动化）

## 前置：playwright MCP 配置

在 opencode.json 添加（官方版，跨平台 Win/macOS/Linux）：

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

重启 OpenCode 生效。未配置 → 把上述配置给用户，不空转尝试操作。

### 桌面级操作（备选 MCP）

playwright 只覆盖浏览器。需要操作整个桌面（屏幕截图 + 鼠标键盘移动整个系统）时，可配第三方 computer-use MCP（experimental）。⚠️ **Anthropic 官方未发布过 npm 包**：`@anthropic-ai/mcp-server-computer-use` 在 registry 返回 404，切勿使用该包名。可选社区实现如 `@zavora-ai/computer-use-mcp`（跨平台 macOS/Windows/Linux，Rust 原生模块）：

```json
{
  "mcp": {
    "computer-use": {
      "type": "local",
      "command": ["npx", "-y", "@zavora-ai/computer-use-mcp@latest"],
      "enabled": true
    }
  }
}
```

两个 MCP 可并存：浏览器任务用 `playwright`，桌面任务用 `computer-use`。桌面操作同样遵守下方"操作闭环"（先截图 → 操作 → 验证）。第三方包为社区维护，启用前自行评估风险。

## 操作闭环（每次操作必须遵守）

1. **截图** → 观察当前状态（playwright 截图工具）
2. **定位** → 用 text/selector 精确定位目标元素
3. **操作** → 小步执行：点击/输入/滚动，一次只做一步
4. **验证** → 立即截图确认结果，符合预期才继续
5. **失败** → 截图 + 描述实际状态，调整定位重试（最多 2 次），仍失败则问用户

## 规范

- 任何操作前先截图，禁止盲操作
- 输入框先 click 再 fill
- 页面导航/刷新后必须重新截图
- 涉及登录/凭据 → 先问用户凭据来源，不猜密码
- 只读验证场景（如 curl 页面）可用 bash 降级替代
- 桌面级鼠标键盘自动化需要专门的 computer-use MCP，本技能只覆盖浏览器（playwright）
