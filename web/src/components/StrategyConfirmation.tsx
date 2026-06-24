import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import { ArrowLeft, BookOpen } from 'lucide-react';
import type {
  AnyStrategyDefinition,
  DiagnoseRequest,
  StrategyDraft,
} from '../api/types.ts';
import { ParameterField } from './ParameterField.tsx';
import {
  availableTradeSymbols,
  getSymbolFirstTradeDate,
  isDateBefore,
  todayIsoDate,
} from '../data/symbol-calendar.ts';

export interface StrategyConfirmationProps {
  draft: StrategyDraft;
  capabilities: readonly AnyStrategyDefinition[];
  externalError?: string;
  onBack?(): void;
  onOpenLearn?(): void;
  onConfirm(request: DiagnoseRequest): Promise<void>;
}

function assumptionLabel(reason: string): string {
  return reason === 'registered-default'
    ? 'Registered default'
    : 'Market default';
}

export function StrategyConfirmation({
  draft,
  capabilities,
  externalError,
  onBack,
  onOpenLearn,
  onConfirm,
}: StrategyConfirmationProps) {
  const definition = capabilities.find(
    item => item.archetype === draft.strategy.archetype,
  );
  const initialParams = draft.strategy.params as unknown as Record<
    string,
    number
  >;
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(
      Object.entries(initialParams).map(([key, value]) => [
        key,
        String(value),
      ]),
    ),
  );
  const [style, setStyle] = useState<DiagnoseRequest['style']>(
    'conservative',
  );
  const [symbol, setSymbol] = useState(draft.strategy.universe[0] ?? 'BTCUSDT');
  const [timeframe, setTimeframe] = useState(draft.strategy.timeframe);
  const [dataSource, setDataSource] = useState(
    draft.strategy.backtest?.source ?? 'offline-synthetic',
  );
  const [candleLimit, setCandleLimit] = useState(
    String(draft.strategy.backtest?.candleLimit ?? 240),
  );
  const [startDate, setStartDate] = useState(
    draft.strategy.backtest?.startDate ?? '',
  );
  const [endDate, setEndDate] = useState(
    draft.strategy.backtest?.endDate ?? '',
  );
  const [feeRatePct, setFeeRatePct] = useState(
    String(draft.strategy.execution?.feeRatePct ?? 0.0006),
  );
  const [slippagePct, setSlippagePct] = useState(
    String(draft.strategy.execution?.slippagePct ?? 0.0005),
  );
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [today] = useState(todayIsoDate());

  const parameters = useMemo(
    () => definition?.parameters ?? [],
    [definition],
  );
  if (!definition) {
    return <p role="alert">Capability metadata is missing for this strategy.</p>;
  }

  useEffect(() => {
    const firstTradeDate = getSymbolFirstTradeDate(symbol);
    if (startDate && isDateBefore(startDate, firstTradeDate)) {
      setStartDate(firstTradeDate);
    }
    if (endDate && isDateBefore(endDate, firstTradeDate)) {
      setEndDate(firstTradeDate);
    }
    if (startDate && endDate && endDate < startDate) {
      setEndDate(startDate);
    }
  }, [symbol]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed: Record<string, number> = {};
    for (const parameter of parameters) {
      const value = Number(values[parameter.key]);
      const belowMinimum = value < parameter.minimum
        || (
          parameter.exclusiveMinimum === true
          && value === parameter.minimum
        );
      const aboveMaximum = parameter.maximum !== undefined
        && (
          value > parameter.maximum
          || (
            parameter.exclusiveMaximum === true
            && value === parameter.maximum
          )
        );
      if (
        !Number.isFinite(value)
        || (parameter.kind === 'integer' && !Number.isInteger(value))
        || belowMinimum
        || aboveMaximum
      ) {
        setError(`${parameter.label} is outside the registered bounds.`);
        return;
      }
      parsed[parameter.key] = value;
    }
    const parsedCandleLimit = Number(candleLimit);
    if (
      !Number.isInteger(parsedCandleLimit)
      || parsedCandleLimit < 50
      || parsedCandleLimit > 1000
    ) {
      setError('Candle limit must be an integer from 50 to 1000.');
      return;
    }

    const firstTradeDate = getSymbolFirstTradeDate(symbol);
    if (startDate && isDateBefore(startDate, firstTradeDate)) {
      setError(`Start date cannot be earlier than first ${symbol} data at ${firstTradeDate}.`);
      return;
    }
    if (startDate && startDate > today) {
      setError('Start date cannot be in the future.');
      return;
    }
    if (endDate && endDate > today) {
      setError('End date cannot be in the future.');
      return;
    }
    if (startDate && endDate && startDate > endDate) {
      setError('Start date must be on or before end date.');
      return;
    }
    const parsedFeeRatePct = Number(feeRatePct);
    const parsedSlippagePct = Number(slippagePct);
    if (
      !Number.isFinite(parsedFeeRatePct)
      || parsedFeeRatePct < 0
      || parsedFeeRatePct > 0.02
      || !Number.isFinite(parsedSlippagePct)
      || parsedSlippagePct < 0
      || parsedSlippagePct > 0.02
    ) {
      setError('Fee rate and slippage must be decimal rates from 0 to 0.02.');
      return;
    }

    setError(undefined);
    setLoading(true);
    try {
      await onConfirm({
        strategy: {
          ...draft.strategy,
          params: parsed,
          universe: [symbol],
          timeframe,
          backtest: {
            source: dataSource,
            candleLimit: parsedCandleLimit,
            ...(startDate ? { startDate } : {}),
            ...(endDate ? { endDate } : {}),
          },
          execution: {
            feeRatePct: parsedFeeRatePct,
            slippagePct: parsedSlippagePct,
          },
        } as unknown as DiagnoseRequest['strategy'],
        style,
        seed: 42,
        candidates: 6,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="confirmation-panel" aria-labelledby="confirm-title">
      <div className="panel-heading-row">
        <div className="panel-title">
          <p className="eyebrow">02 / Confirmation boundary</p>
          <h2 id="confirm-title">{definition.displayName}</h2>
          <p>{definition.description}</p>
        </div>
        <div className="toolbar">
          {onOpenLearn ? (
            <button type="button" className="secondary-action" onClick={onOpenLearn}>
              <BookOpen aria-hidden="true" />
              Tutorial / QA
            </button>
          ) : null}
          {onBack ? (
            <button type="button" className="ghost-action" onClick={onBack}>
              <ArrowLeft aria-hidden="true" />
              Back to strategy
            </button>
          ) : null}
        </div>
      </div>
      <div className="draft-meta">
        <span>{draft.source}</span>
        <span>{Math.round(draft.confidence * 100)}% confidence</span>
      </div>
      {draft.assumptions.length > 0 ? (
        <ul className="assumption-list" aria-label="Parser assumptions">
          {draft.assumptions.map(assumption => (
            <li key={assumption.field}>
              <strong>{assumptionLabel(assumption.reason)}</strong>
              <code>{assumption.field}</code>
              <span>{String(assumption.value)}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {draft.warnings.map(warning => (
        <p className="warning" key={warning.code}>
          {warning.message}
        </p>
      ))}
      <form noValidate onSubmit={submit}>
        <div className="parameter-grid">
          {parameters.map(parameter => (
            <ParameterField
              key={parameter.key}
              id={`parameter-${parameter.key}`}
              label={parameter.label}
              description={parameter.description}
              kind={parameter.kind}
              value={values[parameter.key] ?? ''}
              onChange={value => setValues(current => ({
                ...current,
                [parameter.key]: value,
              }))}
            />
          ))}
        </div>
        <label htmlFor="diagnosis-style">Risk style</label>
        <select
          id="diagnosis-style"
          value={style}
          onChange={event => setStyle(
            event.target.value as DiagnoseRequest['style'],
          )}
        >
          <option value="conservative">Conservative</option>
          <option value="aggressive">Aggressive</option>
          <option value="trend">Trend</option>
        </select>
        <fieldset className="market-controls">
          <legend>Market and dataset</legend>
          <label htmlFor="market-symbol">Symbol</label>
          <select
            id="market-symbol"
            value={symbol}
            onChange={event => setSymbol(event.target.value)}
          >
            {availableTradeSymbols.map(item => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <label htmlFor="market-timeframe">Timeframe</label>
          <select
            id="market-timeframe"
            value={timeframe}
            onChange={event => setTimeframe(event.target.value)}
          >
            <option value="1h">1h</option>
            <option value="4h">4h</option>
            <option value="1d">1d</option>
          </select>
          <label htmlFor="market-source">Data source</label>
          <select
            id="market-source"
            value={dataSource}
            onChange={event => setDataSource(
              event.target.value as 'offline-synthetic' | 'bitget-public',
            )}
          >
            <option value="offline-synthetic">Offline deterministic</option>
            <option value="bitget-public">Bitget public candles</option>
          </select>
          <label htmlFor="candle-limit">Candles</label>
          <input
            id="candle-limit"
            type="number"
            min="50"
            max="1000"
            step="1"
            value={candleLimit}
            onChange={event => setCandleLimit(event.target.value)}
          />
          <label htmlFor="start-date">Start date</label>
          <input
            id="start-date"
            type="date"
            value={startDate}
            min={getSymbolFirstTradeDate(symbol)}
            max={endDate || today}
            onChange={event => setStartDate(event.target.value)}
          />
          <label htmlFor="end-date">End date</label>
          <input
            id="end-date"
            type="date"
            value={endDate}
            min={startDate || getSymbolFirstTradeDate(symbol)}
            max={today}
            onChange={event => setEndDate(event.target.value)}
          />
          <label htmlFor="fee-rate">Fee rate</label>
          <input
            id="fee-rate"
            type="number"
            min="0"
            max="0.02"
            step="0.0001"
            value={feeRatePct}
            onChange={event => setFeeRatePct(event.target.value)}
          />
          <label htmlFor="slippage-rate">Slippage</label>
          <input
            id="slippage-rate"
            type="number"
            min="0"
            max="0.02"
            step="0.0001"
            value={slippagePct}
            onChange={event => setSlippagePct(event.target.value)}
          />
        </fieldset>
        {error || externalError ? (
          <p role="alert">{error ?? externalError}</p>
        ) : null}
        <button type="submit" disabled={loading}>
          {loading ? 'Running diagnosis...' : 'Confirm and diagnose'}
        </button>
      </form>
    </section>
  );
}
