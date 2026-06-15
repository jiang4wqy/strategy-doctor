import type { DiagnosisView } from '../api/types.ts';

export interface ScenarioTableProps {
  evaluations: DiagnosisView['scorecard']['evaluations'];
}

export function ScenarioTable({ evaluations }: ScenarioTableProps) {
  return (
    <section className="scenario-section" aria-labelledby="scenario-title">
      <div className="section-heading">
        <p className="eyebrow">Five-dimensional pressure coverage</p>
        <h2 id="scenario-title">Scenario evidence</h2>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Dimension</th>
              <th>Scenario</th>
              <th>Damage</th>
              <th>PnL</th>
              <th>Drawdown</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {evaluations.map(evaluation => (
              <tr key={evaluation.scenarioId} data-testid="scenario-row">
                <td>{evaluation.dimension}</td>
                <td>{evaluation.scenarioName}</td>
                <td>{evaluation.damageScore.toFixed(1)}</td>
                <td>{(evaluation.metrics.pnlPct * 100).toFixed(1)}%</td>
                <td>
                  {(evaluation.metrics.maxDrawdownPct * 100).toFixed(1)}%
                </td>
                <td>{evaluation.cause}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
