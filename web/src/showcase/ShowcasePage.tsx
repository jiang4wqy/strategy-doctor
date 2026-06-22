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
  atr: 'ATR trend breakout',
} as const;

const judgeHighlights = [
  ['Positioning', 'Playbook pre-publication risk auditor'],
  ['Strategies', 'MA, RSI/Bollinger, breakout, ATR breakout'],
  ['Usage record', '8 REST calls + 4 reproducible diagnoses'],
  ['Safety', 'No account access, no order execution'],
] as const;

const evidenceSteps = [
  ['1', 'Public demo', '/showcase needs no reviewer login'],
  ['2', 'API proof', 'api:check verifies health, capabilities, OpenAPI'],
  ['3', 'Usage record', 'submission:usage-record writes request IDs and latency'],
  ['4', 'Artifacts', 'Four request, scorecard, and diagnosis-view bundles'],
] as const;

function percent(value: number) {
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%`;
}

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
            A no-login evidence view for Track 2 infrastructure: generated
            strategies are treated as deployment candidates, attacked across
            five market dimensions, repaired with bounded parameter changes,
            and exposed through Web, REST, MCP, and reproducible artifacts.
          </p>
          <div className="showcase-actions" aria-label="Reviewer actions">
            <a href="#strategy-comparison">Compare strategies</a>
            <a href="#submission-evidence">Review evidence</a>
            <a href="/">Open workspace</a>
          </div>
        </div>
        <dl className="showcase-proof">
          <div>
            <dt>Verify</dt>
            <dd>269 passed / 2 skipped</dd>
          </div>
          <div>
            <dt>Coverage</dt>
            <dd>96.58% lines</dd>
          </div>
          <div>
            <dt>Mode</dt>
            <dd>Offline MockBacktester</dd>
          </div>
        </dl>
      </header>

      <section
        className="submission-evidence"
        id="submission-evidence"
        aria-label="Submission evidence chain"
      >
        <div>
          <p className="eyebrow">Submission evidence</p>
          <h2>From public demo to reproducible API calls</h2>
          <p>
            This page is intentionally read-only. The protected workspace is for
            live diagnosis; this showcase gives judges a stable path to inspect
            the product and verify the same workflow from the terminal.
          </p>
        </div>
        <ol>
          {evidenceSteps.map(([index, title, detail]) => (
            <li key={title}>
              <span>{index}</span>
              <strong>{title}</strong>
              <small>{detail}</small>
            </li>
          ))}
        </ol>
      </section>

      <section className="judge-summary" aria-label="Judge summary">
        <div className="judge-pitch">
          <p className="eyebrow">Judge summary</p>
          <h2>Audit before Playbook publication</h2>
          <p>
            Strategy Doctor turns strategy ideas into reproducible risk
            contracts. Each adapter owns its signal logic and repair policy,
            while the shared engine reports failures, held-out trade-offs, and
            deployment readiness for Agent and API users.
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

      <section
        className="strategy-comparison"
        id="strategy-comparison"
        aria-label="Strategy comparison"
      >
        <div className="comparison-heading">
          <p className="eyebrow">Strategy comparison</p>
          <h2>Four archetypes, one risk contract</h2>
        </div>
        {showcaseDiagnoses.map(item => (
          <article
            className={`strategy-card strategy-card-${item.view.deployment.status}`}
            key={item.id}
          >
            <span>{labels[item.id as keyof typeof labels]}</span>
            <strong className="status-pill">
              {item.view.deployment.status}
            </strong>
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
              <div>
                <dt>Return</dt>
                <dd>{percent(item.view.summary.returnDelta)}</dd>
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
