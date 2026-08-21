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

.EXAMPLE
pwsh scripts/goal-loop.ps1 -MaxLoops 20
#>
param(
  [int]$MaxLoops = 20,
  [string]$Agent = 'goal',
  [string]$Prompt = '继续迭代：先调用 goal-check(advance:true)，严格按状态卡指令完成本轮。',
  [int]$IntervalSeconds = 2
)

$ErrorActionPreference = 'Continue'
Write-Host "== Goal 外部硬循环启动：agent=$Agent, maxLoops=$MaxLoops ==" -ForegroundColor Cyan

for ($i = 1; $i -le $MaxLoops; $i++) {
  Write-Host "`n== [loop $i/$MaxLoops] opencode run --agent $Agent ==" -ForegroundColor Cyan
  $out = & opencode run --agent $Agent $Prompt 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-Host "opencode run 退出码 $LASTEXITCODE，重试一次后仍失败则终止" -ForegroundColor Yellow
    $out = & opencode run --agent $Agent $Prompt 2>&1
    if ($LASTEXITCODE -ne 0) { Write-Host '== 连续失败，终止循环 ==' -ForegroundColor Red; exit 1 }
  }
  $text = ($out | Out-String)
  ($text -split "`n" | Where-Object { $_.Trim() } | Select-Object -Last 5) | ForEach-Object { Write-Host "  $_" }

  if ($text -match 'GOAL_ACHIEVED') {
    Write-Host "`n== GOAL_ACHIEVED：目标达成，循环结束 ==" -ForegroundColor Green
    break
  }
  if ($text -match 'GOAL_STOP|已达轮次上限|question') {
    Write-Host "`n== 循环停止：检测到中止哨兵/待人工决定（上限、确认请求）==" -ForegroundColor Yellow
    break
  }
  Start-Sleep -Seconds $IntervalSeconds
}
