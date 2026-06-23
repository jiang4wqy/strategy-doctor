param(
  [int]$Port = 8080,
  [string]$AccessCode = 'team-preview-code-change-me',
  [string]$ApiKey = 'agent-key-if-needed',
  [string]$SessionSecret = '',
  [switch]$InstallCloudflared,
  [switch]$NoBuild
)

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path | Split-Path -Parent
Set-Location $RepoRoot

function Resolve-Cloudflared {
  $candidates = @(
    $env:CLOUDFLARED_EXE,
    'D:\tools\cloudflared.exe',
    'cloudflared'
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

  return $null
}

function Install-Cloudflared {
  $toolsDir = 'D:\tools'
  New-Item -ItemType Directory -Path $toolsDir -Force | Out-Null
  $target = Join-Path $toolsDir 'cloudflared.exe'
  $url = 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe'
  Write-Host "Downloading cloudflared to $target ..."
  Invoke-WebRequest -Uri $url -OutFile $target -UseBasicParsing
  return $target
}

$cloudflared = Resolve-Cloudflared
if (-not $cloudflared -and $InstallCloudflared) {
  $cloudflared = Install-Cloudflared
}

if (-not $cloudflared) {
  throw "cloudflared was not found. Re-run with -InstallCloudflared to download it to D:\tools."
}

& (Join-Path $RepoRoot 'scripts\start-showcase.ps1') `
  -Port $Port `
  -AccessCode $AccessCode `
  -ApiKey $ApiKey `
  -SessionSecret $SessionSecret `
  -NoBuild:$NoBuild

$logDir = Join-Path $RepoRoot 'artifacts\logs'
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$stdoutLog = Join-Path $logDir "cloudflared-$timestamp.out.log"
$stderrLog = Join-Path $logDir "cloudflared-$timestamp.err.log"

$process = Start-Process `
  -FilePath $cloudflared `
  -ArgumentList @('tunnel', '--url', "http://127.0.0.1:$Port") `
  -WorkingDirectory $RepoRoot `
  -RedirectStandardOutput $stdoutLog `
  -RedirectStandardError $stderrLog `
  -WindowStyle Hidden `
  -PassThru

$publicUrl = $null
for ($index = 0; $index -lt 30; $index++) {
  Start-Sleep -Seconds 1
  $content = ''
  if (Test-Path $stdoutLog) {
    $content += Get-Content $stdoutLog -Raw -ErrorAction SilentlyContinue
  }
  if (Test-Path $stderrLog) {
    $content += Get-Content $stderrLog -Raw -ErrorAction SilentlyContinue
  }
  $match = [regex]::Match($content, 'https://[a-zA-Z0-9-]+\.trycloudflare\.com')
  if ($match.Success) {
    $publicUrl = $match.Value
    break
  }
}

Write-Host ''
Write-Host 'Public demo tunnel is running.'
Write-Host "Local judge mode: http://127.0.0.1:$Port/judge"
if ($publicUrl) {
  Write-Host "Public judge mode: $publicUrl/judge"
  Write-Host "Public private workspace: $publicUrl/showcase"
} else {
  Write-Host 'Public URL was not detected yet. Check the cloudflared logs below.'
}
Write-Host "Access code: $AccessCode"
Write-Host "Cloudflared PID: $($process.Id)"
Write-Host "Cloudflared logs: $stdoutLog"
Write-Host "Cloudflared errors: $stderrLog"
Write-Host ''
Write-Host "Stop the local server with: .\scripts\stop-showcase.ps1 -Port $Port"
Write-Host 'Stop the tunnel from Task Manager or by ending the cloudflared process above.'
