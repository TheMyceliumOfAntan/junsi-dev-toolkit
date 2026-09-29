---
name: info-gathering
description: 信息收集阶段详细指南 (WSTG-INFO)
---

# Phase 1: 信息收集 (WSTG-INFO)

信息收集是渗透测试的第一步，目的是全面了解目标系统。

## 测试目标

1. 识别服务器类型和版本
2. 发现技术栈（框架、语言、CMS）
3. 发现敏感路径和文件
4. 收集子域名和端口信息

## 详细步骤

### Step 1.1: 基础 HTTP 探测

```powershell
# 获取响应头信息
$response = Invoke-WebRequest -Uri "TARGET_URL" -Method Head -UseBasicParsing
$response.Headers | Format-Table -AutoSize

# 关注以下信息：
# - Server: 服务器类型
# - X-Powered-By: 技术栈
# - X-AspNet-Version: ASP.NET 版本
# - Set-Cookie: Cookie 配置
```

### Step 1.2: 技术指纹识别

```powershell
# 获取页面内容，分析技术特征
$response = Invoke-WebRequest -Uri "TARGET_URL" -UseBasicParsing

# 检测常见框架特征
$technologies = @{
    "WordPress" = "wp-content|wp-includes"
    "Drupal" = "drupal"
    "Joomla" = "joomla"
    "Laravel" = "laravel"
    "Django" = "django"
    "React" = "react"
    "Vue.js" = "vue\.js|vuejs"
    "Angular" = "angular"
    "jQuery" = "jquery"
    "Bootstrap" = "bootstrap"
}

foreach ($tech in $technologies.GetEnumerator()) {
    if ($response.Content -match $tech.Value) {
        Write-Host "[+] Detected: $($tech.Key)"
    }
}
```

### Step 1.3: 敏感路径探测

```powershell
# 常见敏感路径列表
$sensitivePaths = @(
    # 配置文件
    "/robots.txt",
    "/sitemap.xml",
    "/.env",
    "/.git/config",
    "/web.config",
    "/.htaccess",
    
    # 管理后台
    "/wp-admin",
    "/wp-login.php",
    "/administrator",
    "/phpmyadmin",
    "/admin",
    "/login",
    
    # API 端点
    "/api",
    "/api/v1",
    "/swagger",
    "/docs",
    "/graphql",
    
    # 备份文件
    "/backup",
    "/db",
    "/database.sql",
    "/dump.sql",
    
    # 安全策略
    "/.well-known/security.txt",
    "/crossdomain.xml",
    "/clientaccesspolicy.xml",
    
    # 调试信息
    "/server-status",
    "/server-info",
    "/trace.axd"
)

# 探测每个路径
foreach ($path in $sensitivePaths) {
    try {
        $resp = Invoke-WebRequest -Uri "$TARGET_URL$path" -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
        $status = $resp.StatusCode
        $size = $resp.Content.Length
        Write-Host "[+] $path - Status: $status - Size: $size"
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($statusCode) {
            Write-Host "[-] $path - Status: $statusCode"
        } else {
            Write-Host "[-] $path - Connection failed"
        }
    }
    Start-Sleep -Milliseconds 200  # 限速，避免触发 WAF
}
```

### Step 1.4: 错误页面分析

```powershell
# 触发错误，分析错误信息
$testUrls = @(
    "$TARGET_URL/ nonexistent-page-$((Get-Random).ToString())",
    "$TARGET_URL/?id=abc",
    "$TARGET_URL/?param=<>"
)

foreach ($url in $testUrls) {
    try {
        $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 10 -ErrorAction SilentlyContinue
        if ($resp.Content -match "stack trace|exception|error|warning") {
            Write-Host "[!] Verbose error at: $url"
        }
    } catch { }
}

### Step 1.5: 信息泄漏检查 (Info Leak)

#### 泄漏文件与备份

```powershell
# 版本控制 / 配置 / 备份 / 源码映射文件
$leakPaths = @(
    # 版本控制
    "/.git/config", "/.svn/entries", "/.hg/store",
    # 配置与密钥
    "/.env", "/.env.local", "/.env.production", "/web.config", "/application.yml",
    "/WEB-INF/web.xml", "/config.yml", "/config.json",
    # 备份与临时文件
    "/backup.zip", "/backup.tar.gz", "/database.sql", "/db.sql", "/dump.sql",
    "/index.php.bak", "/index.php~", "/index.php.swp", "/.DS_Store",
    # 源码映射 / 调试
    "/app.js.map", "/static/js/app.js.map", "/trace.axd", "/elmah.axd",
    # 接口文档
    "/swagger-ui.html", "/v2/api-docs", "/v3/api-docs", "/graphql", "/graphiql"
)

foreach ($path in $leakPaths) {
    try {
        $resp = Invoke-WebRequest -Uri "$TARGET_URL$path" -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
        # 排除误报：部分站点对任意路径返回 200 的 soft-404
        if ($resp.Content.Length -gt 0 -and $resp.Content -notmatch "soft.?404|page not found|<title>404") {
            Write-Host "[!] 疑似泄漏: $path - Status: $($resp.StatusCode) - Size: $($resp.Content.Length)"
        }
    } catch { }
    Start-Sleep -Milliseconds 200  # 限速
}
```

#### 前端硬编码密钥

```powershell
# 检测 JS 中的 API Key / Secret / Token 模式
$secretPatterns = @{
    "API Key"    = 'api[_-]?key["'']?\s*[:=]\s*["''][A-Za-z0-9]{16,}'
    "Secret"     = 'secret["'']?\s*[:=]\s*["''][^"'']{8,}'
    "AWS AKID"   = 'AKIA[0-9A-Z]{16}'
    "私钥"       = '-----BEGIN (RSA |EC )?PRIVATE KEY-----'
    "Bearer硬编码" = 'Bearer\s+[A-Za-z0-9\-._~+/]{20,}'
}

$jsUrls = @("$TARGET_URL/app.js")  # 按 Step 1.2 识别结果补充真实 JS 路径
foreach ($jsUrl in $jsUrls) {
    try {
        $js = (Invoke-WebRequest -Uri $jsUrl -UseBasicParsing -TimeoutSec 15).Content
        foreach ($pat in $secretPatterns.GetEnumerator()) {
            if ($js -match $pat.Value) { Write-Host "[!] $jsUrl 疑似硬编码 $($pat.Key)" }
        }
    } catch { }
}

# Source Map 泄漏：JS 末尾含 sourceMappingURL 且 .map 文件可下载 → 可还原全部源码
```

#### PII 泄漏扫描

```powershell
# 响应体中出现明文 PII 模式（重点检查 API/导出/日志接口）
$piiPatterns = @{
    "手机号" = '1[3-9]\d{9}'
    "身份证" = '\d{17}[\dXx]'
    "邮箱"   = '[\w.+-]+@[\w-]+\.[\w.]{2,}'
    "银行卡" = '\b\d{16,19}\b'
}

foreach ($api in @("$TARGET_URL/api/user/info", "$TARGET_URL/api/export")) {
    try {
        $content = (Invoke-WebRequest -Uri $api -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop).Content
        foreach ($pat in $piiPatterns.GetEnumerator()) {
            if ($content -match $pat.Value) {
                Write-Host "[!] $api 疑似明文返回$($pat.Key)（需越权/未授权接口才算漏洞）"
            }
        }
    } catch { }
    Start-Sleep -Milliseconds 200
}
```

#### 判定要点

- `Server` / `X-Powered-By` / `X-AspNet-Version` 泄漏 → 信息类（低危），辅助版本匹配 CVE
- soft-404 干扰：站点对任意路径返回 200，需用内容差异排除误报
- PII 仅在**越权或未授权**接口上返回才算漏洞；认证后正常展示不算
```

## 输出格式

完成信息收集后，输出以下格式：

```
## 📋 信息收集结果

### 服务器信息
- **类型**: [Server Header]
- **技术栈**: [X-Powered-By / 检测到的框架]
- **操作系统**: [推测]

### 发现的路径
| 路径 | 状态 | 风险 |
|------|------|------|
| /.env | 200 | HIGH |
| /admin | 200 | MEDIUM |

### 技术指纹
- [框架1]
- [框架2]
- [JavaScript 库]

### 信息泄漏
| 类型 | 位置 | 泄漏内容 | 风险 |
|------|------|----------|------|
| 配置文件 | /.env | 数据库凭据 | HIGH |
| 前端硬编码 | /app.js | API Key | MEDIUM |
| 备份文件 | /backup.zip | 可下载 | HIGH |
| PII | /api/export | 明文手机号 | HIGH |
```
