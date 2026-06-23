const reproductionCommands = [
  'scripts\\verify-project.cmd',
  'scripts\\build-submission-pack.cmd',
  'scripts\\start-showcase.cmd',
];

const scorecards = [
  ['Strategies', '2 registered', 'MA crossover and RSI/Bollinger adapters'],
  ['Risk lens', '5 dimensions', 'trend, chop, crash, spread, liquidity'],
  ['Evidence', '256+ tests', 'core, web, API, accessibility, e2e'],
  ['Coverage', '90%+ lines', 'guarded by the verification script'],
];

const workflow = [
  {
    title: 'Natural language to strategy',
    text:
      'A trader describes an idea, the parser creates a typed strategy draft, and consensus metadata records model agreement.',
  },
  {
    title: 'Adversarial diagnosis',
    text:
      'The engine attacks the strategy across deterministic market regimes, records deaths, survivors, and held-out trade-offs.',
  },
  {
    title: 'Targeted prescription',
    text:
      'Adapter-owned mutation policies propose bounded parameter repairs instead of generic random search.',
  },
  {
    title: 'Playbook bridge',
    text:
      'Bitget Playbook exports or prompts can be imported into the same diagnosis API before deployment decisions.',
  },
];

export function JudgeMode() {
  return (
    <main className="judge-shell">
      <section className="judge-hero" aria-labelledby="judge-title">
        <div>
          <p className="eyebrow">Bitget AI Hackathon judge mode</p>
          <h1 id="judge-title">Strategy Doctor</h1>
          <p className="judge-lede">
            An AI trading-infra copilot that turns strategy ideas into typed
            strategies, stress-tests them against deterministic failure modes,
            and produces auditable risk repairs before Playbook deployment.
          </p>
        </div>
        <div className="judge-actions" aria-label="Demo actions">
          <a href="/showcase">Open private workspace</a>
          <a href="/api/v1/health">Check API health</a>
        </div>
      </section>

      <section className="judge-scoreboard" aria-label="Competition evidence">
        {scorecards.map(([label, value, caption]) => (
          <article key={label} className="judge-metric">
            <span>{label}</span>
            <strong>{value}</strong>
            <p>{caption}</p>
          </article>
        ))}
      </section>

      <section className="judge-grid" aria-label="System workflow">
        {workflow.map(item => (
          <article key={item.title} className="judge-panel">
            <h2>{item.title}</h2>
            <p>{item.text}</p>
          </article>
        ))}
      </section>

      <section className="judge-band" aria-labelledby="playbook-title">
        <div>
          <p className="eyebrow">Playbook-ready infrastructure</p>
          <h2 id="playbook-title">Import, diagnose, then publish with evidence</h2>
          <p>
            The new Playbook bridge accepts exported strategy JSON or a
            Playbook strategy prompt, maps it into the registered Strategy
            Doctor contracts, and returns the same diagnosis view used by the
            web app and MCP tools. API keys stay outside the repository.
          </p>
        </div>
        <pre aria-label="Playbook bridge endpoint">{`POST /api/v1/playbook/diagnoses
Authorization: Bearer <preview-or-agent-key>
{
  "playbook": {
    "playbookId": "agent-101",
    "prompt": "BTC trend-following with defensive risk controls"
  },
  "style": "trend",
  "seed": 42,
  "candidates": 6
}`}</pre>
      </section>

      <section className="judge-band" aria-labelledby="reproduce-title">
        <div>
          <p className="eyebrow">Evaluator handoff</p>
          <h2 id="reproduce-title">Reproduce the submission locally</h2>
          <p>
            These commands rebuild the app, run the verification suite, produce
            the submission evidence pack, and launch the showcase server.
          </p>
        </div>
        <div className="judge-command-list">
          {reproductionCommands.map(command => (
            <code key={command}>{command}</code>
          ))}
        </div>
      </section>
    </main>
  );
}
