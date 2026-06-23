param(
  [int]$Port = 8080,
  [string]$AccessCode = 'team-preview-code-change-me',
  [string]$ApiKey = 'agent-key-if-needed',
  [string]$SessionSecret = '',
  [switch]$KeepAuthRateLimit,
  [switch]$NoBuild
)

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path | Split-Path -Parent
Set-Location $RepoRoot

function Resolve-Node {
  $candidates = @(
    $env:NODE_EXE,
    'D:\tools\node-v24.14.0-win-x64\node.exe',
    'node'
  )

  foreach ($candidate in $candidates) {
    if ([string]::IsNullOrWhiteSpace($candidate)) {
      continue
    }
    try {
      $resolved = Get-Command $candidate -ErrorAction Stop
      if ($resolved.Source) {
        return $resolved.Source
      }
    } catch {
      # Try the next candidate.
    }
  }

  throw "Node runtime not found. Set NODE_EXE or install Node.js 24+."
}

function Stop-ExistingPort {
  param([int]$LocalPort)
  $listeners = Get-NetTCPConnection -LocalPort $LocalPort -State Listen -ErrorAction SilentlyContinue
  if (-not $listeners) {
    return
  }
  $listeners |
    Select-Object -ExpandProperty OwningProcess -Unique |
    ForEach-Object {
      Write-Host "Stopping existing process on port $LocalPort: PID $_"
      Stop-Process -Id $_ -Force
    }
}

if ([string]::IsNullOrWhiteSpace($SessionSecret)) {
  $SessionSecret = ([guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N'))
}

$Node = Resolve-Node
$LogDir = Join-Path $RepoRoot 'artifacts\logs'
New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
$Timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$StdoutLog = Join-Path $LogDir "showcase-$Timestamp.out.log"
$StderrLog = Join-Path $LogDir "showcase-$Timestamp.err.log"

Stop-ExistingPort -LocalPort $Port

$env:DOCTOR_HOST = '127.0.0.1'
$env:DOCTOR_PORT = "$Port"
$env:DOCTOR_WEB_ACCESS_CODE = $AccessCode
$env:DOCTOR_SESSION_SECRET = $SessionSecret
$env:DOCTOR_API_KEYS = $ApiKey
if ($KeepAuthRateLimit) {
  Remove-Item Env:DOCTOR_AUTH_RATE_LIMIT_DISABLED -ErrorAction SilentlyContinue
} else {
  $env:DOCTOR_AUTH_RATE_LIMIT_DISABLED = '1'
}

if (-not $NoBuild) {
  Write-Host 'Building web client...'
  & $Node node_modules\vite\bin\vite.js build --config web/vite.config.ts
  if ($LASTEXITCODE -ne 0) {
    throw 'Web build failed.'
  }
}

$process = Start-Process `
  -FilePath $Node `
  -ArgumentList @('src/server/start.ts') `
  -WorkingDirectory $RepoRoot `
  -RedirectStandardOutput $StdoutLog `
  -RedirectStandardError $StderrLog `
  -WindowStyle Hidden `
  -PassThru

Start-Sleep -Seconds 1

Write-Host ''
Write-Host 'Strategy Doctor showcase is running.'
Write-Host "URL: http://127.0.0.1:$Port/showcase"
Write-Host "Access code: $AccessCode"
Write-Host "PID: $($process.Id)"
Write-Host "Logs: $StdoutLog"
Write-Host "Errors: $StderrLog"
Write-Host ''
Write-Host "Stop it with: .\scripts\stop-showcase.ps1 -Port $Port"
