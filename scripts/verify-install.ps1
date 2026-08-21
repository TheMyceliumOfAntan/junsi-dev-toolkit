#!/usr/bin/env pwsh
<#
.SYNOPSIS
junsi-dev-toolkit 安装/升级通用检验工具。

.DESCRIPTION
自动定位已安装的工具包，检查：
  1. 包目录与关键文件完整性
  2. 插件 JS 语法（node --check）
  3. 版本标记（SKILL.md v3 / 7 个 memory 工具）
  4. 全部工具名是否在插件源码中注册（7 memory + 3 cluster + 2 utility）
  5. 与源码仓库 HEAD 的 hash 一致性（-RepoPath 提供时）
  6. -Full：真实加载插件，断言 12 个工具全部注册 + memory-doctor 冒烟执行

.PARAMETER PackagePath
已安装包目录（node_modules/junsi-dev-toolkit）。留空自动查找常见安装位置。

.PARAMETER RepoPath
源码仓库路径（可选）。提供时对比插件 hash 与 HEAD。

.PARAMETER Full
深度模式：临时安装 @opencode-ai/plugin 后真实加载插件验证工具注册。

.EXAMPLE
.\verify-install.ps1
.\verify-install.ps1 -RepoPath C:\dev\junsi-dev-toolkit
.\verify-install.ps1 -Full -RepoPath C:\dev\junsi-dev-toolkit
#>
param(
  [string]$PackagePath = '',
  [string]$RepoPath = '',
  [switch]$Full
)

$ErrorActionPreference = 'Stop'
$fail = 0
try { [Console]::OutputEncoding = [Text.UTF8Encoding]::new() } catch {}
$scriptDir = if ($PSScriptRoot) { $PSScriptRoot } elseif ($MyInvocation.MyCommand.Path) { Split-Path $MyInvocation.MyCommand.Path } else { (Get-Location).Path }

function Find-RealPkg([string]$base) {
  $direct = Join-Path $base 'node_modules\junsi-dev-toolkit'
  if (Test-Path $direct) { return $direct }
  return (Get-ChildItem $base -Recurse -Depth 6 -Directory -Filter 'junsi-dev-toolkit' -ErrorAction SilentlyContinue |
    Where-Object { Test-Path (Join-Path $_.FullName '.opencode\plugins\junsi-dev-toolkit.js') } |
    Select-Object -First 1 -ExpandProperty FullName)
}

function Check([bool]$Cond, [string]$Msg) {
  if ($Cond) { Write-Host "  [PASS] $Msg" -ForegroundColor Green }
  else { Write-Host "  [FAIL] $Msg" -ForegroundColor Red; $script:fail++ }
}

Write-Host "== junsi-dev-toolkit 安装检验 ==" -ForegroundColor Cyan

# ---------- 1. 定位包目录 ----------
if (-not $PackagePath) {
  $candidates = @(
    (Get-ChildItem "$env:USERPROFILE\.cache\opencode\packages" -Directory -Filter 'junsi-dev-toolkit*' -ErrorAction SilentlyContinue |
      ForEach-Object { Find-RealPkg $_.FullName } |
      Where-Object { $_ } | Select-Object -First 1),
    (Find-RealPkg "$env:USERPROFILE\AppData\Roaming\npm\node_modules\junsi-dev-toolkit"),
    (Join-Path $scriptDir '..')
  ) | Where-Object { $_ -and (Test-Path $_) }
  if (-not $candidates) {
    Write-Host "  [FAIL] 未找到已安装包，请用 -PackagePath 指定。" -ForegroundColor Red
    exit 1
  }
  $PackagePath = @($candidates)[0]
}
$pkg = (Resolve-Path $PackagePath).Path
Write-Host "  [INFO] 包目录: $pkg"
Check (Test-Path $pkg) '包目录存在'
if (-not (Test-Path $pkg)) { exit 1 }

# ---------- 2. 关键文件完整性 ----------
$plugin = Join-Path $pkg '.opencode/plugins/junsi-dev-toolkit.js'
$skillRoot = Join-Path $pkg '.agents/skills/junsi-dev-toolkit'
$required = @(
  $plugin,
  (Join-Path $skillRoot 'SKILL.md'),
  (Join-Path $skillRoot 'memory-skill/SKILL.md'),
  (Join-Path $skillRoot 'memory-skill/templates/INDEX.md'),
  (Join-Path $skillRoot 'memory-skill/templates/HANDOFF.md'),
  (Join-Path $skillRoot 'requirements-driven-dev/SKILL.md'),
  (Join-Path $skillRoot 'cluster/SKILL.md'),
  (Join-Path $skillRoot 'advisor/SKILL.md'),
  (Join-Path $skillRoot 'computer-use/SKILL.md'),
  (Join-Path $skillRoot 'penetration-testing/SKILL.md')
)
foreach ($f in $required) { Check (Test-Path $f) "文件存在: $([IO.Path]::GetFileName($f))" }

# ---------- 3. 插件语法 ----------
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Check $false 'node 可用（需要 node 执行语法与深度校验）'
} else {
  Check $true "node 可用: $($node.Source)"
  $out = & node --check $plugin 2>&1
  Check ($LASTEXITCODE -eq 0) "插件语法: node --check"
  if ($LASTEXITCODE -ne 0) { Write-Host $out -ForegroundColor Yellow }
}

# ---------- 4. 版本标记 ----------
$skillMem = Get-Content (Join-Path $skillRoot 'memory-skill/SKILL.md') -Raw
Check ($skillMem -match 'v3') 'memory-skill 版本标记 v3'
Check ($skillMem -match 'list-decisions') 'SKILL.md 含 list-decisions 工具说明'
Check ($skillMem -match 'memory-doctor') 'SKILL.md 含 memory-doctor 工具说明'

# ---------- 5. 工具名齐全 ----------
$pluginSrc = Get-Content $plugin -Raw
$tools = @(
  'store-decision', 'save-progress', 'prepare-handoff', 'restore-handoff',
  'list-decisions', 'memory-doctor', 'save-preference',
  'cluster-task-prompt', 'cluster-scan-models', 'cluster-allocation',
  'tool-search', 'cron-create'
)
foreach ($t in $tools) {
  Check ($pluginSrc -match ("tools\['" + [Regex]::Escape($t) + "'\]")) "工具注册: $t"
}

# ---------- 6. 与源码仓库 HEAD 一致性 ----------
if ($RepoPath) {
  $repo = (Resolve-Path $RepoPath).Path
  if (Test-Path (Join-Path $repo '.git')) {
    $head = (git -C $repo rev-parse HEAD 2>&1).Trim()
    $wantHash = (git -C $repo hash-object (Join-Path $repo '.opencode/plugins/junsi-dev-toolkit.js') 2>&1).Trim()
    $hasHash = (git hash-object $plugin 2>&1).Trim()
    Check ($head -match '^[0-9a-f]{40}$') "仓库 HEAD 可读: $head"
    Check ($hasHash -eq $wantHash) "插件与仓库 HEAD 一致 (hash $hasHash)"
  } else {
    Write-Host "  [WARN] $repo 不是 git 仓库，跳过 hash 对比" -ForegroundColor Yellow
  }
}

# ---------- 7. Full：真实加载插件 ----------
if ($Full) {
  Write-Host "  [INFO] 深度模式：真实加载插件验证工具注册..." -ForegroundColor Cyan
  $temp = Join-Path $env:TEMP "jdt-verify-$PID"
  New-Item -ItemType Directory -Path $temp -Force | Out-Null
  $proj = Join-Path $temp 'proj'
  New-Item -ItemType Directory -Path $proj -Force | Out-Null
  try {
    Push-Location $temp
    npm init -y 2>&1 | Out-Null
    npm install @opencode-ai/plugin --no-fund --no-audit 2>&1 | Out-Null
    Pop-Location
    $pkgModules = Join-Path $pkg 'node_modules'
    New-Item -ItemType Directory -Path $pkgModules -Force -ErrorAction SilentlyContinue | Out-Null
    $junction = Join-Path $pkgModules '@opencode-ai'
    if (Test-Path $junction) { Remove-Item $junction -Recurse -Force }
    New-Item -ItemType Junction -Path $junction -Target (Join-Path $temp 'node_modules/@opencode-ai') | Out-Null
    $verify = Join-Path $scriptDir 'verify-registration.mjs'
    if (Test-Path $verify) {
      $out = & node $verify $pkg $proj 2>&1
      Write-Host $out
      Check ($LASTEXITCODE -eq 0) '深度注册验证（12 工具 + memory-doctor 冒烟）'
    } else {
      Check $false "缺少 $verify"
    }
  } finally {
    Pop-Location -ErrorAction SilentlyContinue
    $junction = Join-Path (Join-Path $pkg 'node_modules') '@opencode-ai'
    if (Test-Path $junction) { Remove-Item $junction -Recurse -Force }
    if (Test-Path (Join-Path $pkg 'node_modules')) {
      $rest = Get-ChildItem (Join-Path $pkg 'node_modules') -Force
      if (-not $rest) { Remove-Item (Join-Path $pkg 'node_modules') -Force }
    }
    Remove-Item $temp -Recurse -Force -ErrorAction SilentlyContinue
  }
}

# ---------- 汇总 ----------
Write-Host ""
if ($fail -eq 0) {
  Write-Host "== 全部通过 ==" -ForegroundColor Green
  exit 0
} else {
  Write-Host "== $fail 项失败，请重新安装或检查原因 ==" -ForegroundColor Red
  exit 1
}
