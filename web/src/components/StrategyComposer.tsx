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

  return (
    <section className="composer-panel" aria-labelledby="composer-title">
      <p className="eyebrow">01 · Strategy intake</p>
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
          placeholder="BTCUSDT 4h RSI 10 with Bollinger period 14 and trend filter period 30..."
        />
        <div className="composer-examples" aria-label="Supported examples">
          <button
            type="button"
            onClick={() => {
              const value =
                'BTCUSDT 1h moving average crossover, fast MA 8, slow MA 30';
              setText(value);
              onDescriptionChange(value);
            }}
          >
            Use MA example
          </button>
          <button
            type="button"
            onClick={() => {
              const value =
                'BTCUSDT 4h RSI 10 with Bollinger period 14 and trend filter period 30';
              setText(value);
              onDescriptionChange(value);
            }}
          >
            Use RSI + Bollinger example
          </button>
        </div>
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
