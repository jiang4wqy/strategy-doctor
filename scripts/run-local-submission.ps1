param(
  [string]$NodeHome = "D:\tools\node-v24.14.0-win-x64",
  [string]$GetAgentSkill = "D:\tools\getagent-skill-codex"
)

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

$env:PATH = "$NodeHome;$env:PATH"

Write-Host "== Node =="
& "$NodeHome\node.exe" --version
& "$NodeHome\npm.cmd" --version

Write-Host "== Install dependencies =="
& "$NodeHome\npm.cmd" ci

Write-Host "== Verify project =="
& "$NodeHome\npm.cmd" run verify

Write-Host "== Build Web/API UI =="
& "$NodeHome\npm.cmd" run build:web

Write-Host "== Validate Playbook package =="
python "$GetAgentSkill\scripts\validate.py" `
  "examples\playbook\strategy-doctor-adaptive-playbook"

Write-Host "== Generate submission package index =="
& "$NodeHome\npm.cmd" run submission:package

Write-Host "== Manual smoke commands =="
Write-Host "Start Web/API:"
Write-Host "  `$env:DOCTOR_WEB_ACCESS_CODE='demo-code-change-me'"
Write-Host "  `$env:DOCTOR_SESSION_SECRET='demo-session-secret-at-least-32-chars'"
Write-Host "  `$env:DOCTOR_API_KEYS='demo-private-agent-key'"
Write-Host "  $NodeHome\npm.cmd run web"
Write-Host "Open no-login showcase:"
Write-Host "  http://127.0.0.1:8080/showcase"
