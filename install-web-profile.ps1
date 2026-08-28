# install-web-profile.ps1
# 一键：备份 -> 安装 telegram-bridge 插件到 web profile -> 检查依赖 -> 自动重启 dsh web。
[CmdletBinding()]
param(
  [string]$Profile = 'web',
  [string]$PluginDir = $PSScriptRoot,
  [string]$FullName = '@local/dsh-telegram-bridge',
  [switch]$NoRestart
)

$ErrorActionPreference = 'Continue'

function Info($m){ Write-Host $m -ForegroundColor Cyan }
function Ok($m){  Write-Host $m -ForegroundColor Green }
function Warn($m){ Write-Host $m -ForegroundColor Yellow }
function Fail($m){ Write-Host $m -ForegroundColor Red }

$ProfilesRoot = Join-Path $env:USERPROFILE '.dsh\profiles'
$ProfileDir   = Join-Path $ProfilesRoot $Profile
$PkgFile      = Join-Path $ProfileDir 'package.json'
$PatchFile    = Join-Path $ProfileDir 'cordis.patch.yml'

Info "=== install Telegram Bridge plugin into [$Profile] profile ==="
Info ("plugin dir : " + $PluginDir)
Info ("profile dir: " + $ProfileDir)

# ---- 0) backup ----
Info ""
Info "--- 0) backup current config ---"
$backupDir = Join-Path $PluginDir ("backup-" + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Force $backupDir | Out-Null
foreach ($f in @('package.json','cordis.patch.yml','pnpm-lock.yaml')) {
  $src = Join-Path $ProfileDir $f
  if (Test-Path $src) { Copy-Item $src (Join-Path $backupDir $f) -Force; Ok "  backed up $f" }
}
Ok "backup saved to: $backupDir"

# ---- 1) install ----
Info ""
Info "--- 1) install: npx --yes @deepseek-ai/dsh plugin --profile $Profile add $PluginDir ---"
$npxOk = Get-Command npx -ErrorAction SilentlyContinue
if (-not $npxOk) {
  Warn "npx not found. Try: dsh plugin --profile $Profile add $PluginDir"
  & dsh plugin --profile $Profile add $PluginDir
} else {
  & npx --yes @deepseek-ai/dsh plugin --profile $Profile add $PluginDir
}

# ---- 2) check dependency in package.json ----
Info ""
Info "--- 2) check dependency in $PkgFile ---"
if (-not (Test-Path $PkgFile)) {
  Fail "package.json not found: $PkgFile"
} else {
  $content = [System.IO.File]::ReadAllText($PkgFile, [System.Text.Encoding]::UTF8)
  $json = $null
  try { $json = $content | ConvertFrom-Json } catch { }
  $dep = $null
  if ($json) { $dep = $json.dependencies.$FullName }
  if ($dep) {
    Ok "OK: $FullName added to dependencies -> $dep"
  } elseif ($content -match [regex]::Escape($FullName)) {
    Warn "$FullName present but not in dependencies (maybe devDependencies or link form)."
  } else {
    Fail "dependencies has no $FullName. Check install output (spawn powershell.exe ENOENT is a sandbox limit)."
  }
}

# ---- 3) check cordis.patch.yml ----
Info ""
Info "--- 3) check insert in $PatchFile ---"
if (Test-Path $PatchFile) {
  if ((Get-Content $PatchFile -Raw) -match [regex]::Escape($FullName)) {
    Ok "cordis.patch.yml already has the $FullName insert."
  } else {
    Warn "cordis.patch.yml has no $FullName - add the insert line first."
  }
} else {
  Warn "cordis.patch.yml not found: $PatchFile"
}

# ---- 4) auto-restart dsh web (detached) ----
Info ""
Info "--- 4) restart dsh web ---"
if ($NoRestart) {
  Warn "Skipped restart (-NoRestart). Restart dsh web manually."
} else {
  $restarter = Join-Path $PluginDir 'restart-dsh-web.ps1'
  if (Test-Path $restarter) {
    Start-Process powershell -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File', $restarter) -WindowStyle Hidden
    Ok "Restart triggered (detached). Your DSH GUI will briefly disconnect and come back."
    Ok "After it returns, open DSH web > Settings > Telegram Bridge > fill bot token + allowed user IDs + enable > save."
  } else {
    Warn "restart-dsh-web.ps1 not found; restart dsh web manually."
  }
}

# ---- 5) hint ----
Info ""
Info "=== DONE ==="
Warn "If install only reported 'spawn powershell.exe ENOENT', that is a sandbox process limit; run this script on a normal Windows machine."
