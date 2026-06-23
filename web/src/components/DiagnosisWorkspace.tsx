import type {
  DiagnoseRequest,
  DiagnosisView,
} from '../api/types.ts';
import type { ComparisonBaseline } from '../state/app-state.ts';
import { EquityComparisonChart } from '../charts/EquityComparisonChart.tsx';
import { DrawdownCurveChart } from '../charts/DrawdownCurveChart.tsx';
import { ExecutionQualityChart } from '../charts/ExecutionQualityChart.tsx';
import { ParameterChangeChart } from '../charts/ParameterChangeChart.tsx';
import { RiskRadarChart } from '../charts/RiskRadarChart.tsx';
import { ScenarioTimelineChart } from '../charts/ScenarioTimelineChart.tsx';
import {
  downloadText,
  exportDiagnosisJson,
  exportRiskDashboardJson,
  renderDiagnosisMarkdown,
  renderRiskDashboardMarkdown,
} from '../export/report.ts';
import { DeveloperPanel } from './DeveloperPanel.tsx';
import { ComparisonPanel } from './ComparisonPanel.tsx';
import { ScenarioTable } from './ScenarioTable.tsx';
import { SummaryCards } from './SummaryCards.tsx';

export interface DiagnosisWorkspaceProps {
  request: DiagnoseRequest;
  requestId: string;
  view: DiagnosisView;
  baseline?: ComparisonBaseline;
  onEditParameters?(): void;
}

export function DiagnosisWorkspace({
  request,
  requestId,
  view,
  baseline,
  onEditParameters,
}: DiagnosisWorkspaceProps) {
  const filename = `strategy-doctor-${request.strategy.id}`;
  const hasDashboard = Boolean(view.riskDashboard);
  return (
    <div className="diagnosis-workspace">
      <header className="workspace-header">
        <div>
          <p className="eyebrow">03 / Adversarial diagnosis</p>
          <h1>{request.strategy.name}</h1>
          <p>
            Treatment failures, targeted repair, and independent held-out
            validation from one deterministic run.
          </p>
        </div>
        <div className="export-actions">
          {onEditParameters ? (
            <button type="button" onClick={onEditParameters}>
              Edit parameters
            </button>
          ) : null}
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
          {hasDashboard ? (
            <>
              <button
                type="button"
                onClick={() => downloadText(
                  `${filename}-risk-dashboard.json`,
                  exportRiskDashboardJson(request, view),
                  'application/json',
                )}
              >
                Export Risk Dashboard JSON
              </button>
              <button
                type="button"
                onClick={() => downloadText(
                  `${filename}-risk-dashboard.md`,
                  renderRiskDashboardMarkdown(request, view),
                  'text/markdown',
                )}
              >
                Export Risk Dashboard Markdown
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={() => downloadText(
              `${filename}-decision-snapshot.md`,
              renderRiskDashboardMarkdown(request, view),
              'text/markdown',
            )}
          >
            Export Decision Snapshot
          </button>
        </div>
      </header>

      <SummaryCards summary={view.summary} />
      {baseline ? (
        <ComparisonPanel
          baseline={baseline}
          request={request}
          view={view}
        />
      ) : null}
      {view.riskDashboard ? (
        <section className="risk-dashboard-panel" aria-labelledby="risk-dashboard-title">
          <p className="eyebrow">Risk dashboard</p>
          <h2 id="risk-dashboard-title">Risk-control signals</h2>
          <div className="risk-dashboard-grid">
            <div className="risk-dashboard-card">
              <span>Trend score</span>
              <strong>{view.riskDashboard.trendScore.toFixed(2)}</strong>
            </div>
            <div className="risk-dashboard-card">
              <span>Defense score</span>
              <strong>{view.riskDashboard.defenseScore.toFixed(2)}</strong>
            </div>
            <div className="risk-dashboard-card">
              <span>Trend/defense gap</span>
              <strong>{view.riskDashboard.trendDefenseGap.toFixed(2)}</strong>
            </div>
            <div className="risk-dashboard-card">
              <span>Cost efficiency</span>
              <strong>{view.riskDashboard.costEfficiency.toFixed(4)}</strong>
            </div>
          </div>
          <ul>
            {view.riskDashboard.alerts.length > 0 ? (
              view.riskDashboard.alerts.map(alert => (
                <li key={alert.code}>
                  <span className={`severity-${alert.severity}`}>
                    {alert.severity.toUpperCase()}
                  </span>
                  {' '}
                  {alert.code}: {alert.message}
                  {' '}
                  ({alert.value.toFixed(4)} vs {alert.threshold})
                </li>
              ))
            ) : (
              <li>All risk-control thresholds passed.</li>
            )}
          </ul>
          {view.modelConsistency ? (
            <div className="model-consistency-grid">
              <h3>Model consensus</h3>
              <p>
                Prescription agreement:
                {' '}
                {view.modelConsistency.prescription
                  ? `${(view.modelConsistency.prescription.agreementRate * 100).toFixed(2)}%`
                  : 'n/a'}
                {' '}
                (requested styles:
                {' '}
                {view.modelConsistency.prescription?.requestedStyles.join('/')}
                )
              </p>
              <p>
                Narration agreement:
                {' '}
                {view.modelConsistency.narration
                  ? `${(view.modelConsistency.narration.agreementRate * 100).toFixed(2)}%`
                  : 'n/a'}
                {' '}(similarity=
                {view.modelConsistency.narration
                  ? `${view.modelConsistency.narration.avgSimilarity.toFixed(3)}`
                  : 'n/a'})
              </p>
            </div>
          ) : null}
        </section>
      ) : null}
      {view.strategyReview ? (
        <section className="risk-dashboard-panel" aria-labelledby="strategy-review-title">
          <p className="eyebrow">Open-source model review</p>
          <h2 id="strategy-review-title">Strategy reviewer</h2>
          <div className="risk-dashboard-grid">
            <div className="risk-dashboard-card">
              <span>Reviewer</span>
              <strong>{view.strategyReview.reviewer}</strong>
            </div>
            <div className="risk-dashboard-card">
              <span>Mode</span>
              <strong>{view.strategyReview.mode}</strong>
            </div>
            <div className="risk-dashboard-card">
              <span>Review score</span>
              <strong>{view.strategyReview.score}</strong>
            </div>
            <div className="risk-dashboard-card">
              <span>Agreement</span>
              <strong>
                {(view.strategyReview.agreementRate * 100).toFixed(1)}%
              </strong>
            </div>
          </div>
          <p>{view.strategyReview.summary}</p>
          <div className="model-consistency-grid">
            <h3>Objections</h3>
            <ul>
              {view.strategyReview.objections.length > 0
                ? view.strategyReview.objections.map(item => (
                  <li key={item}>{item}</li>
                ))
                : <li>No blocking objections.</li>}
            </ul>
            <h3>Recommendations</h3>
            <ul>
              {view.strategyReview.recommendations.map(item => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

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
        <DrawdownCurveChart charts={view.charts} />
        <ExecutionQualityChart items={view.charts.executionQuality} />
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
