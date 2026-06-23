param(
  [ValidateSet('ma-cross', 'rsi-bollinger-mean-reversion')]
  [string]$First = 'ma-cross',
  [ValidateSet('ma-cross', 'rsi-bollinger-mean-reversion')]
  [string]$Second = 'rsi-bollinger-mean-reversion',
  [int]$Seed = 42,
  [int]$Candidates = 6,
  [switch]$OutputJson,
  [string]$OutputFile = '',
  [string]$OutputDir = '',
  [switch]$Package
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
      # continue
    }
  }

  throw "Node runtime not found. Set NODE_EXE or install Node in PATH."
}

$Node = Resolve-Node
$OutputDir = $OutputDir.Trim()

$Examples = @{
  'ma-cross' = 'examples/trend-follower.json'
  'rsi-bollinger-mean-reversion' = 'examples/rsi-bollinger.json'
}

if (-not $Examples.ContainsKey($First) -or -not $Examples.ContainsKey($Second)) {
  throw 'Unsupported strategy archetypes. Use ma-cross or rsi-bollinger-mean-reversion.'
}

if ($Candidates -lt 1 -or $Candidates -gt 50) {
  throw "Candidates must be between 1 and 50. Current value: $Candidates"
}

function Invoke-Scorecard {
  param([string]$ExamplePath)
  $raw = & $Node src/cli.ts $ExamplePath --style conservative --seed $Seed --candidates $Candidates --format json 2>$null
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to run CLI for example $ExamplePath"
  }
  $jsonText = $raw | Out-String
  return $jsonText | ConvertFrom-Json
}

function Get-StyleRiskScore {
  param(
    [Parameter(Mandatory)]
    [object]$Card,
    [Parameter(Mandatory)]
    [string]$Style
  )

  if ($null -eq $Card.perStyle) {
    return $null
  }

  $styleNode = $Card.perStyle.$Style
  if ($null -eq $styleNode) {
    return $null
  }

  return $styleNode.riskScore
}

function Get-CostEfficiency {
  param(
    [Parameter(Mandatory)]
    [object]$Tradeoff
  )

  if ($null -eq $Tradeoff) {
    return $null
  }

  if (-not $Tradeoff.PSObject.Properties.Match('returnCost').Count -or -not $Tradeoff.PSObject.Properties.Match('robustnessGain').Count) {
    return $null
  }

  if ([Math]::Abs($Tradeoff.returnCost) -le 0.0005) {
    return 999
  }

  if ($Tradeoff.returnCost -eq 0) {
    return 999
  }

  return [Math]::Round($Tradeoff.robustnessGain / [Math]::Abs($Tradeoff.returnCost), 4)
}

function Build-RiskDashboard {
  param(
    [object]$Card
  )

  $trendScore = Get-StyleRiskScore -Card $Card -Style 'trend'
  $defenseScore = Get-StyleRiskScore -Card $Card -Style 'conservative'
  $costEfficiency = Get-CostEfficiency -Tradeoff $Card.tradeoff
  $alerts = @()
  $trendThreshold = 35
  $defenseThreshold = 42
  $costThreshold = 1

  if (($null -ne $trendScore) -and ($trendScore -lt $trendThreshold)) {
    $alerts += [ordered]@{
      code = 'trend-threshold'
      severity = 'warning'
      message = 'trend score is below threshold'
      value = $trendScore
      threshold = $trendThreshold
    }
  }
  if (($null -ne $defenseScore) -and ($defenseScore -lt $defenseThreshold)) {
    $alerts += [ordered]@{
      code = 'defense-threshold'
      severity = 'warning'
      message = 'defense score is below threshold'
      value = $defenseScore
      threshold = $defenseThreshold
    }
  }
  if ($null -ne $Card.tradeoff -and $Card.tradeoff.robustnessGain -lt 0) {
    $alerts += [ordered]@{
      code = 'robustness-negative'
      severity = 'critical'
      message = 'robustness is negative'
      value = $Card.tradeoff.robustnessGain
      threshold = 0
    }
  }
  if (($null -ne $costEfficiency) -and ($costEfficiency -lt $costThreshold)) {
    $alerts += [ordered]@{
      code = 'cost-efficiency-threshold'
      severity = if ($costEfficiency -lt 0.25) { 'critical' } else { 'warning' }
      message = 'cost-efficiency is below threshold'
      value = $costEfficiency
      threshold = $costThreshold
    }
  }

  return [ordered]@{
    trendScore = $trendScore
    defenseScore = $defenseScore
    costEfficiency = if ($null -eq $costEfficiency) { $null } else { [Math]::Round($costEfficiency, 4) }
    trendDefenseGap = if ($null -ne $trendScore -and $null -ne $defenseScore) { [Math]::Round($trendScore - $defenseScore, 2) } else { $null }
    costEfficiencyThreshold = $costThreshold
    trendThreshold = $trendThreshold
    defenseThreshold = $defenseThreshold
    alerts = $alerts
  }
}

function Build-DeathsByDimension {
  param(
    [Parameter(Mandatory)]
    [AllowNull()]
    [object[]]$Deaths
  )
  if ($null -eq $Deaths) {
    return @()
  }
  return $Deaths | Group-Object -Property dimension | ForEach-Object {
    [ordered]@{
      dimension = $_.Name
      count = $_.Count
    }
  }
}

function Build-PrescriptionSignature {
  param([object]$Card)

  if ($null -eq $Card.prescription) {
    return @{}
  }
  return $Card.prescription.changes
}

function Build-PrescriptionConsensus {
  param([object]$Card)

  if ($null -eq $Card.prescription -or $null -eq $Card.prescription.consensus) {
    return $null
  }

  return [ordered]@{
    requestedStyles = @($Card.prescription.consensus.requestedStyles)
    agreeingStyles = @($Card.prescription.consensus.agreeingStyles)
    mismatches = @($Card.prescription.consensus.mismatches)
    agreementRate = $Card.prescription.consensus.agreementRate
  }
}

function Build-StyleDelta {
  param(
    [object]$FirstCard,
    [object]$SecondCard
  )

  $styles = @('conservative', 'aggressive', 'trend')
  $rows = @()
  $firstBetter = 0
  $secondBetter = 0
  $tie = 0

  foreach ($style in $styles) {
    $firstScore = Get-StyleRiskScore -Card $FirstCard -Style $style
    $secondScore = Get-StyleRiskScore -Card $SecondCard -Style $style
    $difference = if (($null -ne $firstScore) -and ($null -ne $secondScore)) {
      [Math]::Round($firstScore - $secondScore, 4)
    } else {
      $null
    }
    $winner = if ($difference -gt 0) {
      $firstBetter++
      'first'
    } elseif ($difference -lt 0) {
      $secondBetter++
      'second'
    } else {
      $tie++
      'tie'
    }

    $rows += [ordered]@{
      style = $style
      first = $firstScore
      second = $secondScore
      difference = $difference
      winner = $winner
    }
  }

  return [ordered]@{
    rows = $rows
    totals = [ordered]@{
      first = $firstBetter
      second = $secondBetter
      tie = $tie
    }
  }
}

function Format-Dimensions {
  param([array]$Evaluations)
  return ($Evaluations | ForEach-Object {
    "${($_.dimension)} pnl=$([Math]::Round($_.metrics.pnlPct * 100, 2))% dd=$([Math]::Round($_.metrics.maxDrawdownPct * 100, 2))% cause=$($_.cause)"
  })
}

function Build-EvaluationDelta {
  param(
    [array]$FirstEvaluations,
    [array]$SecondEvaluations
  )

  $firstByDimension = @{}
  foreach ($evaluation in $FirstEvaluations) {
    $firstByDimension[$evaluation.dimension] = $evaluation
  }

  $rows = @()
  $firstWins = 0
  $secondWins = 0
  $ties = 0

  foreach ($second in $SecondEvaluations) {
    $dimension = $second.dimension
    $first = $firstByDimension[$dimension]
    if ($null -eq $first) {
      continue
    }
    $firstPnl = [Math]::Round($first.metrics.pnlPct * 100, 4)
    $secondPnl = [Math]::Round($second.metrics.pnlPct * 100, 4)
    $firstDd = [Math]::Round($first.metrics.maxDrawdownPct * 100, 4)
    $secondDd = [Math]::Round($second.metrics.maxDrawdownPct * 100, 4)
    $pnlDelta = [Math]::Round($secondPnl - $firstPnl, 4)
    $ddDelta = [Math]::Round($secondDd - $firstDd, 4)
    $winner = if (($pnlDelta -gt 0) -and ($ddDelta -le 0)) {
      $firstWins++
      'first'
    } elseif (($pnlDelta -lt 0) -and ($ddDelta -ge 0)) {
      $secondWins++
      'second'
    } else {
      $ties++
      'tie'
    }

    $rows += [ordered]@{
      dimension = $dimension
      firstPnlPct = $firstPnl
      secondPnlPct = $secondPnl
      pnlDeltaPctPoints = $pnlDelta
      firstMaxDrawdownPct = $firstDd
      secondMaxDrawdownPct = $secondDd
      maxDrawdownDeltaPctPoints = $ddDelta
      firstCause = $first.cause
      secondCause = $second.cause
      winner = $winner
    }
  }

  return [ordered]@{
    rows = $rows
    totals = [ordered]@{
      first = $firstWins
      second = $secondWins
      tie = $ties
    }
  }
}

function Build-DeathDelta {
  param(
    [object[]]$FirstDeaths,
    [object[]]$SecondDeaths
  )

  if ($null -eq $FirstDeaths) {
    $FirstDeaths = @()
  }
  if ($null -eq $SecondDeaths) {
    $SecondDeaths = @()
  }

  $firstNormalized = $FirstDeaths | ForEach-Object { $_.scenarioId }
  $secondNormalized = $SecondDeaths | ForEach-Object { $_.scenarioId }

  $firstOnly = $firstNormalized | Where-Object { $_ -and ($secondNormalized -notcontains $_) }
  $secondOnly = $secondNormalized | Where-Object { $_ -and ($firstNormalized -notcontains $_) }

  return [ordered]@{
    totalDiff = $FirstDeaths.Count - $SecondDeaths.Count
    byDimension = Build-DeathsByDimension -Deaths ($FirstDeaths + $SecondDeaths)
    firstOnly = $firstOnly
    secondOnly = $secondOnly
    firstByDimension = Build-DeathsByDimension -Deaths $FirstDeaths
    secondByDimension = Build-DeathsByDimension -Deaths $SecondDeaths
  }
}

function Build-PrescriptionDelta {
  param(
    [object]$FirstCard,
    [object]$SecondCard
  )

  $firstChanges = Build-PrescriptionSignature -Card $FirstCard
  $secondChanges = Build-PrescriptionSignature -Card $SecondCard
  if ($null -eq $firstChanges) {
    $firstChanges = @{}
  }
  if ($null -eq $secondChanges) {
    $secondChanges = @{}
  }

  $firstKeys = @($firstChanges.PSObject.Properties.Name)
  $secondKeys = @($secondChanges.PSObject.Properties.Name)
  $keys = @($firstKeys + $secondKeys | Sort-Object -Unique)
  $rows = @()
  $changed = 0

  foreach ($key in $keys) {
    $firstValue = $firstChanges.$key
    $secondValue = $secondChanges.$key
    $isChanged = $firstValue -ne $secondValue
    if ($isChanged) {
      $changed++
    }

    $rows += [ordered]@{
      key = $key
      first = $firstValue
      second = $secondValue
      changed = $isChanged
    }
  }

  return [ordered]@{
    rows = $rows
    changedKeys = $changed
  }
}

function Build-TradeoffSummary {
  param(
    [object]$FirstCard,
    [object]$SecondCard
  )

  $firstTradeoff = $FirstCard.tradeoff
  $secondTradeoff = $SecondCard.tradeoff

  $firstEfficiency = Get-CostEfficiency -Tradeoff $firstTradeoff
  $secondEfficiency = Get-CostEfficiency -Tradeoff $secondTradeoff

  $robustnessDelta = [Math]::Round($firstTradeoff.robustnessGain - $secondTradeoff.robustnessGain, 4)
  $returnDelta = [Math]::Round($firstTradeoff.returnCost - $secondTradeoff.returnCost, 4)
  $efficiencyDelta = if ($null -eq $firstEfficiency -or $null -eq $secondEfficiency) {
    $null
  } else {
    [Math]::Round($firstEfficiency - $secondEfficiency, 4)
  }

  $winner = if ($robustnessDelta -gt 0 -and $returnDelta -ge 0) {
    'first'
  } elseif ($robustnessDelta -lt 0 -and $returnDelta -le 0) {
    'second'
  } else {
    'mixed'
  }

  return [ordered]@{
    first = [ordered]@{
      robustnessGain = [Math]::Round($firstTradeoff.robustnessGain, 4)
      returnCost = [Math]::Round($firstTradeoff.returnCost, 4)
      costEfficiency = $firstEfficiency
    }
    second = [ordered]@{
      robustnessGain = [Math]::Round($secondTradeoff.robustnessGain, 4)
      returnCost = [Math]::Round($secondTradeoff.returnCost, 4)
      costEfficiency = $secondEfficiency
    }
    deltas = [ordered]@{
      robustnessGain = $robustnessDelta
      returnCost = $returnDelta
      costEfficiency = $efficiencyDelta
    }
    winner = $winner
  }
}

function Build-ConsensusWinners {
  param(
    [object]$StyleDelta,
    [object]$EvaluationDelta,
    [object]$Tradeoff
  )

  $firstScore = $StyleDelta.totals.first + $EvaluationDelta.totals.first
  $secondScore = $StyleDelta.totals.second + $EvaluationDelta.totals.second
  $winner = 'tie'
  if ($firstScore -gt $secondScore) {
    $winner = 'first'
  } elseif ($secondScore -gt $firstScore) {
    $winner = 'second'
  }
  return [ordered]@{
    score = [ordered]@{
      first = $firstScore
      second = $secondScore
      gap = $firstScore - $secondScore
    }
    winner = $winner
    tradeoff = $Tradeoff.winner
    style = $StyleDelta.totals
    dimension = $EvaluationDelta.totals
  }
}

function Build-ExplainableSummary {
  param(
    [object]$StyleDelta,
    [object]$EvaluationDelta,
    [object]$Tradeoff
  )

  $reason = New-Object System.Collections.Generic.List[string]

  if ($StyleDelta.totals.first -gt $StyleDelta.totals.second) {
    [void]$reason.Add("Style risk score is cleaner for first strategy in $($StyleDelta.totals.first) styles.")
  } elseif ($StyleDelta.totals.second -gt $StyleDelta.totals.first) {
    [void]$reason.Add("Style risk score is cleaner for second strategy in $($StyleDelta.totals.second) styles.")
  } else {
    [void]$reason.Add('Style risk score is mostly tied.')
  }

  if ($EvaluationDelta.totals.first -gt $EvaluationDelta.totals.second) {
    [void]$reason.Add("Trade-off dimensions favor first in $($EvaluationDelta.totals.first) dimensions.")
  } elseif ($EvaluationDelta.totals.second -gt $EvaluationDelta.totals.first) {
    [void]$reason.Add("Trade-off dimensions favor second in $($EvaluationDelta.totals.second) dimensions.")
  } else {
    [void]$reason.Add('Dimension-level trade-off is mixed.')
  }

  if ($Tradeoff.winner -eq 'first') {
    [void]$reason.Add('Held-out robustness and return move in the same positive direction for first strategy.')
  } elseif ($Tradeoff.winner -eq 'second') {
    [void]$reason.Add('Held-out robustness and return move in the same positive direction for second strategy.')
  } else {
    [void]$reason.Add('Held-out robustness/return signal is mixed; check alerts and edge-case behavior.')
  }

  return @($reason.ToArray())
}

function Build-MatchDecision {
  param(
    [object]$Tradeoff,
    [string]$FirstName,
    [string]$SecondName
  )

  if ($Tradeoff.winner -eq 'first') {
    return [ordered]@{
      winner = $FirstName
      reasons = @(
        "Higher held-out robustness gain: $($Tradeoff.deltas.robustnessGain)",
        "Favorable held-out return change: $($Tradeoff.deltas.returnCost)"
      )
    }
  }
  if ($Tradeoff.winner -eq 'second') {
    return [ordered]@{
      winner = $SecondName
      reasons = @(
        "Higher held-out robustness gain: $([Math]::Abs($Tradeoff.deltas.robustnessGain))",
        "Favorable held-out return change: $([Math]::Abs($Tradeoff.deltas.returnCost))"
      )
    }
  }
  return [ordered]@{
    winner = 'tie'
    reasons = @(
      'No clean dominance across robustness and return.',
      'Review alert list and dimension-level details.'
    )
  }
}

function Render-EvidenceMarkdown {
  param(
    [string]$First,
    [string]$Second,
    [object]$Report
  )

  $summary = @"
# Strategy doctor comparison evidence pack

- First strategy: $First
- Second strategy: $Second
- Seed: $($Report.metadata.seed)
- Candidates: $($Report.metadata.candidates)
- Scenario set: $($Report.metadata.scenarioSetId)
- First strategy ID: $($Report.strategies[0].strategyId)
- Second strategy ID: $($Report.strategies[1].strategyId)

## Executive result

- Winner: $($Report.evidence.overallWinner)
- Style winners: first=$($Report.deltas.styleWinnerTotals.first), second=$($Report.deltas.styleWinnerTotals.second), tie=$($Report.deltas.styleWinnerTotals.tie)
- Dimension winners: first=$($Report.deltas.evaluationWinnerTotals.first), second=$($Report.deltas.evaluationWinnerTotals.second), tie=$($Report.deltas.evaluationWinnerTotals.tie)
- Tradeoff winner: $($Report.deltas.tradeoff.winner)

## Risk dashboard

- $First trend score: $($Report.strategies[0].riskDashboard.trendScore)
- $First defense score: $($Report.strategies[0].riskDashboard.defenseScore)
- $First cost efficiency: $($Report.strategies[0].riskDashboard.costEfficiency)
- $Second trend score: $($Report.strategies[1].riskDashboard.trendScore)
- $Second defense score: $($Report.strategies[1].riskDashboard.defenseScore)
- $Second cost efficiency: $($Report.strategies[1].riskDashboard.costEfficiency)

### Scenario outcome summary

- First deaths: $($Report.strategies[0].deaths)
- Second deaths: $($Report.strategies[1].deaths)
- Net death count delta (first minus second): $($Report.deltas.deaths.totalDiff)

### Tradeoff

- Robustness: first=$($Report.deltas.tradeoff.first.robustnessGain), second=$($Report.deltas.tradeoff.second.robustnessGain), delta=$($Report.deltas.tradeoff.deltas.robustnessGain)
- Return cost: first=$($Report.deltas.tradeoff.first.returnCost), second=$($Report.deltas.tradeoff.second.returnCost), delta=$($Report.deltas.tradeoff.deltas.returnCost)
- Cost-efficiency: first=$($Report.deltas.tradeoff.first.costEfficiency), second=$($Report.deltas.tradeoff.second.costEfficiency), delta=$($Report.deltas.tradeoff.deltas.costEfficiency)

## Explainable summary

$($Report.evidence.explainableSummary | ForEach-Object { "- $_" } | Out-String)

## Prescription consistency

- First prescription agreement: $(
  if ($null -ne $Report.strategies[0].prescriptionConsensus) {
    [string]::Format(
      'first requested={0}, agreeing={1}, mismatches={2}, agreement={3:P0}',
      ($Report.strategies[0].prescriptionConsensus.requestedStyles -join ','),
      ($Report.strategies[0].prescriptionConsensus.agreeingStyles -join ','),
      ($Report.strategies[0].prescriptionConsensus.mismatches -join ','),
      $Report.strategies[0].prescriptionConsensus.agreementRate
    )
  } else {
    'n/a'
  }
)

- Second prescription agreement: $(
  if ($null -ne $Report.strategies[1].prescriptionConsensus) {
    [string]::Format(
      'first requested={0}, agreeing={1}, mismatches={2}, agreement={3:P0}',
      ($Report.strategies[1].prescriptionConsensus.requestedStyles -join ','),
      ($Report.strategies[1].prescriptionConsensus.agreeingStyles -join ','),
      ($Report.strategies[1].prescriptionConsensus.mismatches -join ','),
      $Report.strategies[1].prescriptionConsensus.agreementRate
    )
  } else {
    'n/a'
  }
)

## Alerts

$($Report.evidence.alerts | ForEach-Object { "- $($_.code): $($_.message) ($($_.value) vs $($_.threshold))" } | Out-String)

"@
  return $summary
}

$firstCard = Invoke-Scorecard -ExamplePath $Examples[$First]
$secondCard = Invoke-Scorecard -ExamplePath $Examples[$Second]
$printToConsole = -not $OutputJson -and $OutputDir -eq ''

$styleDelta = Build-StyleDelta -FirstCard $firstCard -SecondCard $secondCard
$evaluationRows = Build-EvaluationDelta -FirstEvaluations $firstCard.evaluations -SecondEvaluations $secondCard.evaluations
$firstDimensions = Format-Dimensions -Evaluations $firstCard.evaluations
$secondDimensions = Format-Dimensions -Evaluations $secondCard.evaluations
$deathRows = Build-DeathDelta -FirstDeaths $firstCard.deaths -SecondDeaths $secondCard.deaths
$tradeoff = Build-TradeoffSummary -FirstCard $firstCard -SecondCard $secondCard
$firstPrescription = Build-PrescriptionSignature -Card $firstCard
$secondPrescription = Build-PrescriptionSignature -Card $secondCard
$prescriptionRows = Build-PrescriptionDelta -FirstCard $firstCard -SecondCard $secondCard
$firstRiskDashboard = Build-RiskDashboard -Card $firstCard
$secondRiskDashboard = Build-RiskDashboard -Card $secondCard
$styleAlerts = @($firstRiskDashboard.alerts + $secondRiskDashboard.alerts)
$evidenceWinners = Build-ConsensusWinners -StyleDelta $styleDelta -EvaluationDelta $evaluationRows -Tradeoff $tradeoff
$explainable = Build-ExplainableSummary -StyleDelta $styleDelta -EvaluationDelta $evaluationRows -Tradeoff $tradeoff
$decision = Build-MatchDecision -Tradeoff $tradeoff -FirstName $First -SecondName $Second

$report = [ordered]@{
  version = 'p1-evidence-v1'
  metadata = [ordered]@{
    generatedAt = (Get-Date).ToString('o')
    first = $First
    second = $Second
    seed = $Seed
    candidates = $Candidates
    scenarioSetId = $firstCard.scenarioSetId
    strategyIdsMatch = ($firstCard.strategyId -eq $secondCard.strategyId)
    scenarioSetMatch = ($firstCard.scenarioSetId -eq $secondCard.scenarioSetId)
  }
  strategies = @(
    [ordered]@{
      label = $First
      strategyId = $firstCard.strategyId
      scenarioSetId = $firstCard.scenarioSetId
      deaths = $firstCard.deaths.Count
      deathsByDimension = if ($null -ne $firstCard.deaths) {
        $firstCard.deaths | Group-Object -Property dimension | ForEach-Object { @{ dimension = $_.Name; count = $_.Count } }
  } else { @() }
      deathsList = $firstCard.deaths
      evaluations = $firstCard.evaluations
      prescriptions = $firstPrescription
      prescriptionConsensus = Build-PrescriptionConsensus -Card $firstCard
      tradeoff = $firstCard.tradeoff
      perStyle = $firstCard.perStyle
      riskDashboard = $firstRiskDashboard
    },
    [ordered]@{
      label = $Second
      strategyId = $secondCard.strategyId
      scenarioSetId = $secondCard.scenarioSetId
      deaths = $secondCard.deaths.Count
      deathsByDimension = if ($null -ne $secondCard.deaths) {
        $secondCard.deaths | Group-Object -Property dimension | ForEach-Object { @{ dimension = $_.Name; count = $_.Count } }
      } else { @() }
      deathsList = $secondCard.deaths
      evaluations = $secondCard.evaluations
      prescriptions = $secondPrescription
      prescriptionConsensus = Build-PrescriptionConsensus -Card $secondCard
      tradeoff = $secondCard.tradeoff
      perStyle = $secondCard.perStyle
      riskDashboard = $secondRiskDashboard
    }
  )
  deltas = [ordered]@{
    tradeoff = $tradeoff
    deaths = [ordered]@{
      totalFirst = $firstCard.deaths.Count
      totalSecond = $secondCard.deaths.Count
      totalDiff = $deathRows.totalDiff
      byDimension = $deathRows.byDimension
      firstByDimension = $deathRows.firstByDimension
      secondByDimension = $deathRows.secondByDimension
    }
    style = $styleDelta.rows
    styleWinnerTotals = $styleDelta.totals
    evaluations = $evaluationRows.rows
    evaluationWinnerTotals = $evaluationRows.totals
    prescriptions = $prescriptionRows.rows
    prescriptionChangedKeys = $prescriptionRows.changedKeys
  }
  evidence = [ordered]@{
    winners = [ordered]@{
      overall = $evidenceWinners.winner
      style = $styleDelta.totals
      dimension = $evaluationRows.totals
      tradeoff = $tradeoff.winner
    }
    explainableSummary = $explainable
    alerts = $styleAlerts | Where-Object { $null -ne $_ }
    overallWinner = $decision.winner
  }
  metadataSummary = [ordered]@{
    consoleDecision = $decision.winner
    consoleReasons = $decision.reasons
    styleScoreGap = $evidenceWinners.score
  }
}

$report.evidence.alerts = $report.evidence.alerts | Sort-Object code
$evidenceMarkdown = Render-EvidenceMarkdown -First $First -Second $Second -Report $report

if ($printToConsole) {
  Write-Host '=== Strategy Duel'
  Write-Host "Seed: $Seed, Candidates: $Candidates"
  Write-Host ''
  Write-Host "A) $First"
  Write-Host "  strategyId=$($firstCard.strategyId)"
  Write-Host "  scenarioSetId=$($firstCard.scenarioSetId)"
  Write-Host "  prescriptions=$($firstCard.prescription.changes | ConvertTo-Json -Compress)"
  Write-Host "  deaths=$($firstCard.deaths.Count)"
  Write-Host "  robustnessGain=$($firstCard.tradeoff.robustnessGain)"
  Write-Host "  returnCost=$($firstCard.tradeoff.returnCost)"
  Write-Host "  costEfficiency=$($firstRiskDashboard.costEfficiency)"
  Write-Host ''
  Write-Host "B) $Second"
  Write-Host "  strategyId=$($secondCard.strategyId)"
  Write-Host "  scenarioSetId=$($secondCard.scenarioSetId)"
  Write-Host "  prescriptions=$($secondCard.prescription.changes | ConvertTo-Json -Compress)"
  Write-Host "  deaths=$($secondCard.deaths.Count)"
  Write-Host "  robustnessGain=$($secondCard.tradeoff.robustnessGain)"
  Write-Host "  returnCost=$($secondCard.tradeoff.returnCost)"
  Write-Host "  costEfficiency=$($secondRiskDashboard.costEfficiency)"
  Write-Host ''

  Write-Host '--- Treatment-level comparison (per dimension) ---'
  for ($i = 0; $i -lt $firstDimensions.Length; $i++) {
    Write-Host ("{0,-24} {1}" -f "[$First][$($firstCard.evaluations[$i].dimension)]", $firstDimensions[$i])
    Write-Host ("{0,-24} {1}" -f "[$Second][$($secondCard.evaluations[$i].dimension)]", $secondDimensions[$i])
  }

  Write-Host ''
  Write-Host '--- Style score snapshot (A-B > 0 means A wins) ---'
  foreach ($row in $styleDelta.rows) {
    Write-Host (
      "{0,-12} {1,12} -> {2,12} (delta {3,12}) winner={4}" -f
      $row.style,
      $row.first,
      $row.second,
      $row.difference,
      $row.winner
    )
  }

  Write-Host '--- Deaths by scenario dimension ---'
  Write-Host ("A-only deaths: {0}" -f $deathRows.firstOnly.Count)
  Write-Host ("B-only deaths: {0}" -f $deathRows.secondOnly.Count)
  Write-Host ("A-B death count delta: {0}" -f $deathRows.totalDiff)

  Write-Host '--- Explainable summary ---'
  foreach ($line in $explainable) {
    Write-Host $line
  }
  Write-Host ("decision=$($decision.winner); reasons: {0}" -f ($decision.reasons -join ' | '))

  if ($firstCard.scenarioSetId -ne $secondCard.scenarioSetId) {
    Write-Warning "Scenario set mismatch: $($firstCard.scenarioSetId) vs $($secondCard.scenarioSetId)"
  } else {
    Write-Host "Shared scenario set confirmed: $($firstCard.scenarioSetId)"
  }
}

if ($printToConsole) {
  Write-Host "Style winners: A=$($styleDelta.totals.first), B=$($styleDelta.totals.second), tie=$($styleDelta.totals.tie)"
  Write-Host "Dimension winners: A=$($evaluationRows.totals.first), B=$($evaluationRows.totals.second), tie=$($evaluationRows.totals.tie)"
}

if ($OutputJson -or $OutputFile -or $OutputDir) {
  $json = $report | ConvertTo-Json -Depth 20

  if ($OutputDir) {
    if (-not (Test-Path -LiteralPath $OutputDir)) {
      New-Item -ItemType Directory -Path $OutputDir | Out-Null
    }
    $timeSlug = Get-Date -Format 'yyyyMMdd-HHmmss'
    $safeFirst = $First -replace '[^A-Za-z0-9_-]', '_'
    $safeSecond = $Second -replace '[^A-Za-z0-9_-]', '_'
    $stem = "{0}-vs-{1}-{2}" -f $safeFirst, $safeSecond, $timeSlug
    $jsonPath = Join-Path $OutputDir "$stem.evidence.json"
    $mdPath = Join-Path $OutputDir "$stem.evidence.md"
    Set-Content -Path $jsonPath -Value $json -Encoding utf8
    Set-Content -Path $mdPath -Value $evidenceMarkdown -Encoding utf8
    Write-Host "Evidence package written: $jsonPath"
    Write-Host "Evidence summary written: $mdPath"

    if ($Package) {
      $zipPath = Join-Path $OutputDir "$stem.zip"
      Compress-Archive -Path @($jsonPath, $mdPath) -DestinationPath $zipPath -Force
      Write-Host "Evidence zip written: $zipPath"
    }
  }

  if ($OutputFile) {
    Set-Content -Path $OutputFile -Value $json -Encoding utf8
    if ($printToConsole) {
      Write-Host "JSON report written to $OutputFile"
    }
  }
  if ($OutputJson) {
    Write-Output $json
  }
}

if ($printToConsole) {
  Write-Host ''
  Write-Host '=== Duel complete ==='
}
