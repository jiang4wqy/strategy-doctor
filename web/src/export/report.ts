import type {
  DiagnoseRequest,
  DiagnosisView,
} from '../api/types.ts';

export function exportDiagnosisJson(
  request: DiagnoseRequest,
  view: DiagnosisView,
): string {
  return JSON.stringify({ request, view }, null, 2);
}

export function renderDiagnosisMarkdown(
  request: DiagnoseRequest,
  view: DiagnosisView,
): string {
  const evaluations = view.scorecard.evaluations
    .map(evaluation => (
      `- **${evaluation.dimension}**: ${evaluation.scenarioName}; `
      + `damage ${evaluation.damageScore.toFixed(1)}, `
      + `drawdown ${(evaluation.metrics.maxDrawdownPct * 100).toFixed(1)}%, `
      + `result ${evaluation.cause}`
    ))
    .join('\n');
  return `# Strategy Doctor diagnosis: ${request.strategy.name}

## Summary

- Risk score: ${view.summary.riskScore}
- Worst drawdown: ${(view.summary.worstDrawdownPct * 100).toFixed(1)}%
- Total trades: ${view.summary.totalTrades}
- Robustness gain: ${view.summary.robustnessGain}
- Return delta: ${(view.summary.returnDelta * 100).toFixed(2)}%

## Five-dimension scenarios

${evaluations}

## Prescription

${view.scorecard.prescription.rationale}

## Held-out trade-off

Robustness changed by ${view.scorecard.tradeoff.robustnessGain}; average return
changed by ${(view.scorecard.tradeoff.returnCost * 100).toFixed(2)}%.

This diagnostic does not guarantee improvement or future returns.
`;
}

function dashboardOverview(view: DiagnosisView): string {
  const dashboard = view.riskDashboard;
  if (!dashboard) {
    return '';
  }
  const alerts = dashboard.alerts.length > 0
    ? dashboard.alerts
      .map(alert => `- ${alert.code}: ${alert.message} (${alert.value.toFixed(4)} vs ${alert.threshold}) [${alert.severity}]`)
      .join('\n')
    : '- No critical warnings.';
  return `

## Risk dashboard

Trend score: ${dashboard.trendScore}
Defense score: ${dashboard.defenseScore}
Trend/defense gap: ${dashboard.trendDefenseGap.toFixed(2)}
Cost efficiency: ${dashboard.costEfficiency.toFixed(4)}
Trend threshold: ${dashboard.trendThreshold}
Defense threshold: ${dashboard.defenseThreshold}
Cost-efficiency threshold: ${dashboard.costEfficiencyThreshold}

### Anomalies
${alerts}
`;
}

function formatModelConsistency(view: DiagnosisView): string {
  if (!view.modelConsistency) {
    return '- No model-consensus metrics were captured.';
  }

  const lines: string[] = [];
  if (view.modelConsistency.prescription) {
    lines.push(
      `Prescription consensus: agreement=${(
        view.modelConsistency.prescription.agreementRate * 100
      ).toFixed(2)}%, requested=${view.modelConsistency.prescription.requestedStyles.join(',')}, ` +
      `agreeing=${view.modelConsistency.prescription.agreeingStyles.join(',')}`,
    );
  }
  if (view.modelConsistency.narration) {
    lines.push(
      `Narration consensus: agreement=${(
        view.modelConsistency.narration.agreementRate * 100
      ).toFixed(2)}%, avg similarity=${(
        view.modelConsistency.narration.avgSimilarity
      ).toFixed(3)}, samples=${view.modelConsistency.narration.sampleCount}`,
    );
  }

  return lines.join('\n');
}

function fiveDimensionRows(view: DiagnosisView): string {
  return view.scorecard.evaluations
    .map(evaluation => (
      `- ${evaluation.dimension}: pnl ${(evaluation.metrics.pnlPct * 100).toFixed(2)}%, ` +
      `maxDD ${(evaluation.metrics.maxDrawdownPct * 100).toFixed(2)}%, ` +
      `damageScore ${evaluation.damageScore.toFixed(4)}, ` +
      `cause ${evaluation.cause}`
    ))
    .join('\n');
}

function perStyleRows(view: DiagnosisView): string {
  return Object.entries(view.scorecard.perStyle)
    .map(([style, row]) => (
      `- ${style}: score=${row.riskScore}, survived=${row.survived}, ` +
      `worstDD ${(row.worstDrawdownPct * 100).toFixed(2)}%, ` +
      `meanPnL ${(row.meanPnlPct * 100).toFixed(2)}%`
    ))
    .join('\n');
}

export function renderRiskDashboardMarkdown(
  request: DiagnoseRequest,
  view: DiagnosisView,
): string {
  return `# Risk dashboard export: ${request.strategy.name}

${dashboardOverview(view).trim()}

## Five-dimension scenarios

${fiveDimensionRows(view)}

## Per-style scores

${perStyleRows(view)}

## Model-consistency health

${formatModelConsistency(view)}
`;
}

export function exportRiskDashboardJson(
  request: DiagnoseRequest,
  view: DiagnosisView,
): string {
  return JSON.stringify({
    request,
    modelConsistency: view.modelConsistency,
    riskDashboard: view.riskDashboard,
    prescription: view.scorecard.prescription,
    tradeoff: view.scorecard.tradeoff,
    perStyle: view.scorecard.perStyle,
    fiveDimension: view.scorecard.evaluations.map(evaluation => ({
      dimension: evaluation.dimension,
      scenarioId: evaluation.scenarioId,
      scenarioName: evaluation.scenarioName,
      pnlPct: evaluation.metrics.pnlPct,
      maxDrawdownPct: evaluation.metrics.maxDrawdownPct,
      damageScore: evaluation.damageScore,
      cause: evaluation.cause,
      survived: evaluation.cause === 'survived',
      narrative: evaluation.narrative,
    })),
  }, null, 2);
}

export function downloadText(
  filename: string,
  content: string,
  type: string,
): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
