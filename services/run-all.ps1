<#
.SYNOPSIS
  Clean-builds every IncidentOps module and launches all 13 services natively (no Docker for the
  Java processes themselves). Kafka/Mongo/Redis/Zookeeper/Schema-Registry/MailHog are started via
  Docker Compose (infra-only); Postgres is assumed to already be running locally on 5432 with
  authdb/orgdb/userdb/incidentdb/workflowdb owned by user "postgres" (matches each service's
  application-dev.yml).

.PARAMETER SkipBuild
  Skip `mvn clean install` and just (re)launch whatever jars are already in target/.

.PARAMETER SkipTests
  Run the Maven build with -DskipTests (default: on). Pass -SkipTests:$false to run tests.

.PARAMETER SkipInfra
  Skip starting the Docker infra containers (use if they're already up).

.EXAMPLE
  .\run-all.ps1
.EXAMPLE
  .\run-all.ps1 -SkipBuild -SkipInfra
#>
param(
    [switch]$SkipBuild,
    [bool]$SkipTests = $true,
    [switch]$SkipInfra
)

# Not setting $ErrorActionPreference = "Stop": docker/mvn write routine progress to
# stderr, which under EAP=Stop gets treated as a terminating error even on success.
# Exit codes are checked explicitly instead ($LASTEXITCODE) after each native call.
$root = $PSScriptRoot
Set-Location $root

# On this machine "java" on PATH resolves to Oracle's javapath shim, which re-execs the
# real JDK as a CHILD process - so Start-Process would hand back the shim's PID, not the
# JVM's, and stop-all.ps1 could never actually kill the service (it'd orphan the JVM).
# Resolve past the shim to the real java.exe up front.
$javaExe = if ($env:JAVA_HOME) {
    Join-Path $env:JAVA_HOME "bin\java.exe"
}
else {
    (where.exe java) -split "`n" | Where-Object { $_ -notmatch "javapath" } | Select-Object -First 1
}
if (-not $javaExe -or -not (Test-Path $javaExe)) {
    Write-Host "Could not resolve a real java.exe (only found the javapath shim). Set JAVA_HOME and retry." -ForegroundColor Red
    exit 1
}
Write-Host "Using java: $javaExe" -ForegroundColor DarkGray

$logsDir = Join-Path $root "_runlogs"
New-Item -ItemType Directory -Force -Path $logsDir | Out-Null
$pidFile = Join-Path $root ".run-all.pids"
Remove-Item $pidFile -ErrorAction SilentlyContinue

# name, dir, extra profile arg, port, health path (empty = no health wait)
$services = @(
    @{ Name = "discovery-server";        Profile = "--spring.profiles.active=dev";  Port = 8761 }
    @{ Name = "config-server";           Profile = "--spring.profiles.include=dev"; Port = 8888 }
    @{ Name = "api-gateway";             Profile = "--spring.profiles.active=dev";  Port = 8080 }
    @{ Name = "auth-service";            Profile = "--spring.profiles.active=dev";  Port = 8091 }
    @{ Name = "org-service";             Profile = "--spring.profiles.active=dev";  Port = 8092 }
    @{ Name = "user-service";            Profile = "--spring.profiles.active=dev";  Port = 8093 }
    @{ Name = "alert-ingestion-service"; Profile = "--spring.profiles.active=dev";  Port = 8094 }
    @{ Name = "incident-service";        Profile = "--spring.profiles.active=dev";  Port = 8095 }
    @{ Name = "workflow-service";        Profile = "--spring.profiles.active=dev";  Port = 8096 }
    @{ Name = "notification-service";    Profile = "--spring.profiles.active=dev";  Port = 8097 }
    @{ Name = "chat-service";            Profile = "--spring.profiles.active=dev";  Port = 8098 }
    @{ Name = "analytics-service";       Profile = "--spring.profiles.active=dev";  Port = 8099 }
    @{ Name = "auditor-service";         Profile = "--spring.profiles.active=dev";  Port = 8100 }
)

function Wait-ForHttpOk {
    param([string]$Url, [int]$TimeoutSec = 90)
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        try {
            $resp = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
            if ($resp.StatusCode -eq 200) { return $true }
        } catch { }
        Start-Sleep -Seconds 2
    }
    return $false
}

# ---------- 1. Build ----------
if (-not $SkipBuild) {
    Write-Host "==> mvn clean install (reactor build, all modules)" -ForegroundColor Cyan
    $testArg = if ($SkipTests) { "-DskipTests" } else { "" }
    & mvn clean install $testArg
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Build failed - aborting, nothing was started." -ForegroundColor Red
        exit 1
    }
}
else {
    Write-Host "==> Skipping build (-SkipBuild)" -ForegroundColor Yellow
}

# ---------- 2. Infra (Docker: everything except Postgres, which runs natively) ----------
if (-not $SkipInfra) {
    Write-Host "==> Starting required infra containers (zookeeper, kafka, mongo, redis) via docker compose" -ForegroundColor Cyan
    docker compose up -d zookeeper kafka mongo redis
    if ($LASTEXITCODE -ne 0) {
        Write-Host "docker compose failed to start required infra - aborting." -ForegroundColor Red
        exit 1
    }

    # mailhog is only the dev SMTP catcher for auth-service's forgot-password email -
    # its image pull has been flaky against the registry, so treat it as best-effort
    # rather than aborting the whole stack over it.
    Write-Host "==> Starting mailhog (best-effort, non-fatal if it fails)" -ForegroundColor Cyan
    docker compose up -d mailhog
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  mailhog did not start - forgot-password emails won't be catchable at http://localhost:8025, everything else is unaffected." -ForegroundColor Yellow
    }

    Write-Host "==> Waiting for kafka/mongo/redis to report healthy..." -ForegroundColor Cyan
    $infraServices = @("kafka", "mongo", "redis")
    $deadline = (Get-Date).AddSeconds(120)
    foreach ($svc in $infraServices) {
        while ($true) {
            $cid = (docker compose ps -q $svc)
            $health = if ($cid) { docker inspect --format='{{.State.Health.Status}}' $cid 2>$null } else { "" }
            if ($health -eq "healthy") { break }
            if ((Get-Date) -gt $deadline) {
                Write-Host "  $svc did not become healthy in time, continuing anyway." -ForegroundColor Yellow
                break
            }
            Start-Sleep -Seconds 2
        }
        Write-Host "  $svc ready"
    }
}
else {
    Write-Host "==> Skipping infra startup (-SkipInfra)" -ForegroundColor Yellow
}

# ---------- 3. Launch services natively ----------
Write-Host "==> Launching services" -ForegroundColor Cyan

foreach ($svc in $services) {
    $name = $svc.Name
    $jar = Join-Path $root "$name\target\$name-1.0.0.jar"
    if (-not (Test-Path $jar)) {
        Write-Host "  SKIP $name - jar not found at $jar (build may have failed for this module)" -ForegroundColor Red
        continue
    }
    $log = Join-Path $logsDir "$name.log"

    $proc = Start-Process -FilePath $javaExe `
        -ArgumentList @("-jar", $jar, $svc.Profile) `
        -WorkingDirectory (Join-Path $root $name) `
        -RedirectStandardOutput $log `
        -RedirectStandardError "$log.err" `
        -WindowStyle Hidden `
        -PassThru

    "$($proc.Id) $name" | Add-Content -Path $pidFile
    Write-Host ("  started {0,-24} pid={1,-7} port={2}  log={3}" -f $name, $proc.Id, $svc.Port, $log)

    # Bring up the registry first and give it a head start before everything else piles on.
    if ($name -eq "discovery-server") {
        Write-Host "==> Waiting for discovery-server to become healthy..." -ForegroundColor Cyan
        if (-not (Wait-ForHttpOk -Url "http://localhost:8761/actuator/health" -TimeoutSec 90)) {
            Write-Host "  discovery-server did not report healthy in time - continuing anyway." -ForegroundColor Yellow
        }
    }
}

Write-Host ""
Write-Host "All services launched. PIDs recorded in $pidFile" -ForegroundColor Green
Write-Host "Logs: $logsDir\<service>.log (+ .err)"
Write-Host "Stop everything with: .\stop-all.ps1"
Write-Host ""
Write-Host "Health check once services finish starting (~30-60s), e.g.:"
foreach ($svc in $services) {
    Write-Host ("  http://localhost:{0}/actuator/health" -f $svc.Port)
}
