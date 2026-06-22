import {
  useEffect,
  useState,
  type FormEvent,
} from 'react';
import type {
  ApiClient,
  StrategyDraft,
} from '../api/types.ts';

const STRATEGY_TEMPLATES = [
  {
    id: 'ma',
    name: 'Moving Average Trend',
    archetype: 'ma-cross',
    market: 'Trend continuation',
    risk: 'Whipsaw and liquidation',
    params: 'fast 8 / slow 30 / 5x',
    description:
      'BTCUSDT 1h moving average crossover, fast MA 8, slow MA 30, 5x leverage, 10% stop loss, 60% position.',
  },
  {
    id: 'rsi',
    name: 'RSI Bollinger Mean Reversion',
    archetype: 'rsi-bollinger-mean-reversion',
    market: 'Range and exhaustion',
    risk: 'Trend continuation against entries',
    params: 'RSI 10 / BB 14 / trend filter 30',
    description:
      'BTC 4h RSI 10 with Bollinger period 14 and 1.75 standard deviations, oversold 30, overbought 70, trend filter 30 with 5% threshold.',
  },
  {
    id: 'breakout',
    name: 'Confirmed Breakout',
    archetype: 'breakout-confirmation',
    market: 'Range expansion',
    risk: 'False breakout bleed',
    params: 'lookback 24 / confirm 2',
    description:
      'BTCUSDT 1h confirmed breakout, breakout lookback 24, confirmation bars 2, exit lookback 8, volatility lookback 12, minimum breakout 1.2%, minimum volatility 0.2%, 4x leverage, 8% stop loss, 55% position.',
  },
  {
    id: 'atr',
    name: 'ATR Trend Breakout',
    archetype: 'atr-trend-breakout',
    market: 'Volatility breakout',
    risk: 'ATR stop too tight in chop',
    params: 'ATR 14 / breakout 20 / stop 2.5x',
    description:
      'BTCUSDT 4h ATR breakout, ATR period 14, breakout lookback 20, ATR stop 2.5, trend MA 50, 5x leverage, 12% stop loss, 60% position.',
  },
] as const;

export interface StrategyComposerProps {
  client: ApiClient;
  description: string;
  onDescriptionChange(description: string): void;
  onParsed(description: string, draft: StrategyDraft): void;
}

export function StrategyComposer({
  client,
  description,
  onDescriptionChange,
  onParsed,
}: StrategyComposerProps) {
  const [text, setText] = useState(description);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    setText(description);
  }, [description]);

  async function parseDescription(value: string) {
    setLoading(true);
    setError(undefined);
    try {
      const response = await client.parse(value);
      onParsed(value, response.data);
    } catch (reason) {
      setError(reason instanceof Error
        ? reason.message
        : 'The strategy description could not be parsed.');
    } finally {
      setLoading(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await parseDescription(text);
  }

  async function applyTemplate(description: string) {
    setText(description);
    onDescriptionChange(description);
    await parseDescription(description);
  }

  return (
    <section className="composer-panel" aria-labelledby="composer-title">
      <p className="eyebrow">01 · Strategy intake</p>
      <h2 id="composer-title">Describe the strategy</h2>
      <p>
        Use one registered pattern. The parser creates a draft; it does not
        run a diagnosis until you confirm every field.
      </p>
      <div className="strategy-template-strip" aria-label="Strategy templates">
        {STRATEGY_TEMPLATES.map(template => (
          <button
            className="strategy-template"
            disabled={loading}
            key={template.id}
            onClick={() => void applyTemplate(template.description)}
            type="button"
          >
            <span>{template.archetype}</span>
            <strong>{template.name}</strong>
            <em>{template.market}</em>
            <small>{template.risk}</small>
            <code>{template.params}</code>
          </button>
        ))}
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
          placeholder="BTC 四小时 RSI 10 配合布林带 14，趋势过滤周期 30…"
        />
        <div className="form-footer">
          <span>{text.length} / 2000</span>
          <button type="submit" disabled={loading || text.trim().length === 0}>
            {loading ? 'Parsing…' : 'Parse strategy'}
          </button>
        </div>
        {error ? <p role="alert">{error}</p> : null}
      </form>
    </section>
  );
}
