import {
  useEffect,
  useState,
  type FormEvent,
} from 'react';
import type {
  ApiClient,
  StrategyDraft,
} from '../api/types.ts';

export interface StrategyComposerProps {
  client: ApiClient;
  description: string;
  onBack: () => void;
  onDescriptionChange(description: string): void;
  onParsed(description: string, draft: StrategyDraft): void;
}

export function StrategyComposer({
  client,
  description,
  onBack,
  onDescriptionChange,
  onParsed,
}: StrategyComposerProps) {
  const [text, setText] = useState(description);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    setText(description);
  }, [description]);

  const examples = [
    {
      label: 'MA BTC',
      text: 'BTCUSDT 1h moving average crossover, fast MA 8, slow MA 30, 3x leverage, 20% stop-loss, 50% position',
    },
    {
      label: 'RSI BTC',
      text: 'BTCUSDT 4h RSI 10 with Bollinger period 14, oversold 28, overbought 72, trend filter period 30',
    },
    {
      label: 'Breakout ETH',
      text: 'ETHUSDT 1h confirmed breakout, minimum breakout 3%, confirmation 2 bars, exit lookback 8',
    },
    {
      label: 'RSI SOL',
      text: 'SOLUSDT 4h RSI 12 with Bollinger period 20, oversold 30, overbought 70, trend filter period 50',
    },
    {
      label: 'MA ETH',
      text: 'ETHUSDT 4h trend following moving average crossover, fast moving average 12, slow moving average 48',
    },
    {
      label: 'Breakout BTC',
      text: 'BTCUSDT 1d range expansion confirmed breakout, range lookback 30, confirmation 3 bars, minimum volatility 2%',
    },
  ] as const;

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

  function useExample(index: number) {
    const value = examples[index % examples.length]?.text ?? examples[0].text;
    setText(value);
    onDescriptionChange(value);
  }

  function useRandomStarter() {
    const randomIndex = Math.floor(Math.random() * examples.length);
    useExample(randomIndex);
  }

  return (
    <section className="composer-panel" aria-labelledby="composer-title">
      <div className="workspace-actions">
        <button type="button" onClick={onBack}>
          New strategy
        </button>
        <a href="/tutorial" className="text-link">
          Strategy Doctor tutorial
        </a>
      </div>
      <p className="eyebrow">01 - Strategy intake</p>
      <h2 id="composer-title">Describe the strategy</h2>
      <p>
        Use one registered pattern. The parser creates a draft; it does not
        run a diagnosis until you confirm every field.
      </p>
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
          placeholder="BTCUSDT 4h RSI 10 with Bollinger period 14 and trend filter period 30"
        />
        <div className="composer-examples" aria-label="Supported examples">
          {examples.map((example, index) => (
            <button
              key={example.label}
              type="button"
              onClick={() => {
                useExample(index);
              }}
            >
              {example.label}
            </button>
          ))}
          <button
            type="button"
            onClick={useRandomStarter}
          >
            Random strategy
          </button>
        </div>
        <div className="form-footer">
          <span>{text.length} / 2000</span>
          <button type="submit" disabled={loading || text.trim().length === 0}>
            {loading ? 'Parsing...' : 'Parse strategy'}
          </button>
        </div>
        {error ? <p role="alert">{error}</p> : null}
      </form>
    </section>
  );
}
