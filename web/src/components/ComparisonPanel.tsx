import type {
  ComparisonBaseline,
} from '../state/app-state.ts';
import type {
  DiagnoseRequest,
  DiagnosisView,
} from '../api/types.ts';

export interface ComparisonPanelProps {
  baseline: ComparisonBaseline;
  request: DiagnoseRequest;
  view: DiagnosisView;
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function signed(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`;
}

function signedPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${percent(value)}`;
}

export function ComparisonPanel({
  baseline,
  request,
  view,
}: ComparisonPanelProps) {
  const rows = [
    {
      label: 'Risk score',
      before: String(baseline.view.summary.riskScore),
      after: String(view.summary.riskScore),
      delta: signed(view.summary.riskScore - baseline.view.summary.riskScore),
    },
    {
      label: 'Worst drawdown',
      before: percent(baseline.view.summary.worstDrawdownPct),
      after: percent(view.summary.worstDrawdownPct),
      delta: signedPercent(
        view.summary.worstDrawdownPct
          - baseline.view.summary.worstDrawdownPct,
      ),
    },
    {
      label: 'Total trades',
      before: String(baseline.view.summary.totalTrades),
      after: String(view.summary.totalTrades),
      delta: signed(view.summary.totalTrades - baseline.view.summary.totalTrades),
    },
    {
      label: 'Robustness gain',
      before: String(baseline.view.summary.robustnessGain),
      after: String(view.summary.robustnessGain),
      delta: signed(
        view.summary.robustnessGain - baseline.view.summary.robustnessGain,
      ),
    },
    {
      label: 'Return delta',
      before: percent(baseline.view.summary.returnDelta),
      after: percent(view.summary.returnDelta),
      delta: signedPercent(
        view.summary.returnDelta - baseline.view.summary.returnDelta,
      ),
    },
  ];

  return (
    <section className="comparison-panel" aria-labelledby="comparison-title">
      <div>
        <p className="eyebrow">Before / after audit</p>
        <h2 id="comparison-title">Compared with original diagnosis</h2>
        <p>
          Baseline:
          {' '}
          <strong>{baseline.request.strategy.name}</strong>
          {' '}
          vs current:
          {' '}
          <strong>{request.strategy.name}</strong>
        </p>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              <th>{baseline.label}</th>
              <th>Current run</th>
              <th>Delta</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.label}>
                <td>{row.label}</td>
                <td>{row.before}</td>
                <td>{row.after}</td>
                <td>{row.delta}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
