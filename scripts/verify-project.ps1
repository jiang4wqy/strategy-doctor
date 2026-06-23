param(
  [int]$Port = 8080,
  [switch]$SkipWebServer
)

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path | Split-Path -Parent
Set-Location $RepoRoot

function Resolve-Node {
  $candidates = @(
    'D:\tools\node-v24.14.0-win-x64\node.exe',
    $env:NODE_EXE,
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
      # continue to next candidate
    }
  }

  throw "Node runtime not found. Set NODE_EXE or ensure node is available in PATH."
}

function Invoke-Step {
  param([string]$Label, [scriptblock]$Action)
  Write-Host "==> $Label"
  & $Action
  if ($LASTEXITCODE -ne 0) {
    throw "Step failed: $Label"
  }
}

$Node = Resolve-Node

Invoke-Step -Label 'Running full unit + integration tests' -Action {
  & $Node --experimental-test-coverage --test tests/**/*.test.ts
}

Invoke-Step -Label 'Running TypeScript checks' -Action {
  & $Node node_modules\typescript\bin\tsc -p tsconfig.json
  if ($LASTEXITCODE -ne 0) {
    throw "Step failed: Running TypeScript checks"
  }
  & $Node node_modules\typescript\bin\tsc -p web/tsconfig.json
}

Invoke-Step -Label 'Building web bundle' -Action {
  & $Node node_modules\vite\bin\vite.js build --config web/vite.config.ts
}

Invoke-Step -Label 'Running CLI JSON smoke for both strategies' -Action {
  & $Node src/cli.ts examples/trend-follower.json --style conservative --seed 42 --candidates 6 --format json > $null
  if ($LASTEXITCODE -ne 0) {
    throw 'Step failed: ma-cross CLI smoke check'
  }
  & $Node src/cli.ts examples/rsi-bollinger.json --style conservative --seed 42 --candidates 6 --format json > $null
}

if ($SkipWebServer) {
  Write-Host 'Skip web server check as requested.'
  Write-Host '==> Verification complete'
  exit 0
}

Write-Host "==> Starting server on port $Port and checking /showcase"
$previousPort = $env:DOCTOR_PORT
$env:DOCTOR_PORT = "$Port"
$server = Start-Process -FilePath $Node -ArgumentList @('src/server/start.ts') -PassThru -NoNewWindow
try {
  $maxAttempts = 8
  $attempt = 0
  $ok = $false

  while ($attempt -lt $maxAttempts -and -not $ok) {
    Start-Sleep -Seconds 1
    $attempt++
    try {
      $response = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/showcase" -UseBasicParsing
      if ($response.StatusCode -eq 200) {
        Write-Host "==> /showcase check passed: $($response.StatusCode) after $attempt second(s)"
        $ok = $true
      } else {
        Write-Host "==> /showcase returned status $($response.StatusCode); retrying..."
      }
    } catch {
      if ($attempt -ge $maxAttempts) {
        throw "Failed to reach /showcase at 127.0.0.1:$Port within timeout."
      }
      Write-Host "==> /showcase not ready yet; retrying ($attempt/$maxAttempts)..."
    }
  }

  if (-not $ok) {
    throw "Failed to verify /showcase status."
  }
} finally {
  if ($server -and -not $server.HasExited) {
    Stop-Process -Id $server.Id
  }
  if ($null -eq $previousPort) {
    Remove-Item Env:DOCTOR_PORT
  } else {
    $env:DOCTOR_PORT = $previousPort
  }
}

Write-Host '==> Verification complete'
