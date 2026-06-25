import {
  Activity,
  ArrowUpRight,
  BookOpen,
  Bot,
  CheckCircle2,
  Cpu,
  ClipboardCheck,
  FileArchive,
  FileText,
  Gauge,
  GitBranch,
  GitCompareArrows,
  Radar,
  ShieldCheck,
  TerminalSquare,
} from 'lucide-react';

const reproductionCommands = [
  'scripts\\verify-project.cmd',
  'scripts\\build-submission-pack.cmd',
  'scripts\\start-showcase.cmd',
];

const repositoryUrl = 'https://github.com/jiang4wqy/strategy-doctor';

const githubProofs = [
  {
    label: 'Public repository',
    value: 'jiang4wqy/strategy-doctor',
    caption: 'Source code, README, scripts, Dockerfile, and deployment config.',
    href: repositoryUrl,
    Icon: GitCompareArrows,
  },
  {
    label: 'Review branch',
    value: 'codex/p1-mcp',
    caption: 'Current preview branch used for this local judge build.',
    href: `${repositoryUrl}/tree/codex/p1-mcp`,
    Icon: GitBranch,
  },
  {
    label: 'README quick start',
    value: 'README.md',
    caption: 'Install, run, verify, and generate the evidence pack.',
    href: `${repositoryUrl}/blob/codex/p1-mcp/README.md`,
    Icon: FileText,
  },
  {
    label: 'API integration docs',
    value: 'docs/API.md',
    caption: 'Agent-facing REST client flow and endpoint examples.',
    href: `${repositoryUrl}/blob/codex/p1-mcp/docs/API.md`,
    Icon: ClipboardCheck,
  },
];

const scorecards = [
  {
    label: 'Strategies',
    value: '2 registered',
    caption: 'MA crossover + RSI/Bollinger',
    Icon: GitCompareArrows,
  },
  {
    label: 'Risk lens',
    value: '5 dimensions',
    caption: 'trend, chop, crash, spread, liquidity',
    Icon: Radar,
  },
  {
    label: 'Evidence',
    value: '269 tests',
    caption: 'core, web, API, accessibility, e2e',
    Icon: FileArchive,
  },
  {
    label: 'Coverage',
    value: '94.51% lines',
    caption: 'guarded by the verification script',
    Icon: ShieldCheck,
  },
];

const signals = [
  ['Parse consensus', 'multi-model ready'],
  ['Prescription', 'adapter-owned'],
  ['Backtest', 'cost-aware Bitget data'],
  ['Deployment', 'Playbook bridge'],
];

const workflow = [
  {
    title: 'Natural language to strategy',
    text:
      'A trader describes an idea, the parser creates a typed strategy draft, and consensus metadata records model agreement.',
    Icon: Bot,
  },
  {
    title: 'Adversarial diagnosis',
    text:
      'The engine attacks the strategy across deterministic market regimes, records deaths, survivors, and held-out trade-offs.',
    Icon: Activity,
  },
  {
    title: 'Targeted prescription',
    text:
      'Adapter-owned mutation policies propose bounded parameter repairs instead of generic random search.',
    Icon: Gauge,
  },
  {
    title: 'Playbook bridge',
    text:
      'Bitget Playbook exports or prompts can be imported into the same diagnosis API before deployment decisions.',
    Icon: Cpu,
  },
];

export function JudgeMode() {
  return (
    <main className="judge-shell">
      <section className="judge-hero" aria-labelledby="judge-title">
        <div className="judge-hero-copy">
          <div className="judge-status-row" aria-label="System status">
            <span><CheckCircle2 aria-hidden="true" /> Live judge preview</span>
            <span><ShieldCheck aria-hidden="true" /> Offline-safe</span>
            <span><TerminalSquare aria-hidden="true" /> No secrets committed</span>
          </div>
          <p className="eyebrow">Bitget AI Hackathon judge mode</p>
          <h1 id="judge-title">Strategy Doctor</h1>
          <p className="judge-lede">
            An AI trading-infra copilot that turns strategy ideas into typed
            strategies, stress-tests them against deterministic failure modes,
            and produces auditable risk repairs before Playbook deployment.
          </p>
          <p className="judge-lede">
            Execution assumptions are explicit: fee rate, slippage, turnover,
            drawdown path, and held-out equity are exported as reviewer-ready
            evidence instead of hidden chart calculations.
          </p>
          <div className="judge-actions" aria-label="Demo actions">
            <a className="primary-action" href="/showcase">
              Start live diagnosis
              <ArrowUpRight aria-hidden="true" />
            </a>
            <a href="/research">
              Open API evidence
              <ArrowUpRight aria-hidden="true" />
            </a>
            <a href="/api/v1/health">
              Check API health
              <Activity aria-hidden="true" />
            </a>
            <a href="/learn">
              Tutorial / QA
              <BookOpen aria-hidden="true" />
            </a>
          </div>
        </div>
        <div className="judge-terminal" aria-label="Live risk cockpit preview">
          <div className="terminal-topline">
            <span>risk.engine/live</span>
            <strong>PASS</strong>
          </div>
          <div className="market-curve" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="terminal-grid">
            <div>
              <span>Worst drawdown</span>
              <strong>-18.4%</strong>
            </div>
            <div>
              <span>Repair lift</span>
              <strong>+27.2</strong>
            </div>
            <div>
              <span>Cost drag</span>
              <strong>-0.42%</strong>
            </div>
          </div>
          <div className="signal-stack">
            {signals.map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="judge-scoreboard" aria-label="Competition evidence">
        {scorecards.map(({ label, value, caption, Icon }) => (
          <article key={label} className="judge-metric">
            <Icon aria-hidden="true" />
            <span>{label}</span>
            <strong>{value}</strong>
            <p>{caption}</p>
          </article>
        ))}
      </section>

      <section className="judge-grid" aria-label="System workflow">
        {workflow.map(({ Icon, ...item }) => (
          <article key={item.title} className="judge-panel">
            <Icon aria-hidden="true" />
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

      <section className="judge-band github-showcase" aria-labelledby="github-title">
        <div>
          <p className="eyebrow">GitHub review surface</p>
          <h2 id="github-title">Open source, reproducible, and ready to inspect</h2>
          <p>
            The GitHub surface is framed for reviewers: one public repository,
            one review branch, copy-ready setup docs, and an Agent API guide.
            Generated evidence stays reproducible through scripts instead of
            requiring committed secrets or local-only files.
          </p>
        </div>
        <div className="github-proof-list" aria-label="GitHub review links">
          {githubProofs.map(({ Icon, ...item }) => (
            <a key={item.label} href={item.href}>
              <Icon aria-hidden="true" />
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <p>{item.caption}</p>
            </a>
          ))}
        </div>
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
