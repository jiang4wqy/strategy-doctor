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
