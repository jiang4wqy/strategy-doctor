import {
  ArrowLeft,
  BookOpen,
  BrainCircuit,
  CircleHelp,
  Dice5,
  LineChart,
  NotebookTabs,
  ShieldAlert,
  Waves,
} from 'lucide-react';

const steps = [
  {
    title: 'Describe or generate',
    text:
      'Start with natural language, choose a sample strategy, or generate a random playable strategy when you want to explore quickly.',
    Icon: BrainCircuit,
  },
  {
    title: 'Confirm every field',
    text:
      'The parser never runs risk diagnosis automatically. Review parameters, risk style, leverage, stop loss, and position size first.',
    Icon: ShieldAlert,
  },
  {
    title: 'Diagnose and repair',
    text:
      'Strategy Doctor attacks the strategy across five deterministic stress dimensions, then proposes bounded targeted repairs.',
    Icon: BookOpen,
  },
  {
    title: 'Inspect execution quality',
    text:
      'Review equity, drawdown, turnover, fee drag, slippage drag, and held-out repair trade-offs before sharing the report.',
    Icon: LineChart,
  },
];

const researchModules = [
  {
    title: 'AI factor library',
    text:
      'A curated factor map for trend, mean reversion, liquidity, volatility, sentiment, macro, and news stress features.',
    Icon: BrainCircuit,
  },
  {
    title: 'Paper signal monitor',
    text:
      'A read-only simulation lane for tracking live strategy decisions before any deployment handoff.',
    Icon: Waves,
  },
  {
    title: 'Notebook research lane',
    text:
      'A planned online notebook surface for multi-factor experiments, dataset fingerprints, and reproducible reports.',
    Icon: NotebookTabs,
  },
];

const questions = [
  {
    question: 'What if natural-language parsing fails?',
    answer:
      'Use the random strategy button or one of the samples. Random strategies are still valid registered strategies and can be diagnosed.',
  },
  {
    question: 'Is this a trading signal or a safety tool?',
    answer:
      'It is a pre-deployment risk diagnosis layer. The output is evidence for review, not a guarantee of future profit.',
  },
  {
    question: 'Why does the app ask me to confirm parameters?',
    answer:
      'Contest judges and teams need auditable control. The app makes assumptions visible before running expensive diagnosis.',
  },
  {
    question: 'How should I present this to judges?',
    answer:
      'Open judge mode, show the Playbook bridge, then run one MA sample and one RSI/Bollinger sample through the private workspace.',
  },
];

export interface LearnModeProps {
  onBack?(): void;
}

export function LearnMode({ onBack }: LearnModeProps) {
  return (
    <main className="learn-shell">
      <section className="learn-hero" aria-labelledby="learn-title">
        <div>
          <p className="eyebrow">Tutorial / QA</p>
          <h1 id="learn-title">How to use Strategy Doctor</h1>
          <p>
            A guided path for judges and teammates: create a strategy, confirm
            the generated contract, diagnose failures, and export evidence.
          </p>
        </div>
        <div className="toolbar">
          {onBack ? (
            <button
              type="button"
              className="ghost-action"
              onClick={onBack}
            >
              <ArrowLeft aria-hidden="true" />
              Back
            </button>
          ) : (
            <a className="learn-link" href="/showcase">
              <ArrowLeft aria-hidden="true" />
              Open workspace
            </a>
          )}
        </div>
      </section>

      <section className="learn-steps" aria-label="Workflow tutorial">
        {steps.map(({ Icon, title, text }) => (
          <article key={title}>
            <Icon aria-hidden="true" />
            <h2>{title}</h2>
            <p>{text}</p>
          </article>
        ))}
      </section>

      <section className="qa-panel" aria-labelledby="qa-title">
        <div>
          <p className="eyebrow">Common questions</p>
          <h2 id="qa-title">Fast answers for reviewers</h2>
        </div>
        <div className="qa-list">
          {questions.map(item => (
            <details key={item.question}>
              <summary>
                <CircleHelp aria-hidden="true" />
                {item.question}
              </summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="learn-steps" aria-label="Research extensions">
        {researchModules.map(({ Icon, title, text }) => (
          <article key={title}>
            <Icon aria-hidden="true" />
            <h2>{title}</h2>
            <p>{text}</p>
          </article>
        ))}
      </section>

      <section className="play-panel" aria-labelledby="play-title">
        <Dice5 aria-hidden="true" />
        <div>
          <h2 id="play-title">Make it playable</h2>
          <p>
            The random strategy generator is designed for demos. It creates
            valid MA or RSI/Bollinger strategies that still require confirmation
            before diagnosis.
          </p>
        </div>
      </section>
    </main>
  );
}
