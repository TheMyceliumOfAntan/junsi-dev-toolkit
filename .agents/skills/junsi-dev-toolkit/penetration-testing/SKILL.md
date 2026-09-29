---
name: penetration-testing
description: 基于 OWASP WSTG 标准的 Web 安全渗透测试工具包。先与用户确认测试方式（黑盒/灰盒/白盒），再使用 WSL Linux 渗透工具执行专业测试。**This is a sub-tool of junsi-dev-toolkit. Do not trigger directly unless routed by junsi-dev-toolkit.**
---

# 🛡️ Web 安全渗透测试（OWASP WSTG）

你是一名专业的渗透测试工程师。当用户提供目标 URL 时，你必须按照以下流程执行测试。

> **授权前提（硬性）**：仅对用户拥有或已获书面授权的目标测试；用户无法确认授权时先停止并要求确认。各阶段详细指南（检查点/Payload 库/脚本/判定/修复建议）见：
> - `phases/info-gathering.md` — Phase 1 信息收集 + 信息泄漏 (WSTG-INFO)
> - `phases/authentication.md` — Phase 3 身份认证 (WSTG-ATHN)
> - `phases/authorization.md` — Phase 4 授权 (WSTG-ATHZ)
> - `phases/session-client-side.md` — Phase 5 会话与客户端 (WSTG-SESS / WSTG-CLNT)
> - `phases/injection-testing.md` — Phase 6 输入验证 (WSTG-INPV)
> - `phases/business-logic.md` — Phase 7 业务逻辑 (WSTG-BUSL)
> - `phases/advanced-attacks.md` — Phase 8 高级攻击与绕过 (WSTG-INPV/ATHZ 扩展)

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

确认测试方式后，准备渗透测试环境。执行后端自动适配：**Windows 经 WSL；Linux 等已带 bash 的系统直接本机执行（功能一致）**——下文 `wsl -e bash -c "..."` 在 Linux/macOS 上等价于直接在终端运行引号内命令。

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
| **curl** | HTTP 请求主力（认证/授权/会话测试） | MCP `wsl-curl` 或 `wsl -e curl` |
| **hydra** | 暴力破解（认证测试） | MCP `wsl-hydra` |
| **dirsearch** | 目录/敏感文件扫描 | MCP `wsl-dirsearch` |
| **httpx** | HTTP 探测/指纹 | MCP `wsl-httpx` |

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

### WSL 不可用时的回退

工具报错 `WSL_NOT_AVAILABLE` 或 wsl 命令不存在时：先向用户**警告并确认是否继续**；继续则回退 pwsh 同类工具（端口扫描 `Test-NetConnection`、HTTP 指纹/安全头 `Invoke-WebRequest`、目录探测小字典限速循环），并在报告中标注"pwsh 回退执行"；sqlmap/nikto/hydra 无 pwsh 安全等价，标注"需 WSL"跳过，不得盲测。用户拒绝 → 建议安装 WSL 后再测。

---

## 🚫 安全边界（全阶段生效）

1. **授权声明**：每个阶段开始前确认目标在授权范围内；越界目标立即停止
2. **限速**：所有循环测试加延时（≥200ms）；暴力破解单账号 ≤10 次/分钟，遍历 ≤20 id/分钟
3. **禁破坏性 payload**：不用超长 `sleep`/大文件读取/无限循环类 DoS payload；时间盲注 ≤5s
4. **验证级原则**：证明可利用即停止；不批量拉取数据、不写入他人数据、不攻击其他用户会话（走私/竞态需先申请窗口）
5. **请求卫生**：随机 UA、统一超时（≤30s）、记录全部请求响应备查
6. **测试账号**：只用专用测试账号与测试数据，禁止共享生产账号

---

## 📋 第三步：执行渗透测试

根据确认的测试方式，按以下阶段执行。每个阶段的详细检查点、Payload 库与脚本见对应 phase 文件；下列命令为快速入口。

| 阶段 | WSTG | 详细指南 |
|------|------|----------|
| Phase 1 信息收集 | INFO | `phases/info-gathering.md` |
| Phase 2 配置与部署 | CONF | 本文（nikto/安全头） |
| Phase 3 身份认证 | ATHN | `phases/authentication.md` |
| Phase 4 授权 | ATHZ | `phases/authorization.md` |
| Phase 5 会话与客户端 | SESS / CLNT | `phases/session-client-side.md` |
| Phase 6 输入验证 ⭐ | INPV | `phases/injection-testing.md` |
| Phase 7 业务逻辑 | BUSL | `phases/business-logic.md` |
| Phase 8 高级攻击与绕过 | INPV/ATHZ 扩展 | `phases/advanced-attacks.md` |
| Phase 9 错误处理与密码学速查 | ERRH / CRYPST | 本文末尾速查 |

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

灰盒提供账号，按 `phases/authentication.md` 执行（弱口令/JWT/OAuth/MFA）。快速入口：

```powershell
# 弱口令：确认无锁定机制后，-f 命中即停，线程限 4（遵守安全边界限速）
wsl -e hydra -l admin -P /usr/share/wordlists/rockyou.txt -t 4 -f "TARGET_DOMAIN" http-post-form "/login:username=^USER^&password=^PASS^:登录失败"
```

### Phase 4: 授权测试 (WSTG-ATHZ)

按 `phases/authorization.md` 执行（IDOR/方法绕过/CSRF/权限矩阵）。快速入口（用 wsl-curl 复现双账号会话请求）：

```powershell
# IDOR：A 的资源用 B 的会话访问
wsl -e curl -sS -i -H "Cookie: session=ATTACKER" "$TARGET_URL/api/orders/1002"

# 隐藏路径
wsl -e dirsearch -u "TARGET_URL" -w /usr/share/wordlists/dirb/common.txt
```

### Phase 5: 会话管理与客户端测试 (WSTG-SESS / WSTG-CLNT)

按 `phases/session-client-side.md` 执行（Cookie 属性/CORS/postMessage/WebSocket/点击劫持/DOM XSS）。

### Phase 6: 输入验证测试 (WSTG-INPV) ⭐ 核心

按 `phases/injection-testing.md` 执行（XSS 三型/SQLi 含盲注/命令注入/盲 SSRF/OOB XXE）。快速入口：

```powershell
# 使用 sqlmap 测试 SQL 注入
wsl -e sqlmap -u "TARGET_URL/?id=1" --batch --level=5 --risk=3
```

### Phase 7: 业务逻辑测试 (WSTG-BUSL)

按 `phases/business-logic.md` 执行。业务逻辑无通用 payload：先完整走一遍正常流程并记录请求，再做数值篡改/流程跳过/竞态/回调伪造验证。

### Phase 8: 高级攻击与绕过 (WSTG-INPV / WSTG-ATHZ 扩展)

按 `phases/advanced-attacks.md` 执行（路径穿越/编码绕过/HPP/原型链污染/反序列化/请求走私）。本阶段只做验证级测试，禁破坏性操作。

### Phase 9: 错误处理与密码学速查 (WSTG-ERRH / WSTG-CRYPST)

无专门阶段文件，随 Phase 1/2 一并核查：

```powershell
# 错误页泄漏堆栈/版本（info-gathering.md Step 1.4/1.5 已覆盖）
# TLS 版本与套件
wsl -e nmap --script ssl-enum-ciphers -p 443 "TARGET_DOMAIN"

# 敏感数据明文传输/存储（需灰白盒配合，黑盒只观察 HTTPS 覆盖）
```

---

## 📊 第四步：攻击验证

对于发现的高危漏洞，执行攻击验证（**验证级原则：证明可利用即停止**——不批量 dump、不写入他人数据；走私/竞态类需先申请窗口）：

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

测试完成后，生成完整的渗透测试报告：将 Markdown 报告写入 `docs/penetration-reports/YYYY-MM-DD-<目标slug>.md`（项目根目录相对路径，日期取测试当日），并在回复中给出报告路径与风险摘要。

所有阶段发现的漏洞统一按以下格式汇总（各 phase 文件结尾同格式，直接填入）：

```markdown
| 漏洞类型 | 位置 | 参数 | Payload | 证据 | 风险 | 修复建议 |
```

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

## 漏洞汇总
| 漏洞类型 | 位置 | 参数 | Payload | 证据 | 风险 | 修复建议 |
|----------|------|------|---------|------|------|----------|

## 漏洞详情
### [VULN-001] [漏洞类型] - [严重程度]
- **位置**: [URL/参数]
- **Payload**: [使用的测试代码]
- **证据**: [响应截图/关键信息]
- **CVSS 评分**: [X.X]
- **影响**: [可能造成的危害]
- **建议解决方案**: [具体可执行的修复措施：配置修改步骤/代码级修复方向/需升级的依赖及目标版本，不许只写"建议加固"]

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
- [ ] 安全边界已知晓（限速/验证级/禁破坏性 payload）
- [ ] 信息收集完成（含信息泄漏检查）
- [ ] 配置测试完成
- [ ] 认证测试完成
- [ ] 授权测试完成
- [ ] 会话管理与客户端测试完成
- [ ] 输入验证测试完成
- [ ] 业务逻辑测试完成
- [ ] 高级攻击与绕过测试完成（验证级）
- [ ] 错误处理/密码学速查完成
- [ ] 攻击验证完成
- [ ] 报告已生成

---

## Memory 集成

- **测试方式与范围确认后** → **必须**调用 `store-decision`，记录授权确认、测试方式（黑/灰/白盒）与范围
- **报告生成后** → **必须**调用 `save-progress`
- **感觉到降智/上下文将满** → 调用 `prepare-handoff` → 提示用户开新会话后继续
