import type {
  DiagnoseRequest,
  DiagnosisView,
} from '../api/types.ts';
import { EquityComparisonChart } from '../charts/EquityComparisonChart.tsx';
import { ParameterChangeChart } from '../charts/ParameterChangeChart.tsx';
import { RiskRadarChart } from '../charts/RiskRadarChart.tsx';
import { ScenarioTimelineChart } from '../charts/ScenarioTimelineChart.tsx';
import {
  downloadText,
  exportDiagnosisJson,
  renderDiagnosisMarkdown,
} from '../export/report.ts';
import { DeploymentReadinessPanel } from './DeploymentReadinessPanel.tsx';
import { DeveloperPanel } from './DeveloperPanel.tsx';
import { ScenarioTable } from './ScenarioTable.tsx';
import { SummaryCards } from './SummaryCards.tsx';

export interface DiagnosisWorkspaceProps {
  request: DiagnoseRequest;
  requestId: string;
  view: DiagnosisView;
  comparison?: {
    request: DiagnoseRequest;
    requestId: string;
    view: DiagnosisView;
  };
  onReconfigure: () => void;
  onCompare: () => void;
  onNewStrategy: () => void;
}

export function DiagnosisWorkspace({
  request,
  requestId,
  view,
  comparison,
  onCompare,
  onReconfigure,
  onNewStrategy,
}: DiagnosisWorkspaceProps) {
  const filename = `strategy-doctor-${request.strategy.id}`;
  const riskDelta = comparison
    ? view.summary.riskScore - comparison.view.summary.riskScore
    : 0;
  const returnDelta = comparison
    ? view.summary.returnDelta - comparison.view.summary.returnDelta
    : 0;
  const drawdownDelta = comparison
    ? view.summary.worstDrawdownPct - comparison.view.summary.worstDrawdownPct
    : 0;
  return (
    <div className="diagnosis-workspace">
      <header className="workspace-header">
        <div>
          <div className="workspace-actions">
            <button type="button" onClick={onReconfigure}>
              Edit parameters
            </button>
            <button type="button" onClick={onCompare}>
              Compare tuned run
            </button>
            <button type="button" onClick={onNewStrategy}>
              New strategy
            </button>
            <a href="/tutorial">Open tutorial</a>
          </div>
          <p className="eyebrow">03 - Adversarial diagnosis</p>
          <h1>{request.strategy.name}</h1>
          <p>
            Treatment failures, targeted repair, and independent held-out
            validation from one deterministic run.
          </p>
        </div>
        <div className="export-actions">
          <button
            type="button"
            onClick={() => downloadText(
              `${filename}.json`,
              exportDiagnosisJson(request, view),
              'application/json',
            )}
          >
            Export JSON
          </button>
          <button
            type="button"
            onClick={() => downloadText(
              `${filename}.md`,
              renderDiagnosisMarkdown(request, view),
              'text/markdown',
            )}
          >
            Export Markdown
          </button>
        </div>
      </header>

      <SummaryCards summary={view.summary} />

      {comparison ? (
        <section className="comparison-panel" aria-label="Baseline comparison">
          <div>
            <p className="eyebrow">Baseline comparison</p>
            <h2>Current run vs {comparison.requestId}</h2>
            <p>
              Compare mode keeps the previous diagnosis as an audit baseline
              while you tune parameters and rerun the same strategy.
            </p>
          </div>
          <dl>
            <div>
              <dt>Risk score</dt>
              <dd>{riskDelta >= 0 ? '+' : ''}{riskDelta}</dd>
            </div>
            <div>
              <dt>Return delta</dt>
              <dd>
                {returnDelta >= 0 ? '+' : ''}
                {(returnDelta * 100).toFixed(1)}%
              </dd>
            </div>
            <div>
              <dt>Drawdown</dt>
              <dd>
                {drawdownDelta >= 0 ? '+' : ''}
                {(drawdownDelta * 100).toFixed(1)}%
              </dd>
            </div>
          </dl>
        </section>
      ) : null}

      <DeploymentReadinessPanel deployment={view.deployment} />

      <section className="stress-strip" aria-label="Five-dimension stress trace">
        {view.charts.riskRadar.map(risk => (
          <div key={risk.dimension}>
            <span>{risk.dimension}</span>
            <strong>{risk.value}</strong>
          </div>
        ))}
      </section>

      <section className="chart-grid" aria-label="Diagnosis charts">
        <EquityComparisonChart charts={view.charts} />
        <RiskRadarChart risks={view.charts.riskRadar} />
        <ScenarioTimelineChart items={view.charts.scenarioTimeline} />
        <ParameterChangeChart changes={view.charts.parameterChanges} />
      </section>

      <ScenarioTable evaluations={view.scorecard.evaluations} />

      <section className="prescription-panel" aria-labelledby="repair-title">
        <p className="eyebrow">Targeted repair</p>
        <h2 id="repair-title">Prescription rationale</h2>
        <p>{view.scorecard.prescription.rationale}</p>
        <p className="honesty-note">
          Held-out return delta is reported as-is. This result is diagnostic,
          not a guarantee of future improvement.
        </p>
      </section>

      <DeveloperPanel request={request} requestId={requestId} />
    </div>
  );
}
