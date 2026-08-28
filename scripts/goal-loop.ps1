#!/usr/bin/env pwsh
<#
.SYNOPSIS
Goal 外部硬循环驱动器：反复调用 opencode run 推进活动 Goal，直到哨兵标记（GOAL_ACHIEVED/GOAL_STOP）或达到外层轮数上限。

.DESCRIPTION
配合 junsi-dev-toolkit 的 goal agent 使用。每轮以独立进程运行
`opencode run --agent <Agent> "<Prompt>"`，上下文冷启动由 .memory/goals/active.md 状态文件承接；
agent 回复中出现哨兵标记时自动停止。

.PARAMETER MaxLoops
外层最大循环次数（防失控兜底），默认 20。

.PARAMETER Agent
执行迭代的 agent 名，默认 goal。

.PARAMETER Prompt
每轮发给 agent 的推进指令。

.PARAMETER TimeoutSeconds
单轮执行超时（秒），超时判定进程卡死并终止循环，默认 900（15 分钟）。

.PARAMETER MaxStallRounds
连续 N 轮无实质进展（勾选标准数/checkpoint 提交数均无变化）即判定空转并终止，默认 2。

.EXAMPLE
pwsh scripts/goal-loop.ps1 -MaxLoops 20
#>
param(
  [int]$MaxLoops = 20,
  [string]$Agent = 'goal',
  [string]$Prompt = '继续迭代：先调用 goal-check(advance:true)，严格按状态卡指令完成本轮。',
  [int]$IntervalSeconds = 2,
  [int]$TimeoutSeconds = 900,
  [int]$MaxStallRounds = 2
)

$ErrorActionPreference = 'Continue'
$projectRoot = Split-Path $PSScriptRoot -Parent
$activeFile = Join-Path $projectRoot '.memory\goals\active.md'
Write-Host "== Goal 外部硬循环启动：agent=$Agent, maxLoops=$MaxLoops, timeout=${TimeoutSeconds}s, 无进展熔断=$MaxStallRounds 轮 ==" -ForegroundColor Cyan

function Get-Progress {
  $checks = 0
  if (Test-Path -LiteralPath $activeFile) {
    $checks = @(Select-String -LiteralPath $activeFile -Pattern '^\s*- \[x\] ' -AllMatches).Count
  }
  $log = & git -C $projectRoot log --oneline --fixed-strings --grep='checkpoint(goal)' 2>$null
  return @{ Checks = $checks; Checkpoints = @($log).Count }
}

function Invoke-Round {
  param([string]$AgentName, [string]$PromptText, [int]$TimeoutSec)
  $job = Start-Job -ScriptBlock {
    param($a, $p)
    & opencode run --agent $a $p 2>&1
    exit $LASTEXITCODE
  } -ArgumentList $AgentName, $PromptText
  if (-not (Wait-Job $job -Timeout $TimeoutSec)) {
    Stop-Job $job -Force | Out-Null
    Remove-Job $job -Force
    return @{ Out = ''; Code = -999 }
  }
  $out = (Receive-Job $job | Out-String)
  $code = if ($job.State -eq 'Completed') { $job.ChildJobs[0].ExitCode } else { 1 }
  Remove-Job $job -Force
  return @{ Out = $out; Code = $code }
}

$prev = Get-Progress
$stall = 0

for ($i = 1; $i -le $MaxLoops; $i++) {
  Write-Host "`n== [loop $i/$MaxLoops] opencode run --agent $Agent ==" -ForegroundColor Cyan
  $r = Invoke-Round -AgentName $Agent -PromptText $Prompt -TimeoutSec $TimeoutSeconds
  if ($r.Code -eq -999) {
    Write-Host "== 本轮执行超时（${TimeoutSeconds}s），判定进程卡死，终止循环（请检查是否误启动长驻服务/命令） ==" -ForegroundColor Red
    exit 2
  }
  if ($r.Code -ne 0) {
    Write-Host "opencode run 退出码 $($r.Code)，重试一次后仍失败则终止" -ForegroundColor Yellow
    $r = Invoke-Round -AgentName $Agent -PromptText $Prompt -TimeoutSec $TimeoutSeconds
    if ($r.Code -eq -999) {
      Write-Host '== 重试超时，终止循环 ==' -ForegroundColor Red
      exit 2
    }
    if ($r.Code -ne 0) { Write-Host '== 连续失败，终止循环 ==' -ForegroundColor Red; exit 1 }
  }
  $text = $r.Out
  ($text -split "`n" | Where-Object { $_.Trim() } | Select-Object -Last 5) | ForEach-Object { Write-Host "  $_" }

  $cur = Get-Progress
  if ($cur.Checks -eq $prev.Checks -and $cur.Checkpoints -eq $prev.Checkpoints) { $stall++ } else { $stall = 0 }
  Write-Host "  进展：标准达成 $($cur.Checks) 条 / checkpoint 提交 $($cur.Checkpoints) 次$(if ($stall) { "（无实质进展 x$stall）" })" -ForegroundColor DarkGray
  $prev = $cur

  if ($text -match 'GOAL_ACHIEVED') {
    Write-Host "`n== GOAL_ACHIEVED：目标达成，循环结束 ==" -ForegroundColor Green
    break
  }
  if ($text -match 'GOAL_STOP|已达轮次上限|question') {
    Write-Host "`n== 循环停止：检测到中止哨兵/待人工决定（上限、确认请求）==" -ForegroundColor Yellow
    break
  }
  if ($stall -ge $MaxStallRounds) {
    Write-Host "`n== 连续 $MaxStallRounds 轮无实质进展（勾选标准数/checkpoint 提交均未变化），判定空转，终止循环 ==" -ForegroundColor Yellow
    break
  }
  Start-Sleep -Seconds $IntervalSeconds
}
