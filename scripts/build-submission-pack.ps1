param(
  [int]$Seed = 42,
  [int]$Candidates = 6,
  [string]$Out = 'artifacts\submission-pack'
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

$Node = Resolve-Node
& $Node src/scripts/submission-pack.ts --seed $Seed --candidates $Candidates --out $Out
if ($LASTEXITCODE -ne 0) {
  throw 'Submission pack generation failed.'
}
