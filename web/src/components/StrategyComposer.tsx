import {
  useEffect,
  useState,
  type FormEvent,
} from 'react';
import {
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

export interface StrategyComposerProps {
  client: ApiClient;
  description: string;
  onDescriptionChange(description: string): void;
  onParsed(description: string, draft: StrategyDraft): void;
  onOpenLearn?(): void;
}

export function StrategyComposer({
  client,
  description,
  onDescriptionChange,
  onParsed,
  onOpenLearn,
}: StrategyComposerProps) {
  const [text, setText] = useState(description);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

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

  function useRandomStrategy() {
    const draft = randomStrategyDraft();
    const generatedDescription =
      `${draft.strategy.name}: generated ${draft.strategy.archetype} strategy for BTCUSDT ${draft.strategy.timeframe}`;
    setText(generatedDescription);
    onDescriptionChange(generatedDescription);
    onParsed(generatedDescription, draft);
  }

  return (
    <section className="composer-panel" aria-labelledby="composer-title">
      <div className="panel-heading-row">
        <div>
          <p className="eyebrow">01 / Strategy intake</p>
          <h2 id="composer-title">Describe the strategy</h2>
          <p>
            Use one registered pattern. The parser creates a draft; it does not
            run a diagnosis until you confirm every field.
          </p>
        </div>
        {onOpenLearn ? (
          <button type="button" onClick={onOpenLearn}>
            <Sparkles aria-hidden="true" />
            Tutorial / QA
          </button>
        ) : null}
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
          {strategyExamples.map(example => (
            <button
              key={example.label}
              type="button"
              onClick={() => {
                setText(example.description);
                onDescriptionChange(example.description);
              }}
            >
              {example.label}
            </button>
          ))}
          <button type="button" onClick={useRandomStrategy}>
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
            <button type="button" onClick={useRandomStrategy}>
              <Dice5 aria-hidden="true" />
              Generate a playable strategy instead
            </button>
          </div>
        ) : null}
      </form>
    </section>
  );
}
