if (-not $env:STRATEGY_DOCTOR_URL -or -not $env:STRATEGY_DOCTOR_API_KEY) {
  throw "Set STRATEGY_DOCTOR_URL and STRATEGY_DOCTOR_API_KEY."
}

$headers = @{
  Authorization = "Bearer $env:STRATEGY_DOCTOR_API_KEY"
}

Invoke-RestMethod `
  -Uri "$env:STRATEGY_DOCTOR_URL/api/v1/capabilities" `
  -Headers $headers

$diagnosis = @'
{
  "strategy": {
    "id": "agent-ma-001",
    "name": "Agent moving-average strategy",
    "archetype": "ma-cross",
    "params": {
      "fastMA": 8,
      "slowMA": 30,
      "leverage": 5,
      "stopLossPct": 0.1,
      "positionPct": 0.6
    },
    "universe": ["BTCUSDT"],
    "timeframe": "1h"
  },
  "style": "conservative",
  "seed": 42,
  "candidates": 6
}
'@

Invoke-RestMethod `
  -Method Post `
  -Uri "$env:STRATEGY_DOCTOR_URL/api/v1/diagnoses" `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $diagnosis
