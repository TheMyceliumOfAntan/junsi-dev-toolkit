# 服务生命周期管理模式

> **按需加载**：仅当验证任务需要启动后端服务（dotnet/npm/python/go）时才读取此文件。日常开发任务不需要。

## 适用场景
当验证任务需要启动后端服务时，使用本模式避免阻塞会话。

## 核心原则
1. **非阻塞启动**：使用后台进程启动服务，不占用当前会话
2. **健康检查等待**：轮询健康端点，确认服务就绪后再继续
3. **服务复用**：如果服务已在运行，直接复用，不重复启动
4. **验证完成后主动清理**：任务结束后关闭服务进程（除非用户明确要求保持）

## 标准操作流程

### 步骤 1：检测服务是否已在运行
```bash
# 检测指定端口是否被占用（以 5000 为例）
netstat -ano | findstr :5000
```
- 如果端口已被占用 → 询问用户"检测到服务已在运行，是否复用？" → 是则跳到步骤 4。
- 如果端口未被占用 → 进入步骤 2。

### 步骤 2：后台启动服务（非阻塞）
**通用模板**（按实际技术栈调整）：
```powershell
# PowerShell（推荐用于 Windows）
$env:ASPNETCORE_URLS="http://localhost:5000"
$process = Start-Process -FilePath "dotnet" -ArgumentList "run" -WorkingDirectory "src-backend" -PassThru -WindowStyle Hidden
$global:BackendProcessId = $process.Id
```

**注意事项**：
- 使用 `-WindowStyle Hidden` 避免弹窗。
- 将进程 ID 保存到 `$global:BackendProcessId` 或环境变量中，供后续清理。
- 记录启动时间，用于后续超时判断。

### 步骤 3：等待服务就绪（轮询健康检查）
**健康检查轮询模板**：
```powershell
$maxRetries = 30
$retryInterval = 2  # 秒
$ready = $false

for ($i = 1; $i -le $maxRetries; $i++) {
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:5000/api/health" -TimeoutSec 2 -ErrorAction Stop
        Write-Host "服务已就绪 (尝试 $i / $maxRetries): $($response.status)"
        $ready = $true
        break
    } catch {
        Write-Host "等待服务启动... (尝试 $i / $maxRetries)"
        Start-Sleep -Seconds $retryInterval
    }
}

if (-not $ready) {
    Write-Error "服务启动超时（$($maxRetries * $retryInterval) 秒）"
    Stop-Process -Id $global:BackendProcessId -Force
    exit 1
}
```

**要点**：
- 健康检查端点可能不同（`/health`、`/api/health`、`/ping`），需根据项目配置调整。
- 超时时间建议 60 秒（30 次 × 2 秒），可根据项目启动速度调整。
- 超时后必须清理进程，避免资源泄露。

### 步骤 4：执行验证任务
- 服务就绪后，执行验证脚本（如快照比对、接口测试）。
- 所有验证请求必须包含 `TimeoutSec` 参数，避免卡死。

### 步骤 5：清理服务进程（任务完成后）
```powershell
# 方案 A：按进程 ID 关闭（推荐）
Stop-Process -Id $global:BackendProcessId -Force

# 方案 B：按端口关闭
$pid = netstat -ano | findstr :5000 | Select-String "LISTENING" | ForEach-Object { $_ -replace '.*\s+(\d+)$', '$1' }
if ($pid) { Stop-Process -Id $pid -Force }
```

**清理时机**：
- 验证脚本执行完毕后**立即清理**（默认行为）。
- 若用户要求"保持服务运行供后续测试"，则不清理，并在完成报告中提示服务 PID。

## 各技术栈的启动命令参考

| 技术栈 | 启动命令 | 健康检查端点 |
|:---|:---|:---|
| .NET (dotnet run) | `dotnet run --urls="http://localhost:5000"` | `/api/health` 或 `/health` |
| Node.js (npm) | `npm start` | `/health` 或 `/api/health` |
| Python (Flask/FastAPI) | `python app.py` | `/health` 或 `/ping` |
| Go (gin/echo) | `go run main.go` | `/health` 或 `/ping` |
| Spring Boot (mvn) | `mvn spring-boot:run` | `/actuator/health` |

## 完整示例（PowerShell 脚本模板）
```powershell
# === 配置区 ===
$ProjectRoot = "src-backend\MyProject.Backend"
$StartCommand = "dotnet"
$StartArgs = "run --urls='http://localhost:5000'"
$HealthCheckUrl = "http://localhost:5000/api/health"
$StartupTimeoutSeconds = 60
$VerificationCommand = "curl -s http://localhost:5000/api/test | ConvertFrom-Json"

# === 执行 ===
Write-Host "1. 启动服务（后台）..."
$env:ASPNETCORE_URLS = "http://localhost:5000"
$process = Start-Process -FilePath $StartCommand -ArgumentList $StartArgs -WorkingDirectory $ProjectRoot -PassThru -WindowStyle Hidden
$global:ServicePid = $process.Id

Write-Host "2. 等待服务就绪..."
$maxRetries = [math]::Ceiling($StartupTimeoutSeconds / 2)
for ($i = 1; $i -le $maxRetries; $i++) {
    try {
        Invoke-RestMethod -Uri $HealthCheckUrl -TimeoutSec 2 -ErrorAction Stop | Out-Null
        Write-Host "✅ 服务已就绪"
        break
    } catch {
        if ($i -eq $maxRetries) {
            Write-Error "❌ 服务启动超时"
            Stop-Process -Id $global:ServicePid -Force
            exit 1
        }
        Write-Host "⏳ 等待中 ($i / $maxRetries)..."
        Start-Sleep -Seconds 2
    }
}

Write-Host "3. 执行验证..."
Invoke-Expression $VerificationCommand

Write-Host "4. 清理服务..."
Stop-Process -Id $global:ServicePid -Force
Write-Host "✅ 完成"
```

## 跨平台兼容（macOS / Linux）

在非 Windows 环境，使用以下方式：

```bash
# 后台启动
cd src-backend
nohup dotnet run --urls="http://localhost:5000" > backend.log 2>&1 &
BACKEND_PID=$!

# 等待就绪
for i in {1..30}; do
    if curl -s http://localhost:5000/api/health > /dev/null 2>&1; then
        echo "✅ 服务已就绪"
        break
    fi
    echo "⏳ 等待中 ($i/30)..."
    sleep 2
done

# 验证
curl -s http://localhost:5000/api/test

# 清理
kill $BACKEND_PID
```

## 注意事项
1. **端口冲突检测**：启动前必须先检查端口是否被占用。
2. **环境变量继承**：确保启动命令继承了必要的环境变量（如数据库连接字符串）。
3. **日志输出**：服务启动过程中的错误日志应重定向到文件（如 `> backend.log 2>&1`），便于事后排查。
4. **跨平台兼容**：若在 macOS/Linux 环境，使用 `&` 后台运行 + `curl` 检测端口。
