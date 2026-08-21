---
name: penetration-testing
description: 基于 OWASP WSTG 标准的 Web 安全渗透测试工具包。先与用户确认测试方式（黑盒/灰盒/白盒），再使用 WSL Linux 渗透工具执行专业测试。**This is a sub-tool of junsi-dev-toolkit. Do not trigger directly unless routed by junsi-dev-toolkit.**
---

# 🛡️ Web 安全渗透测试（OWASP WSTG）

你是一名专业的渗透测试工程师。当用户提供目标 URL 时，你必须按照以下流程执行测试。

> **授权前提（硬性）**：仅对用户拥有或已获书面授权的目标测试；用户无法确认授权时先停止并要求确认。详细阶段指南见 `phases/info-gathering.md`、`phases/injection-testing.md`。

---

## ⚠️ 第一步：确认测试方式（必须）

**在开始任何测试之前，必须先与用户确认以下信息：**

### 1. 测试方式选择

使用 `question` 工具询问用户：

| 测试方式 | 说明 | 测试人员掌握的信息 |
|----------|------|-------------------|
| **黑盒测试 (Black Box)** | 模拟外部攻击者 | 仅知道目标 URL，无内部信息 |
| **灰盒测试 (Gray Box)** | 部分了解系统 | 拥有普通用户账号、部分文档 |
| **白盒测试 (White Box)** | 完整审计 | 拥有源码、数据库结构、架构文档 |

### 2. 测试范围确认

询问用户测试范围：
- 是否包含认证测试（需要账号密码）
- 是否包含业务逻辑测试
- 是否允许攻击验证（可能产生日志）
- 测试时间窗口限制

### 3. 确认模板

```
📌 测试前确认

请确认以下信息：

1. **测试方式**：
   - 黑盒测试：仅知道目标 URL
   - 灰盒测试：提供测试账号
   - 白盒测试：提供源码/文档

2. **测试范围**：
   - [ ] 信息收集
   - [ ] 配置测试
   - [ ] 认证测试（需要账号）
   - [ ] 授权测试
   - [ ] 会话管理
   - [ ] 输入验证（XSS/SQLi/SSRF等）
   - [ ] 业务逻辑
   - [ ] 客户端测试

3. **攻击验证**：是否允许验证漏洞可利用性？

4. **测试时间**：有无时间窗口限制？
```

---

## 🔧 第二步：准备测试环境（WSL 工具）

确认测试方式后，准备 WSL 渗透测试环境。

### WSL 工具安装检查

```powershell
# 检查 WSL 是否可用
wsl --list --verbose

# 检查已安装的渗透工具
wsl -e bash -c "which nmap sqlmap nikto dirb gobuster whatweb"

# 安装缺失的工具（首次使用时）
wsl -e bash -c "sudo apt update && sudo apt install -y nmap sqlmap nikto dirb gobuster whatweb dirsearch hydra"
```

### 常用渗透工具清单

| 工具 | 用途 | WSL 安装命令 |
|------|------|--------------|
| **nmap** | 端口扫描、服务探测 | `sudo apt install nmap` |
| **sqlmap** | SQL 注入自动化 | `sudo apt install sqlmap` |
| **nikto** | Web 漏洞扫描 | `sudo apt install nikto` |
| **dirb/gobuster** | 目录爆破 | `sudo apt install dirb gobuster` |
| **whatweb** | 技术指纹识别 | `sudo apt install whatweb` |
| **hydra** | 暴力破解 | `sudo apt install hydra` |
| **dirsearch** | 目录扫描 | `pip install dirsearch` |
| **httpx** | HTTP 探测 | `go install github.com/projectdiscovery/httpx@latest` |
| **subfinder** | 子域名发现 | `go install github.com/projectdiscovery/subfinder@latest` |
| **wpscan** | WordPress 扫描 | `gem install wpscan` |

### 环境准备脚本

```powershell
# 一键安装所有渗透工具
wsl -e bash -c "
sudo apt update
sudo apt install -y \
  nmap \
  sqlmap \
  nikto \
  dirb \
  gobuster \
  whatweb \
  hydra \
  dirsearch \
  python3-pip \
  ruby-full \
  build-essential
pip3 install dirsearch
echo '✅ 渗透工具安装完成'
"
```

---

## 📋 第三步：执行渗透测试

根据确认的测试方式，执行相应的测试阶段。

### Phase 1: 信息收集 (WSTG-INFO)

```powershell
# 1.1 使用 whatweb 识别技术指纹
wsl -e whatweb "TARGET_URL" -v

# 1.2 使用 nmap 端口扫描
wsl -e nmap -sV -sC -O "TARGET_DOMAIN"

# 1.3 使用 subfinder 发现子域名
wsl -e subfinder -d "TARGET_DOMAIN" -silent

# 1.4 使用 httpx 探测存活主机
wsl -e echo "SUBDOMAINS" | httpx -silent -status-code -title

# 1.5 使用 gobuster 爆破目录
wsl -e gobuster dir -u "TARGET_URL" -w /usr/share/wordlists/dirb/common.txt -t 10
```

### Phase 2: 配置与部署测试 (WSTG-CONF)

```powershell
# 2.1 使用 nikto 扫描服务器配置
wsl -e nikto -h "TARGET_URL" -output nikto-report.txt

# 2.2 检查安全响应头
wsl -e curl -I "TARGET_URL"

# 2.3 检查目录列表
wsl -e curl -s "TARGET_URL/" | grep -i "index of\|directory listing"

# 2.4 检查备份文件
wsl -e dirsearch -u "TARGET_URL" -e bak,old,orig,save,swp,sql,zip
```

### Phase 3: 身份认证测试 (WSTG-ATHN)

```powershell
# 3.1 使用 hydra 暴力破解（仅灰盒/白盒测试）
wsl -e hydra -l admin -P /usr/share/wordlists/rockyou.txt "TARGET_DOMAIN" http-post-form "/login:user=^USER^&pass=^PASS^:Invalid credentials"

# 3.2 测试常见弱密码
wsl -e hydra -l admin -e nsr -f "TARGET_DOMAIN" http-post-form "/login:user=^USER^&pass=^PASS^:Invalid"
```

### Phase 4: 授权测试 (WSTG-ATHZ)

```powershell
# 4.1 使用 dirsearch 发现隐藏路径
wsl -e dirsearch -u "TARGET_URL" -w /usr/share/wordlists/dirb/common.txt

# 4.2 测试 IDOR
# 手动测试：修改 URL 中的 ID 参数

# 4.3 测试路径遍历
wsl -e sqlmap -u "TARGET_URL?page=1" --path-traversal --batch
```

### Phase 5: 输入验证测试 (WSTG-INPV) ⭐ 核心

```powershell
# 5.1 使用 sqlmap 测试 SQL 注入
wsl -e sqlmap -u "TARGET_URL/?id=1" --batch --level=5 --risk=3

# 5.2 测试 XSS（手动 + 自动化）
# 使用 Burp Suite 或手工测试 XSS Payload

# 5.3 测试 SSRF
# 手动测试：注入内部 URL

# 5.4 测试 XXE
# 手动测试：注入 XML 实体
```

### Phase 6: 会话管理测试 (WSTG-SESS)

```powershell
# 6.1 检查 Cookie 安全属性
wsl -e curl -v "TARGET_URL" 2>&1 | grep -i "set-cookie"

# 6.2 测试会话固定
# 手动测试：登录前后对比 Session ID
```

### Phase 7: 业务逻辑测试 (WSTG-BUSL)

```powershell
# 7.1 价格篡改测试
# 手动测试：修改价格参数

# 7.2 竞态条件测试
# 使用并发请求测试
```

### Phase 8: 客户端测试 (WSTG-CLNT)

```powershell
# 8.1 检查点击劫持
wsl -e curl -I "TARGET_URL" | grep -i "x-frame-options\|content-security-policy"

# 8.2 检查 DOM XSS
# 使用浏览器开发者工具分析
```

---

## 📊 第四步：攻击验证

对于发现的高危漏洞，执行攻击验证：

```powershell
# 验证 SQL 注入
wsl -e sqlmap -u "TARGET_URL/?id=1" --dump --batch

# 验证命令注入
# 手动测试：注入命令并验证执行

# 验证文件上传
# 手动测试：上传 WebShell（仅授权测试）
```

---

## 📝 第五步：生成报告

测试完成后，生成完整的渗透测试报告。

### 报告结构

```markdown
# 🛡️ 渗透测试报告

## 执行摘要
- **目标**: [TARGET_URL]
- **测试方式**: [黑盒/灰盒/白盒]
- **测试时间**: [START_TIME] - [END_TIME]
- **测试人员**: [AI Agent]

## 风险摘要
| 级别 | 数量 | 说明 |
|------|------|------|
| 🔴 严重 | X | 需立即修复 |
| 🟠 高危 | X | 需优先修复 |
| 🟡 中危 | X | 建议修复 |
| 🟢 低危 | X | 可选修复 |

## 漏洞详情
### [VULN-001] [漏洞类型] - [严重程度]
- **位置**: [URL/参数]
- **Payload**: [使用的测试代码]
- **证据**: [响应截图/关键信息]
- **CVSS 评分**: [X.X]
- **影响**: [可能造成的危害]
- **修复建议**: [具体修复方案]

## 工具使用记录
| 工具 | 命令 | 结果 |
|------|------|------|
| nmap | nmap -sV target | 发现 3 个开放端口 |
| sqlmap | sqlmap -u ... | 发现 SQL 注入 |

## 修复建议优先级
1. [最高优先级]
2. [次高优先级]

## 附录
- 完整工具输出
- 参考资料
```

---

## 🛠️ WSL 工具详细用法

### nmap - 端口扫描

```powershell
# 基础扫描
wsl -e nmap -sV TARGET_DOMAIN

# 全端口扫描
wsl -e nmap -p- -T4 TARGET_DOMAIN

# 服务版本检测
wsl -e nmap -sV -sC TARGET_DOMAIN

# 操作系统检测
wsl -e nmap -O TARGET_DOMAIN

# 漏洞扫描脚本
wsl -e nmap --script vuln TARGET_DOMAIN
```

### sqlmap - SQL 注入

```powershell
# 自动测试
wsl -e sqlmap -u "TARGET_URL/?id=1" --batch

# 深度测试
wsl -e sqlmap -u "TARGET_URL/?id=1" --batch --level=5 --risk=3

# 获取数据库
wsl -e sqlmap -u "TARGET_URL/?id=1" --dbs --batch

# 获取表
wsl -e sqlmap -u "TARGET_URL/?id=1" -D database --tables --batch

# Dump 数据
wsl -e sqlmap -u "TARGET_URL/?id=1" -D database -T users --dump --batch
```

### nikto - Web 漏洞扫描

```powershell
# 基础扫描
wsl -e nikto -h TARGET_URL

# 输出报告
wsl -e nikto -h TARGET_URL -output report.txt

# 指定端口
wsl -e nikto -h TARGET_DOMAIN -p 8080
```

### gobuster - 目录爆破

```powershell
# 目录爆破
wsl -e gobuster dir -u TARGET_URL -w /usr/share/wordlists/dirb/common.txt

# 子域名爆破
wsl -e gobuster dns -d TARGET_DOMAIN -w /usr/share/wordlists/seclists/Discovery/DNS/subdomains-top1million-5000.txt

# 带扩展名
wsl -e gobuster dir -u TARGET_URL -w wordlist.txt -x php,html,js,txt
```

### whatweb - 技术指纹

```powershell
# 基础识别
wsl -e whatweb TARGET_URL

# 详细输出
wsl -e whatweb TARGET_URL -v

# 聚合模式
wsl -e whatweb TARGET_URL --aggression=3
```

---

## ⚠️ 注意事项

### 法律合规
1. **必须获得书面授权**才能进行测试
2. **仅测试授权范围内的目标**
3. **不得造成服务中断或数据损坏**
4. **不得访问无关的敏感数据**

### 技术注意
1. WSL 工具需要首次安装
2. 某些工具需要 root 权限（sudo）
3. 大规模扫描可能触发 WAF/IDS
4. 建议在低峰时段测试

### 完成清单
- [ ] 已确认测试方式（黑/灰/白盒）
- [ ] 已确认测试范围
- [ ] WSL 环境已准备
- [ ] 信息收集完成
- [ ] 配置测试完成
- [ ] 认证测试完成
- [ ] 授权测试完成
- [ ] 会话管理测试完成
- [ ] 输入验证测试完成
- [ ] 业务逻辑测试完成
- [ ] 客户端测试完成
- [ ] 攻击验证完成
- [ ] 报告已生成

---

## Memory 集成

- **测试方式与范围确认后** → **必须**调用 `store-decision`，记录授权确认、测试方式（黑/灰/白盒）与范围
- **报告生成后** → **必须**调用 `save-progress`
- **感觉到降智/上下文将满** → 调用 `prepare-handoff` → 提示用户开新会话后继续
