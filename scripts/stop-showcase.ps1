param(
  [int]$Port = 8080
)

$listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if (-not $listeners) {
  Write-Host "No Strategy Doctor process is listening on port $Port."
  exit 0
}

$listeners |
  Select-Object -ExpandProperty OwningProcess -Unique |
  ForEach-Object {
    Write-Host "Stopping process on port $Port: PID $_"
    Stop-Process -Id $_ -Force
  }

Write-Host "Port $Port is clear."
