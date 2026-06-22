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
import {
  DeploymentReadinessPanel,
} from './DeploymentReadinessPanel.tsx';
import { DeveloperPanel } from './DeveloperPanel.tsx';
import { DiagnosisHero } from './DiagnosisHero.tsx';
import { RepairComparisonPanel } from './RepairComparisonPanel.tsx';
import { ScenarioTable } from './ScenarioTable.tsx';
import { SummaryCards } from './SummaryCards.tsx';

export interface DiagnosisWorkspaceProps {
  request: DiagnoseRequest;
  requestId: string;
  view: DiagnosisView;
}

export function DiagnosisWorkspace({
  request,
  requestId,
  view,
}: DiagnosisWorkspaceProps) {
  const filename = `strategy-doctor-${request.strategy.id}`;
  return (
    <div className="diagnosis-workspace">
      <header className="workspace-header">
        <div>
          <p className="eyebrow">03 · Adversarial diagnosis</p>
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

      <DiagnosisHero view={view} />

      <SummaryCards summary={view.summary} />
      <DeploymentReadinessPanel deployment={view.deployment} />
      <RepairComparisonPanel request={request} view={view} />

      <section className="stress-strip" aria-label="Five-dimension stress trace">
        {view.charts.riskRadar.map(risk => (
          <div key={risk.dimension}>
            <span>{risk.dimension}</span>
            <strong>{risk.value}</strong>
          </div>
        ))}
      </section>

      <section
        className="chart-explainer"
        aria-label="How to read diagnosis charts"
      >
        <p className="eyebrow">Reading the evidence</p>
        <h2>What the charts prove</h2>
        <p>
          The charts separate repair quality from backtest luck: they show
          unseen held-out behavior, which market dimension caused the damage,
          and exactly which parameters changed.
        </p>
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
