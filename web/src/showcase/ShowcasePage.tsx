import {
  lazy,
  Suspense,
  useMemo,
  useState,
} from 'react';
import { showcaseDiagnoses } from './showcase-data.ts';

const DiagnosisWorkspace = lazy(async () => {
  const module = await import('../components/DiagnosisWorkspace.tsx');
  return { default: module.DiagnosisWorkspace };
});

const labels = {
  ma: 'MA trend follower',
  rsi: 'RSI/Bollinger mean reversion',
  breakout: 'Confirmed breakout',
} as const;

const judgeHighlights = [
  ['Positioning', 'Playbook pre-publication risk auditor'],
  ['Strategies', 'MA, RSI/Bollinger, confirmed breakout'],
  ['Evidence', 'API logs, scorecards, Playbook package'],
  ['Safety', 'No account access, no order execution'],
] as const;

export function ShowcasePage() {
  const [selectedId, setSelectedId] = useState(showcaseDiagnoses[0].id);
  const selected = useMemo(
    () => showcaseDiagnoses.find(item => item.id === selectedId)
      ?? showcaseDiagnoses[0],
    [selectedId],
  );

  return (
    <main className="app-shell showcase-page">
      <header className="showcase-hero">
        <div>
          <p className="eyebrow">Bitget AI Hackathon · Track 2 Trading Infra</p>
          <h1>Strategy Doctor public showcase</h1>
          <p>
            A read-only, no-login evidence view for the submitted strategy
            diagnosis workflow. The protected Web/API workspace remains
            available at the root path.
          </p>
        </div>
        <dl className="showcase-proof">
          <div>
            <dt>Verify</dt>
            <dd>243 passed / 1 skipped</dd>
          </div>
          <div>
            <dt>Coverage</dt>
            <dd>96.38% lines</dd>
          </div>
          <div>
            <dt>Mode</dt>
            <dd>Offline MockBacktester</dd>
          </div>
        </dl>
      </header>

      <section className="judge-summary" aria-label="Judge summary">
        <div className="judge-pitch">
          <p className="eyebrow">Judge summary</p>
          <h2>Audit before Playbook publication</h2>
          <p>
            Strategy Doctor diagnoses how a trading strategy fails under five
            market stress dimensions, applies adapter-scoped repairs, validates
            held-out trade-offs, and reports whether the strategy is ready for
            Bitget Playbook sandbox publication.
          </p>
        </div>
        <div className="judge-grid">
          {judgeHighlights.map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="strategy-comparison" aria-label="Strategy comparison">
        <div className="comparison-heading">
          <p className="eyebrow">Strategy comparison</p>
          <h2>Three archetypes, one risk contract</h2>
        </div>
        {showcaseDiagnoses.map(item => (
          <article key={item.id}>
            <span>{labels[item.id as keyof typeof labels]}</span>
            <strong>{item.view.deployment.status}</strong>
            <dl>
              <div>
                <dt>Risk</dt>
                <dd>{item.view.summary.riskScore}</dd>
              </div>
              <div>
                <dt>Drawdown</dt>
                <dd>{(item.view.summary.worstDrawdownPct * 100).toFixed(1)}%</dd>
              </div>
              <div>
                <dt>Ready</dt>
                <dd>{item.view.deployment.score}/100</dd>
              </div>
            </dl>
          </article>
        ))}
      </section>

      <section className="showcase-switcher" aria-label="Published examples">
        {showcaseDiagnoses.map(item => (
          <button
            aria-pressed={item.id === selected.id}
            key={item.id}
            onClick={() => setSelectedId(item.id)}
            type="button"
          >
            {labels[item.id as keyof typeof labels]}
          </button>
        ))}
        <a href="/">Open protected workspace</a>
      </section>

      <Suspense fallback={<p aria-live="polite">Loading visual analysis...</p>}>
        <DiagnosisWorkspace
          request={selected.request}
          requestId={selected.requestId}
          view={selected.view}
        />
      </Suspense>
    </main>
  );
}
