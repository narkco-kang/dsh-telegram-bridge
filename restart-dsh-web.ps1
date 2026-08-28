# restart-dsh-web.ps1
# 杀掉占用 3080 的 dsh web，然后以隐藏窗口重新后台启动（输出写日志）。本脚本通常被 install 脚本以“分离进程”方式调用，
# 这样即使它把当前 dsh web（宿主）停掉，本脚本也能照常把新实例拉起来。
$ErrorActionPreference = 'SilentlyContinue'

$dshHome = Join-Path $env:USERPROFILE '.dsh'

# 1) 杀掉当前监听 3080 的 dsh web
$conns = Get-NetTCPConnection -LocalPort 3080 -State Listen
if ($conns) {
  $conns | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object {
    Write-Host "killing dsh web PID $_"
    taskkill /PID $_ /T /F *> $null
  }
} else {
  Write-Host "nothing listening on 3080"
}
Start-Sleep -Seconds 3

# 2) 生成一个临时 run-dsh.cmd，用隐藏窗口后台启动 dsh web，并把输出写到日志
$log    = Join-Path $dshHome 'dsh-web-restart.log'
$runCmd = Join-Path $env:TEMP 'dsh-web-restart-run.cmd'
Set-Content -Path $runCmd -Encoding ascii -Value @(
  '@echo off',
  'cd /d "' + $dshHome + '"',
  'npx --yes @deepseek-ai/dsh web >> "' + $log + '" 2>&1'
)
Start-Process -FilePath $runCmd -WindowStyle Hidden

Write-Host "dsh web restarted (detached). Log: $log"
