import type {
  DiagnoseRequest,
  DiagnosisView,
} from '../api/types.ts';

export interface RepairComparisonPanelProps {
  request: DiagnoseRequest;
  view: DiagnosisView;
}

function formatValue(value: number): string {
  if (Math.abs(value) < 1) {
    return Number(value.toFixed(4)).toString();
  }
  return Number(value.toFixed(2)).toString();
}

export function RepairComparisonPanel({
  request,
  view,
}: RepairComparisonPanelProps) {
  const before = request.strategy.params as unknown as Record<string, number>;
  const after = view.scorecard.prescription.patchedStrategy
    .params as unknown as Record<string, number>;
  const labelByKey = new Map<string, string>(
    view.charts.parameterChanges.map(change => [change.key, change.label]),
  );
  const changedKeys = Object.keys(before).filter(key => before[key] !== after[key]);

  return (
    <section
      className="repair-comparison-panel"
      aria-label="Before and after repair comparison"
    >
      <div>
        <p className="eyebrow">Before / after repair</p>
        <h2>Risk repair delta</h2>
        <p>
          The prescription changes only adapter-owned parameters, then reports
          held-out robustness and return cost without hiding the trade-off.
        </p>
      </div>
      <div className="repair-table-wrap">
        {changedKeys.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Parameter</th>
                <th>Before</th>
                <th>After</th>
              </tr>
            </thead>
            <tbody>
              {changedKeys.map(key => (
                <tr key={key}>
                  <td>{labelByKey.get(key) ?? key}</td>
                  <td>{formatValue(before[key])}</td>
                  <td>{formatValue(after[key])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="honesty-note">
            No parameter change was recommended for this run.
          </p>
        )}
      </div>
      <p className="repair-rationale">
        {view.scorecard.prescription.rationale}
      </p>
    </section>
  );
}
