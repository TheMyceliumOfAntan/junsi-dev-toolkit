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
        $resp = Invoke-WebRequest -Uri "$TARGET_URL$path" -UseBasicParsing -ErrorAction Stop
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
        $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -ErrorAction SilentlyContinue
        if ($resp.Content -match "stack trace|exception|error|warning") {
            Write-Host "[!] Verbose error at: $url"
        }
    } catch { }
}
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
```
