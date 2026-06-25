import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import {
  ArrowLeft,
  Dice5,
  Sparkles,
} from 'lucide-react';
import type {
  ApiClient,
  StrategyDraft,
} from '../api/types.ts';
import {
  randomStrategyDraft,
  strategyExamples,
} from '../strategy-playground.ts';

const judgeDemoDescription =
  'Build a conservative BTC 4h RSI Bollinger mean reversion strategy. RSI period: 8. Oversold: 25. Overbought: 75. Bollinger period: 20. Use 1.75 standard deviations. Trend filter period: 30. Use 5% threshold, 3x leverage, 5% stop-loss, and 50% position size.';

export interface StrategyComposerProps {
  client: ApiClient;
  description: string;
  onDescriptionChange(description: string): void;
  onParsed(description: string, draft: StrategyDraft): void;
  onOpenLearn?(): void;
  onBack?(): void;
}

export function StrategyComposer({
  client,
  description,
  onDescriptionChange,
  onParsed,
  onOpenLearn,
  onBack,
}: StrategyComposerProps) {
  const [text, setText] = useState(description);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const asReadableDraft = useMemo(() => (draft: StrategyDraft) => {
    if (draft.strategy.archetype === 'ma-cross') {
      return `${draft.strategy.universe[0]} ${draft.strategy.timeframe} MA crossover, `
        + `fast MA ${draft.strategy.params.fastMA}, slow MA ${draft.strategy.params.slowMA}, `
        + `leverage ${draft.strategy.params.leverage}, stop loss ${draft.strategy.params.stopLossPct}, `
        + `position size ${draft.strategy.params.positionPct}`;
    }
    return `${draft.strategy.universe[0]} ${draft.strategy.timeframe} RSI ${draft.strategy.params.rsiPeriod} `
      + `with Bollinger period ${draft.strategy.params.bollingerPeriod} and deviation ${draft.strategy.params.bollingerStdDev}, `
      + `oversold ${draft.strategy.params.rsiOversold}, overbought ${draft.strategy.params.rsiOverbought}, `
      + `trend filter period ${draft.strategy.params.trendFilterPeriod}, leverage ${draft.strategy.params.leverage}, `
      + `stop loss ${draft.strategy.params.stopLossPct}, position size ${draft.strategy.params.positionPct}`;
  }, []);

  useEffect(() => {
    setText(description);
  }, [description]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(undefined);
    try {
      const response = await client.parse(text);
      onParsed(text, response.data);
    } catch (reason) {
      setError(reason instanceof Error
        ? reason.message
        : 'The strategy description could not be parsed.');
    } finally {
      setLoading(false);
    }
  }

  function useDescription(nextDescription: string) {
    setText(nextDescription);
    onDescriptionChange(nextDescription);
  }

  function useRandomStrategy() {
    const draft = randomStrategyDraft();
    const generatedDescription = asReadableDraft(draft);
    useDescription(generatedDescription);
    onParsed(generatedDescription, draft);
  }

  return (
    <section className="composer-panel" aria-labelledby="composer-title">
      <div className="panel-heading-row">
        <div className="panel-title">
          <p className="eyebrow">01 / Strategy intake</p>
          <h2 id="composer-title">Describe the strategy</h2>
          <p>
            Use one registered pattern. The parser creates a draft; it does not
            run a diagnosis until you confirm every field.
          </p>
        </div>
        <div className="toolbar">
          {onBack ? (
            <button type="button" className="ghost-action" onClick={onBack}>
              <ArrowLeft aria-hidden="true" />
              Back to workspace
            </button>
          ) : null}
          {onOpenLearn ? (
            <button
              type="button"
              className="secondary-action"
              onClick={onOpenLearn}
            >
              <Sparkles aria-hidden="true" />
              Tutorial / QA
            </button>
          ) : null}
        </div>
      </div>
      <form onSubmit={submit}>
        <label htmlFor="strategy-description">Strategy description</label>
        <textarea
          id="strategy-description"
          maxLength={2000}
          rows={8}
          value={text}
          onChange={event => {
            setText(event.target.value);
            onDescriptionChange(event.target.value);
          }}
          placeholder="BTCUSDT 4h RSI 10 with Bollinger period 14 and trend filter period 30..."
        />
        <div className="composer-examples" aria-label="Supported examples">
          <button
            type="button"
            className="primary-action demo-prompt-action"
            onClick={() => useDescription(judgeDemoDescription)}
          >
            <Sparkles aria-hidden="true" />
            Judge demo prompt
          </button>
          {strategyExamples.map(example => (
            <button
              key={example.label}
              type="button"
              className="secondary-action"
              onClick={() => useDescription(example.description)}
            >
              {example.label}
            </button>
          ))}
          <button type="button" className="primary-action" onClick={useRandomStrategy}>
            <Dice5 aria-hidden="true" />
            Random strategy
          </button>
        </div>
        <div className="form-footer">
          <span>{text.length} / 2000</span>
          <button type="submit" disabled={loading || text.trim().length === 0}>
            {loading ? 'Parsing...' : 'Parse strategy'}
          </button>
        </div>
        {error ? (
          <div className="parser-fallback">
            <p role="alert">{error}</p>
            <button type="button" className="secondary-action" onClick={useRandomStrategy}>
              <Dice5 aria-hidden="true" />
              Generate a playable strategy instead
            </button>
          </div>
        ) : null}
      </form>
    </section>
  );
}
