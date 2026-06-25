param(
  [string]$BaseUrl = "http://127.0.0.1:8080",
  [string]$ApiKey = "agent-key-if-needed",
  [switch]$ExpectDeepSeek
)

$ErrorActionPreference = "Stop"
$base = $BaseUrl.TrimEnd("/")
$headers = @{
  Authorization = "Bearer $ApiKey"
}

function Assert-True {
  param(
    [bool]$Condition,
    [string]$Message
  )
  if (-not $Condition) {
    throw $Message
  }
}

Write-Host "== Health =="
$health = Invoke-RestMethod -Uri "$base/api/v1/health" -Method Get
Assert-True ($health.data.status -eq "ok") "health status was not ok"
Write-Host "PASS health"

Write-Host "== Showcase =="
$showcase = Invoke-WebRequest -UseBasicParsing -Uri "$base/showcase" -Method Get
Assert-True ($showcase.StatusCode -eq 200) "showcase did not return HTTP 200"
Assert-True ($showcase.Content.Contains("Strategy Doctor")) "showcase did not contain Strategy Doctor"
Write-Host "PASS showcase"

Write-Host "== Capabilities =="
$capabilities = Invoke-RestMethod -Uri "$base/api/v1/capabilities" -Method Get -Headers $headers
$archetypes = @($capabilities.data | ForEach-Object { $_.archetype })
foreach ($expected in @("ma-cross", "rsi-bollinger-mean-reversion", "breakout-confirmation")) {
  Assert-True ($archetypes -contains $expected) "missing capability $expected"
}
Write-Host "PASS capabilities"

Write-Host "== Rules parse =="
$parseBody = @{ description = "BTCUSDT 1h moving average crossover, fast MA 8, slow MA 30" } | ConvertTo-Json
$draft = Invoke-RestMethod `
  -Uri "$base/api/v1/strategies/parse" `
  -Method Post `
  -ContentType "application/json" `
  -Headers $headers `
  -Body $parseBody
Assert-True ($draft.data.source -eq "rules") "rules parse did not use rules"
Assert-True ($draft.data.strategy.archetype -eq "ma-cross") "rules parse did not produce ma-cross"
Write-Host "PASS rules parse"

if ($ExpectDeepSeek) {
  Write-Host "== DeepSeek parse =="
  $aiBody = @{ description = "BTC moving average strategy" } | ConvertTo-Json
  $aiDraft = Invoke-RestMethod `
    -Uri "$base/api/v1/strategies/parse" `
    -Method Post `
    -ContentType "application/json" `
    -Headers $headers `
    -Body $aiBody
  Assert-True ($aiDraft.data.source -eq "deepseek") "DeepSeek parse did not return source=deepseek"
  Assert-True ($aiDraft.data.strategy.archetype -eq "ma-cross") "DeepSeek parse did not produce ma-cross"
  Write-Host "PASS DeepSeek parse"
}

Write-Host "== Diagnosis =="
$diagnosisBody = Get-Content -LiteralPath "examples\submission\ma-diagnose-request.json" -Raw
$diagnosis = Invoke-RestMethod `
  -Uri "$base/api/v1/diagnoses" `
  -Method Post `
  -ContentType "application/json" `
  -Headers $headers `
  -Body $diagnosisBody
$view = if ($null -ne $diagnosis.data.view) { $diagnosis.data.view } else { $diagnosis.data }
Assert-True (@($view.scorecard.evaluations).Count -eq 5) "diagnosis did not return five evaluations"
Assert-True (@($view.charts.riskRadar).Count -eq 5) "diagnosis did not return five risk radar points"
Assert-True ($null -ne $view.deployment.status) "diagnosis missing deployment readiness"
Write-Host "PASS diagnosis"

Write-Host "Smoke tests passed for $base"
