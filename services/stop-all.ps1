<#
.SYNOPSIS
  Stops all services started by run-all.ps1 (via their recorded PIDs) and, unless -KeepInfra is
  passed, stops the Docker infra containers too.

.PARAMETER KeepInfra
  Leave the Docker infra containers (kafka, mongo, redis, mailhog, ...) running.
#>
param(
    [switch]$KeepInfra
)

$root = $PSScriptRoot
Set-Location $root
$pidFile = Join-Path $root ".run-all.pids"

if (Test-Path $pidFile) {
    Write-Host "==> Stopping services" -ForegroundColor Cyan
    Get-Content $pidFile | ForEach-Object {
        $parts = $_ -split " ", 2
        $procId = $parts[0]
        $name = $parts[1]
        $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
        if ($proc) {
            # /T also kills any child (in case a javapath-shim java.exe ever ends up in
            # the pid file again and re-exec'd the real JVM as a child process).
            taskkill /PID $procId /F /T | Out-Null
            Write-Host "  stopped $name (pid=$procId)"
        }
        else {
            Write-Host "  $name (pid=$procId) already gone"
        }
    }
    Remove-Item $pidFile
}
else {
    Write-Host "No .run-all.pids file found - nothing to stop (or already stopped)." -ForegroundColor Yellow
}

if (-not $KeepInfra) {
    Write-Host "==> Stopping infra containers" -ForegroundColor Cyan
    docker compose stop zookeeper kafka mongo redis mailhog
}
else {
    Write-Host "==> Leaving infra containers running (-KeepInfra)" -ForegroundColor Yellow
}
