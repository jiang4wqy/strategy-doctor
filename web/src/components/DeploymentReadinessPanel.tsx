import type { DiagnosisView } from '../api/types.ts';

export interface DeploymentReadinessPanelProps {
  deployment: DiagnosisView['deployment'];
}

export function DeploymentReadinessPanel({
  deployment,
}: DeploymentReadinessPanelProps) {
  return (
    <section
      className={`deployment-panel deployment-panel-${deployment.status}`}
      aria-label="Playbook readiness"
    >
      <div>
        <p className="eyebrow">Playbook readiness</p>
        <h2>{deployment.headline}</h2>
        <p>
          Deployment score <strong>{deployment.score}</strong>/100 - status{' '}
          <strong>{deployment.status}</strong>
        </p>
      </div>
      <div className="deployment-gates" aria-label="Deployment gates">
        {deployment.gates.map(gate => (
          <div key={gate.key}>
            <span aria-hidden="true">{gate.passed ? 'PASS' : 'REVIEW'}</span>
            <strong>{gate.label}</strong>
            <em>{gate.value}</em>
          </div>
        ))}
      </div>
      {deployment.blockers.length > 0 ? (
        <ul className="deployment-blockers" aria-label="Deployment blockers">
          {deployment.blockers.map(blocker => (
            <li key={blocker}>{blocker}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
