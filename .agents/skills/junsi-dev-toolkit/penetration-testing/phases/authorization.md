---
name: authorization
description: 授权测试阶段详细指南 (WSTG-ATHZ) - IDOR、越权访问、HTTP 方法绕过、CSRF、权限矩阵
---

# Phase 4: 授权测试 (WSTG-ATHZ)

## 测试目标

1. 检测 IDOR 与横向/纵向越权
2. 检测 HTTP 方法与路径变形绕过访问控制
3. 检测 CSRF（状态变更请求）
4. 灰盒下用权限矩阵验证覆盖度

## 安全约束

- 遍历限速：单账号 ≤ 20 id/分钟
- 只做"证明可访问"级别验证：读取即停，不批量拉取、不修改他人数据
- 前端隐藏 ≠ 无功能，必须直接请求接口

---

## 4.1 IDOR 与越权访问

### 测试原理

对象引用直接暴露（数字 ID / UUID / 哈希 ID），服务端不校验对象归属。双账号法：账号 A 的资源，用账号 B 的会话访问。

### 检查点

- [ ] URL / 表单 / JSON body / 自定义 Header 中的对象 ID
- [ ] 替换为：他人 ID、不存在 ID、越权角色 ID
- [ ] 批量接口 `/users?id[]=1&id[]=2`
- [ ] 未登录直接访问对象 URL

### 测试脚本

```powershell
function Test-Idor {
    param(
        [string]$UrlTemplate,   # 例: "https://target/api/orders/{id}"
        [int[]]$Ids,
        [string]$VictimId,      # 属于他人账号的对象 ID
        [hashtable]$Headers     # 攻击者会话的 Cookie/Token
    )

    foreach ($id in $Ids) {
        $url = $UrlTemplate -replace '\{id\}', $id
        try {
            $resp = Invoke-WebRequest -Uri $url -Headers $Headers -UseBasicParsing -ErrorAction Stop
            $tag = if ($id.ToString() -eq $VictimId) { "[!] 可访问他人对象" } else { "[+] 可访问" }
            Write-Host "$tag $url - $($resp.StatusCode)"
        } catch {
            Write-Host "[-] $url - $($_.Exception.Response.StatusCode.value__)"
        }
        Start-Sleep -Milliseconds 300  # 限速
    }
}

# 用法：Test-Idor -UrlTemplate "https://target/api/orders/{id}" -Ids @(1001,1002,1003) -VictimId 1002 -Headers @{ Cookie = "session=ATTACKER" }
```

### 判定标准

攻击者会话拿到他人对象数据（200 + 非空业务数据）→ 高危（视数据敏感度可升严重）；仅返回 403/空 → 不存在。

### 修复建议

服务端按会话主体校验对象归属；UUIDv4 仅作缓解（不解决无校验问题）；批量接口同样校验。

---

## 4.2 HTTP 方法与路径变形绕过

### 测试原理

访问控制只挡了 `/admin` 的 GET，没挡方法/路径规范化变体。

### 测试脚本

```powershell
$protectedPath = "/admin/users"
$variants = @(
    @{ method = "GET";     path = $protectedPath },
    @{ method = "PUT";     path = $protectedPath },
    @{ method = "DELETE";  path = $protectedPath },
    @{ method = "PATCH";   path = $protectedPath },
    @{ method = "OPTIONS"; path = $protectedPath },
    @{ method = "TRACE";   path = $protectedPath },
    @{ method = "GET";     path = "$protectedPath/" },              # 尾斜杠
    @{ method = "GET";     path = "$protectedPath/." },             # 路径点
    @{ method = "GET";     path = "$protectedPath;x=1" },           # 参数附加
    @{ method = "GET";     path = "$protectedPath%20" },            # 尾部编码空格
    @{ method = "GET";     path = ($protectedPath -replace '/admin', '/ADMIN') }  # 大小写
)

foreach ($v in $variants) {
    try {
        $resp = Invoke-WebRequest -Uri "$TARGET_URL$($v.path)" -Method $v.method -UseBasicParsing -ErrorAction Stop
        Write-Host "[!] $($v.method) $($v.path) -> $($resp.StatusCode) (Size: $($resp.Content.Length))"
    } catch {
        Write-Host "[-] $($v.method) $($v.path) -> $($_.Exception.Response.StatusCode.value__)"
    }
    Start-Sleep -Milliseconds 200
}
```

附加绕过头：

```text
X-HTTP-Method-Override: DELETE
X-Method-Override: GET
X-Original-URL: /admin
X-Rewrite-URL: /admin
```

### 判定标准

任一变形返回 200 且内容与授权访问一致 → 高危（访问控制缺失）。

### 修复建议

在统一网关/中间件层做访问控制；按规范化后的 method+path 判权；不信任 Override 类头。

---

## 4.3 CSRF 测试

### 测试原理

状态变更请求不校验请求来源，攻击者站点可诱导已登录用户浏览器代为提交。

### 检查点

- [ ] 状态变更请求（POST/PUT/DELETE）是否强制校验 token
- [ ] token：缺失/可预测/未绑会话/跨用户可用/仅校验存在性
- [ ] Cookie `SameSite`（None 才可跨站 POST）
- [ ] Origin/Referer 校验是否可绕过（删头、空值、子域前缀）
- [ ] JSON 接口能否用 form 表单触发（Content-Type 不校验）

### 验证方法（只验证，不真实提交）

用影响最小的接口（如把自身资料改为当前值）验证 token 是否强制：

```powershell
# 1. 正常请求带 token → 200
$body = @{ nickname = "SELF"; csrf_token = "VALID_TOKEN" }
$ok = Invoke-WebRequest -Uri "$TARGET_URL/api/profile" -Method Post -Body $body -UseBasicParsing -ErrorAction SilentlyContinue

# 2. 去 token / 改 token 重放
$noToken = Invoke-WebRequest -Uri "$TARGET_URL/api/profile" -Method Post -Body @{ nickname = "SELF" } -UseBasicParsing -ErrorAction SilentlyContinue

# 判定：两者都 200 或业务成功 → token 未强制校验 → 高危
```

### 判定标准

缺失/无效 token 仍执行状态变更 → 高危；token 可预测 → 严重。

### 修复建议

`SameSite=Lax/Strict` + 同步/双重提交 token；Origin/Referer 缺失即拒绝；JSON 接口校验 Content-Type。

---

## 4.4 权限矩阵测试（灰盒）

对每个角色 × 每个敏感功能建矩阵，用低角色会话访问高角色功能：

```text
| 功能 | 匿名 | 普通用户 | 商户 | 管理员 |
|------|------|----------|------|--------|
| GET /api/users 列表 | 401 | 403 | 403 | 200 |
| GET /api/orders/{他人} | 401 | 403 | 200(!) | 200 |
| POST /api/coupon/issue | 401 | 403 | 403 | 200 |
```

矩阵中任何"低角色 200"单元格即越权证据，按敏感度定级。

## 误报说明

- 403 可能来自 WAF 而非业务鉴权，结合响应体/响应头区分
- "可访问"要看响应是否含真实业务数据，空壳页/重定向页不算

## 输出格式

| 漏洞类型 | 位置 | 参数 | Payload | 证据 | 风险 | 修复建议 |
