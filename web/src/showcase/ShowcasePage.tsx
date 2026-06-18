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
