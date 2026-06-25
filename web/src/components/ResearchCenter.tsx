import {
  Activity,
  ArrowLeft,
  BellRing,
  BotMessageSquare,
  CalendarClock,
  CircleDashed,
  Cpu,
  FileJson,
  RefreshCw,
  Search,
  ServerCog,
  ShieldAlert,
  Sparkles,
  Target,
  Timer,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { ApiClient } from '../api/types.ts';
import type { DiagnoseRequest, OnChainDashboardView, StrategyDraft } from '../api/types.ts';
import {
  getSymbolFirstTradeDate,
  isDateBefore,
  todayIsoDate,
} from '../data/symbol-calendar.ts';
import { MiniSeriesChart } from './MiniSeriesChart.tsx';
import { randomStrategyDraft, strategyExamples } from '../strategy-playground.ts';

type ResearchTab =
  | 'overview'
  | 'signal'
  | 'sandbox'
  | 'monitor'
  | 'onchain'
  | 'library';

const DEFAULT_STRATEGIES = strategyExamples.slice(0, 4).map(example => ({
  label: `${example.label} (text)`,
  text: example.description,
}));

const SAMPLE_SYMBOLS = [
  'BTCUSDT',
  'ETHUSDT',
  'SOLUSDT',
] as const;

const SAMPLE_TIMEFRAMES = ['1h', '4h', '1d'] as const;
const ARCHETYPE_OPTIONS = [
  'ma-cross',
  'rsi-bollinger-mean-reversion',
] as const;

const SIGNAL_INTERVAL_OPTIONS = [
  { label: '3s', value: 3 },
  { label: '5s', value: 5 },
  { label: '8s', value: 8 },
  { label: '12s', value: 12 },
];

interface SignalHistoryEntry {
  signal: 'long' | 'short' | 'hold' | 'flat';
  position: 'long' | 'short' | 'flat';
  equity: number;
  totalTrades: number;
  turnoverPct: number;
  feeCostPct: number;
  slippageCostPct: number;
  timestamp: string;
}

function toPrettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function formatNumber(value: number, digits = 2): string {
  return Number.isFinite(value)
    ? value.toFixed(digits)
    : 'n/a';
}

function parseInteger(value: string, min: number, max: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`Value must be an integer between ${min} and ${max}.`);
  }
  return parsed;
}

function parsePriceInput(value: string): number[] | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  const prices = trimmed
    .split(/[,\s]+/)
    .filter(item => item.length > 0)
    .map(item => Number.parseFloat(item))
    .filter(value => Number.isFinite(value));
  if (prices.length < 2 || prices.some(item => item <= 0)) {
    throw new Error('prices must be at least two positive numbers.');
  }
  return prices;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asPositiveNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive number.`);
  }
  return value;
}

function asNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }
  return value;
}

function parseDateValue(value: unknown, field: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    throw new Error(`${field} must be a YYYY-MM-DD date.`);
  }
  const trimmed = value.trim();
  if (isDateBefore(todayIsoDate(), trimmed)) {
    throw new Error(`${field} cannot be in the future.`);
  }
  return trimmed;
}

function asInteger(
  value: unknown,
  label: string,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
): number {
  if (!Number.isInteger(value as number) || typeof value !== 'number') {
    throw new Error(`${label} must be an integer.`);
  }
  if (value < min || value > max) {
    throw new Error(`${label} must be within ${min} and ${max}.`);
  }
  return value;
}

function normalizeStrategy(raw: string): DiagnoseRequest['strategy'] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Strategy must be valid JSON.');
  }
  if (!isObject(parsed)) {
    throw new Error('Strategy payload must be a JSON object.');
  }
  const maybeStrategy = isObject(parsed.strategy) ? parsed.strategy : parsed;
  if (!isObject(maybeStrategy)) {
    throw new Error('Strategy payload must contain a strategy object.');
  }
  if (
    typeof maybeStrategy.archetype !== 'string'
    || !ARCHETYPE_OPTIONS.includes(
      maybeStrategy.archetype as (typeof ARCHETYPE_OPTIONS)[number],
    )
  ) {
    throw new Error('Unknown strategy archetype.');
  }
  if (!Array.isArray(maybeStrategy.universe) || maybeStrategy.universe.length === 0) {
    throw new Error('universe must contain at least one symbol.');
  }
  if (typeof maybeStrategy.timeframe !== 'string' || maybeStrategy.timeframe.trim() === '') {
    throw new Error('timeframe is required.');
  }
  if (!isObject(maybeStrategy.params)) {
    throw new Error('params is required.');
  }
  const symbol = String(maybeStrategy.universe[0]).toUpperCase();
  if (typeof symbol !== 'string' || symbol.trim().length === 0) {
    throw new Error('universe[0] is required.');
  }

  const params = maybeStrategy.params;
  const archetype = maybeStrategy.archetype as DiagnoseRequest['strategy']['archetype'];
  const timeframe = String(maybeStrategy.timeframe).trim().toLowerCase();
  if (!['1h', '4h', '1d'].includes(timeframe)) {
    throw new Error('timeframe must be one of 1h, 4h, 1d.');
  }
  const firstTradeDate = getSymbolFirstTradeDate(symbol);
  const startDate = parseDateValue(
    isObject(maybeStrategy.backtest) ? maybeStrategy.backtest.startDate : undefined,
    'strategy.backtest.startDate',
  );
  const endDate = parseDateValue(
    isObject(maybeStrategy.backtest) ? maybeStrategy.backtest.endDate : undefined,
    'strategy.backtest.endDate',
  );
  if (startDate && isDateBefore(startDate, firstTradeDate)) {
    throw new Error(`strategy.backtest.startDate cannot be before ${firstTradeDate}.`);
  }
  if (startDate && endDate && isDateBefore(endDate, startDate)) {
    throw new Error('strategy.backtest.startDate must be on or before strategy.backtest.endDate.');
  }
  const parsedBacktest = isObject(maybeStrategy.backtest) && (
    maybeStrategy.backtest.source === 'bitget-public'
    || maybeStrategy.backtest.source === 'offline-synthetic'
  ) ? {
    source: maybeStrategy.backtest.source as 'bitget-public' | 'offline-synthetic',
    candleLimit: asInteger(maybeStrategy.backtest.candleLimit, 'candleLimit', 1, 100000),
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {}),
  } : undefined;
  const parsedExecution = isObject(maybeStrategy.execution) ? {
    feeRatePct: asNumber(maybeStrategy.execution.feeRatePct, 'feeRatePct'),
    slippagePct: asNumber(maybeStrategy.execution.slippagePct, 'slippagePct'),
  } : undefined;
  const base = {
    id: String(maybeStrategy.id ?? `${maybeStrategy.archetype}-${Date.now()}`),
    name: String(maybeStrategy.name ?? `${maybeStrategy.archetype}-${symbol}`),
    universe: [symbol.toUpperCase()],
    timeframe,
    backtest: parsedBacktest,
    execution: parsedExecution,
  };

  if (archetype === 'ma-cross') {
    return {
      ...base,
      archetype,
      params: {
        fastMA: asInteger(params.fastMA, 'fastMA', 1),
        slowMA: asInteger(params.slowMA, 'slowMA', 2),
        leverage: asPositiveNumber(params.leverage, 'leverage'),
        stopLossPct: asNumber(params.stopLossPct, 'stopLossPct'),
        positionPct: asNumber(params.positionPct, 'positionPct'),
      },
    };
  }

  return {
    ...base,
    archetype,
    params: {
      rsiPeriod: asInteger(params.rsiPeriod, 'rsiPeriod', 1, 60),
      rsiOversold: asNumber(params.rsiOversold, 'rsiOversold'),
      rsiOverbought: asNumber(params.rsiOverbought, 'rsiOverbought'),
      bollingerPeriod: asInteger(params.bollingerPeriod, 'bollingerPeriod', 2, 240),
      bollingerStdDev: asPositiveNumber(params.bollingerStdDev, 'bollingerStdDev'),
      trendFilterPeriod: asInteger(
        params.trendFilterPeriod,
        'trendFilterPeriod',
        1,
        999,
      ),
      trendFilterThreshold: asNumber(
        params.trendFilterThreshold,
        'trendFilterThreshold',
      ),
      leverage: asPositiveNumber(params.leverage, 'leverage'),
      stopLossPct: asNumber(params.stopLossPct, 'stopLossPct'),
      positionPct: asNumber(params.positionPct, 'positionPct'),
    },
  };
}

function normalizeOnchainDashboard(
  input: OnChainDashboardView,
): {
  symbol: string;
  timeframe: string;
  asOf: string;
  onChainFlowUsd: number;
  spotVolumeUsd: number;
  perpsOpenInterestUsd: number;
  fundingRate: number;
  liquidationsUsd: number;
  metrics: {
    flowPressure: {
      onChainFlowUsd: number;
      spotVolumeUsd: number;
      perpsOpenInterestUsd: number;
      fundingRate: number;
      liquidationsUsd: number;
    };
    liquidityPressure: {
      bidAskSpreadBps: number;
      whaleOrderDepthUsd: number;
      borrowRate: number;
    };
    riskSignals: {
      squeezeRisk: number;
      liquidationRisk: number;
      momentumSkew: number;
    };
  };
} {
  return {
    symbol: input.symbol,
    timeframe: input.timeframe,
    asOf: input.asOf,
    onChainFlowUsd: input.metrics.flowPressure.onChainFlowUsd,
    spotVolumeUsd: input.metrics.flowPressure.spotVolumeUsd,
    perpsOpenInterestUsd: input.metrics.flowPressure.perpsOpenInterestUsd,
    fundingRate: input.metrics.flowPressure.fundingRate,
    liquidationsUsd: input.metrics.flowPressure.liquidationsUsd,
    metrics: {
      flowPressure: input.metrics.flowPressure,
      liquidityPressure: input.metrics.liquidityPressure,
      riskSignals: input.metrics.riskSignals,
    },
  };
}

function buildSignalSeed(steps: number, index: number, seed: number): number {
  return ((steps * 17 + index * 11 + seed) % 97) / 100 + 0.3;
}

function enrichSignalSeries(
  input: { prices: number[]; symbol: string },
): number[] {
  const next = [...input.prices];
  const seed = input.symbol.codePointAt(0) ?? 65;
  const drift = Math.abs(next.at(-1) ?? 100) * 0.001;
  for (let index = 0; index < 6; index += 1) {
    const multiplier = 1 + (buildSignalSeed(index, next.length, seed) - 0.5) * drift;
    const previous = next.at(-1) ?? 100;
    next.push(Math.max(0.5, previous * multiplier));
  }
  return next;
}

function downloadText(fileName: string, content: string): void {
  const href = URL.createObjectURL(
    new Blob([content], { type: 'application/json' }),
  );
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(href);
}

const quickSamples = randomStrategyDraft();

interface StrategyTemplate {
  label: string;
  strategy: DiagnoseRequest['strategy'];
}

const STRATEGY_TEMPLATES: StrategyTemplate[] = [
  {
    label: 'Preset: MA trend follower',
    strategy: {
      id: 'template-ma',
      name: 'Preset MA trend',
      archetype: 'ma-cross',
      params: {
        fastMA: 8,
        slowMA: 30,
        leverage: 8,
        stopLossPct: 0.4,
        positionPct: 0.75,
      },
      universe: ['BTCUSDT'],
      timeframe: '1h',
    },
  },
  {
    label: 'Preset: RSI mean reversion',
    strategy: {
      id: 'template-rsi',
      name: 'Preset RSI/Bollinger',
      archetype: 'rsi-bollinger-mean-reversion',
      params: {
        rsiPeriod: 10,
        rsiOversold: 30,
        rsiOverbought: 70,
        bollingerPeriod: 14,
        bollingerStdDev: 1.75,
        trendFilterPeriod: 30,
        trendFilterThreshold: 0.05,
        leverage: 3,
        stopLossPct: 0.05,
        positionPct: 0.5,
      },
      universe: ['ETHUSDT'],
      timeframe: '4h',
    },
  },
  {
    label: `Preset: ${quickSamples.strategy.name}`,
    strategy: quickSamples.strategy,
  },
];

export interface ResearchCenterProps {
  client: ApiClient;
  onBack?: () => void;
}

export function ResearchCenter({ client, onBack }: ResearchCenterProps) {
  const [activeTab, setActiveTab] = useState<ResearchTab>('overview');
  const [monitorLimit, setMonitorLimit] = useState('30');
  const [monitorRefreshMs, setMonitorRefreshMs] = useState('6000');
  const [monitorData, setMonitorData] = useState<{
    totalCalls: number;
    totalErrors: number;
    successRate: number;
    topPaths: Array<{
      path: string;
      count: number;
      errorCount: number;
      avgDurationMs: number;
      successRate: number;
      lastStatus: number;
      lastSeen: string;
    }>;
    recent: Array<{
      id: string;
      method: string;
      path: string;
      statusCode: number;
      durationMs: number;
      timestamp: string;
      requestId: string;
    }>;
  } | null>(null);
  const [monitorError, setMonitorError] = useState<string>();
  const [monitorLoading, setMonitorLoading] = useState(false);
  const [factorLibrary, setFactorLibrary] = useState<{
    factors: Array<{
      id: string;
      group: string;
      name: string;
      description: string;
      scenarioUse: string;
      defaultWeight: number;
    }>;
    frameworkVersion: string;
  } | null>(null);
  const [notebookCatalog, setNotebookCatalog] = useState<{
    templates: Array<{
      id: string;
      title: string;
      cells: Array<{
        kind: string;
        title: string;
        body: string;
      }>;
    }>;
  } | null>(null);
  const [framework, setFramework] = useState<{
    version: string;
    stages: string[];
    factorGroups: string[];
    outputs: string[];
    safeguards: string[];
  } | null>(null);
  const [overviewError, setOverviewError] = useState<string>();

  const [signalStrategyText, setSignalStrategyText] = useState(toPrettyJson(
    STRATEGY_TEMPLATES[0].strategy,
  ));
  const [signalPricesText, setSignalPricesText] = useState('');
  const [signalSteps, setSignalSteps] = useState('3');
  const [signalResult, setSignalResult] = useState<string>();
  const [signalLoading, setSignalLoading] = useState(false);
  const [signalLive, setSignalLive] = useState(false);
  const [signalError, setSignalError] = useState<string>();
  const [signalHistory, setSignalHistory] = useState<Array<{
    signal: 'long' | 'short' | 'hold' | 'flat';
    position: 'long' | 'short' | 'flat';
    equity: number;
    totalTrades: number;
    timestamp: string;
  }>>([]);

  const [sandboxStrategyText, setSandboxStrategyText] = useState(toPrettyJson(
    STRATEGY_TEMPLATES[1].strategy,
  ));
  const [sandboxPricesText, setSandboxPricesText] = useState('');
  const [sandboxMaxBars, setSandboxMaxBars] = useState('240');
  const [sandboxStep, setSandboxStep] = useState('3');
  const [sandboxSessionId, setSandboxSessionId] = useState<string>();
  const [sandboxList, setSandboxList] = useState<Array<{
    id: string;
    strategyId: string;
    strategyName: string;
    symbol: string;
    timeframe: string;
    status: string;
    currentIndex: number;
    totalBars: number;
    lastUpdatedAt: string;
    createdAt: string;
  }>>([]);
  const [sandboxSession, setSandboxSession] = useState<{
    id: string;
    strategyName: string;
    symbol: string;
    timeframe: string;
    status: string;
    currentIndex: number;
    totalBars: number;
    signal: 'long' | 'short' | 'hold';
    position: 'long' | 'short' | 'flat';
    equity: number;
    totalTrades: number;
    turnoverPct: number;
    feeCostPct: number;
    slippageCostPct: number;
    latestNotes: string[];
    history: Array<{
      index: number;
      time: string;
      signal: 'long' | 'short' | 'hold';
      position: 'long' | 'short' | 'flat';
      equity: number;
      totalTrades: number;
      turnoverPct: number;
      feeCostPct: number;
      slippageCostPct: number;
    }>;
    updatedAt?: string;
    createdAt?: string;
  } | null>(null);
  const [sandboxLoading, setSandboxLoading] = useState(false);
  const [sandboxError, setSandboxError] = useState<string>();

  const [onchainSymbol, setOnchainSymbol] = useState('BTCUSDT');
  const [onchainTimeframe, setOnchainTimeframe] = useState<'1h' | '4h' | '1d' | '12h'>('1h');
  const [onchainLoading, setOnchainLoading] = useState(false);
  const [onchainError, setOnchainError] = useState<string>();
  const [onchainData, setOnchainData] = useState<{
    symbol: string;
    timeframe: string;
    asOf: string;
    onChainFlowUsd: number;
    spotVolumeUsd: number;
    perpsOpenInterestUsd: number;
    fundingRate: number;
    liquidationsUsd: number;
    metrics: {
      flowPressure: {
        onChainFlowUsd: number;
        spotVolumeUsd: number;
        perpsOpenInterestUsd: number;
        fundingRate: number;
        liquidationsUsd: number;
      };
      liquidityPressure: {
        bidAskSpreadBps: number;
        whaleOrderDepthUsd: number;
        borrowRate: number;
      };
      riskSignals: {
        squeezeRisk: number;
        liquidationRisk: number;
        momentumSkew: number;
      };
    };
  } | null>(null);

  const isMonitoring = client.apiCallMonitor !== undefined;
  const hasPaperSignal = client.paperSignal !== undefined;

  const signalTemplateStrategy = useMemo(() => {
    try {
      return normalizeStrategy(signalStrategyText);
    } catch {
      return STRATEGY_TEMPLATES[0].strategy;
    }
  }, [signalStrategyText]);

  const sandboxTemplateStrategy = useMemo(() => {
    try {
      return normalizeStrategy(sandboxStrategyText);
    } catch {
      return STRATEGY_TEMPLATES[1].strategy;
    }
  }, [sandboxStrategyText]);

  async function refreshOverview() {
    if (!client.factors || !client.notebooks || !client.multiFactorFramework) {
      return;
    }
    setOverviewError(undefined);
    try {
      const [factors, notebooks, frameworkResponse] = await Promise.all([
        client.factors(),
        client.notebooks(),
        client.multiFactorFramework(),
      ]);
      setFactorLibrary(factors.data);
      setNotebookCatalog(notebooks.data);
      setFramework(frameworkResponse.data);
    } catch {
      setOverviewError('Failed to load research assets.');
    }
  }

  async function refreshMonitor() {
    if (!isMonitoring || !client.apiCallMonitor) {
      setMonitorError('API monitor is unavailable on this endpoint.');
      return;
    }
    setMonitorLoading(true);
    setMonitorError(undefined);
    try {
      const limit = parseInteger(monitorLimit, 1, 500);
      const response = await client.apiCallMonitor(limit);
      setMonitorData(response.data);
    } catch (reason) {
      setMonitorError(
        reason instanceof Error ? reason.message : 'Failed to refresh monitor.',
      );
    } finally {
      setMonitorLoading(false);
    }
  }

  async function refreshOnchain() {
    setOnchainLoading(true);
    setOnchainError(undefined);
    try {
      const response = await client.onChainDashboard({
        symbol: onchainSymbol,
        timeframe: onchainTimeframe,
      });
      setOnchainData(normalizeOnchainDashboard(response.data));
    } catch (reason) {
      setOnchainError(
        reason instanceof Error ? reason.message : 'Failed to load on-chain metrics.',
      );
    } finally {
      setOnchainLoading(false);
    }
  }

  async function refreshSandboxList() {
    if (!client.listPaperSandboxes) {
      return;
    }
    try {
      const response = await client.listPaperSandboxes();
      setSandboxList(response.data.sessions);
    } catch (error) {
      setSandboxError(
        error instanceof Error ? error.message : 'Unable to list paper sessions.',
      );
    }
  }

  async function runSignal() {
    if (!hasPaperSignal || !client.paperSignal) {
      setSignalError('Paper signal endpoint is unavailable.');
      return;
    }
    setSignalLoading(true);
    setSignalError(undefined);
    try {
      const strategy = normalizeStrategy(signalStrategyText);
      const prices = parsePriceInput(signalPricesText);
      const response = await client.paperSignal({
        strategy,
        prices,
      });
      const payload = response.data;
      setSignalResult(toPrettyJson(response.data));
      setSignalHistory(history => [{
        signal: payload.latestSignal,
        position: payload.simulatedPosition,
        equity: payload.paperEquity,
        totalTrades: payload.totalTrades,
        timestamp: payload.lastUpdatedAt,
      }, ...history].slice(0, 20));
    } catch (error) {
      setSignalError(
        error instanceof Error ? error.message : 'Paper signal request failed.',
      );
    } finally {
      setSignalLoading(false);
    }
  }

  async function runSignalLiveStep() {
    if (!hasPaperSignal || !client.paperSignal) {
      return;
    }
    try {
      const strategy = normalizeStrategy(signalStrategyText);
      const basePrices = parsePriceInput(signalPricesText)
        ?? [100, 101, 102, 103, 104];
      const generated = enrichSignalSeries({
        prices: basePrices,
        symbol: strategy.universe[0],
      });
      const response = await client.paperSignal({
        strategy,
        prices: generated,
      });
      setSignalPricesText(toPrettyJson(generated));
      const payload = response.data;
      setSignalHistory(history => [{
        signal: payload.latestSignal,
        position: payload.simulatedPosition,
        equity: payload.paperEquity,
        totalTrades: payload.totalTrades,
        timestamp: payload.lastUpdatedAt,
      }, ...history].slice(0, 20));
      setSignalResult(toPrettyJson(response.data));
    } catch {
      // silence during background tracking unless user sees error already
    }
  }

  async function createSandboxSession() {
    setSandboxLoading(true);
    setSandboxError(undefined);
    try {
      const strategy = normalizeStrategy(sandboxStrategyText);
      const maxBars = parseInteger(sandboxMaxBars, 50, 1000);
      const prices = parsePriceInput(sandboxPricesText);
      const response = await client.createPaperSandbox({
        strategy,
        prices,
        maxBars,
      });
      const session = response.data.session;
      setSandboxSessionId(session.id);
      setSandboxSession(session as never);
      await refreshSandboxList();
      setSignalStrategyText(toPrettyJson(strategy));
    } catch (error) {
      setSandboxError(
        error instanceof Error ? error.message : 'Failed to create paper session.',
      );
    } finally {
      setSandboxLoading(false);
    }
  }

  async function stepSandbox() {
    if (!sandboxSessionId) {
      setSandboxError('No session selected.');
      return;
    }
    setSandboxLoading(true);
    setSandboxError(undefined);
    try {
      const steps = parseInteger(sandboxStep, 1, 100);
      const response = await client.stepPaperSandbox(sandboxSessionId, {
        steps,
      });
      setSandboxSession(response.data);
      await refreshSandboxList();
      const strategy: DiagnoseRequest['strategy'] = normalizeStrategy(sandboxStrategyText);
      setSignalStrategyText(toPrettyJson(strategy));
    } catch (error) {
      setSandboxError(
        error instanceof Error ? error.message : 'Failed to step paper session.',
      );
    } finally {
      setSandboxLoading(false);
    }
  }

  async function closeSandbox(sessionId: string) {
    setSandboxLoading(true);
    setSandboxError(undefined);
    try {
      await client.closePaperSandbox(sessionId);
      if (sandboxSessionId === sessionId) {
        setSandboxSessionId(undefined);
        setSandboxSession(null);
      }
      await refreshSandboxList();
    } catch (error) {
      setSandboxError(
        error instanceof Error ? error.message : 'Failed to close session.',
      );
    } finally {
      setSandboxLoading(false);
    }
  }

  async function loadSandboxSession(sessionId: string) {
    if (!client.getPaperSandbox) {
      return;
    }
    setSandboxLoading(true);
    setSandboxError(undefined);
    try {
      const response = await client.getPaperSandbox(sessionId);
      setSandboxSessionId(sessionId);
      setSandboxSession(response.data);
    } catch (error) {
      setSandboxError(
        error instanceof Error ? error.message : 'Cannot load session details.',
      );
    } finally {
      setSandboxLoading(false);
    }
  }

  function exportEvidencePack() {
    const payload = {
      generatedAt: new Date().toISOString(),
      overview: {
        factorCount: factorLibrary?.factors.length ?? 0,
        notebookCount: notebookCatalog?.templates.length ?? 0,
      },
      monitor: monitorData,
      signal: signalResult ? JSON.parse(signalResult) : null,
      sandbox: sandboxSession,
      onchain: onchainData,
      strategySignalText: signalStrategyText,
      strategySandboxText: sandboxStrategyText,
    };
    downloadText('research-evidence.json', JSON.stringify(payload, null, 2));
  }

  useEffect(() => {
    if (client.factors && client.notebooks && client.multiFactorFramework) {
      void refreshOverview();
    }
    void refreshMonitor();
    void refreshOnchain();
    void refreshSandboxList();
  }, []);

  useEffect(() => {
    if (!signalLive || !hasPaperSignal) {
      return;
    }
    const stepMs = Number(monitorRefreshMs);
    const resolved = Number.isFinite(stepMs) && stepMs > 500 ? stepMs : 6000;
    const timer = setInterval(() => {
      void runSignalLiveStep();
    }, resolved);
    return () => {
      clearInterval(timer);
    };
  }, [signalLive, monitorRefreshMs, signalPricesText, hasPaperSignal, signalStrategyText]);

  useEffect(() => {
    if (!isMonitoring || !client.apiCallMonitor) {
      return;
    }
    const intervalMs = Number.parseInt(monitorRefreshMs, 10);
    const resolved = Number.isFinite(intervalMs) ? Math.max(3000, intervalMs) : 8000;
    const timer = setInterval(() => {
      void refreshMonitor();
    }, resolved);
    return () => clearInterval(timer);
  }, [monitorRefreshMs, isMonitoring]);

  const summaryLines = useMemo(() => {
    const lines: string[] = [];
    if (factorLibrary) {
      lines.push(`Factors: ${factorLibrary.factors.length} (${factorLibrary.frameworkVersion})`);
    }
    if (notebookCatalog) {
      lines.push(`Notebooks: ${notebookCatalog.templates.length}`);
    }
    if (framework) {
      lines.push(`Framework: ${framework.outputs.length} outputs`);
    }
    if (sandboxSession) {
      lines.push(`Active session: ${sandboxSession.status} (${sandboxSession.id})`);
    }
    if (monitorData) {
      lines.push(
        `API calls: ${monitorData.totalCalls} total / ${formatNumber(
          monitorData.successRate,
          2,
        )}% success`,
      );
    }
    if (onchainData) {
      lines.push(`On-chain: ${onchainData.symbol}/${onchainData.timeframe}`);
    }
    return lines;
  }, [factorLibrary, notebookCatalog, framework, sandboxSession, monitorData, onchainData]);

  return (
    <section className="research-shell" aria-label="Research center">
      <div className="workspace-nav">
        <div>
          {onBack ? (
            <button
              type="button"
              className="ghost-action"
              onClick={onBack}
            >
              <ArrowLeft aria-hidden="true" />
              Back
            </button>
          ) : null}
          <button
            type="button"
            className="secondary-action"
            onClick={exportEvidencePack}
          >
            <FileJson aria-hidden="true" />
            Export research evidence
          </button>
        </div>
      </div>
      <section className="chart-panel" aria-label="Research quick metrics">
        <div className="chart-heading">
          <div>
            <p className="eyebrow">C research cockpit</p>
            <h1>Research center</h1>
            <p>
              A production-like workbench for API telemetry, paper trading
              simulation, on-chain risk signals, and factor-based diagnostics.
            </p>
          </div>
          <div className="toolbar">
            <span className="section-subtitle">
              Last refresh: {new Date().toLocaleTimeString()}
            </span>
          </div>
        </div>
        <div className="research-summary">
          {summaryLines.length > 0 ? (
            <ul className="summary-grid">
              {summaryLines.map(line => (
                <li key={line} className="summary-card">
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <nav className="workspace-nav" aria-label="Research tabs">
          {([
            'overview',
            'signal',
            'sandbox',
            'monitor',
            'onchain',
            'library',
          ] as const).map(tab => (
            <button
              key={tab}
              type="button"
              className={activeTab === tab ? 'primary-action' : undefined}
              onClick={() => setActiveTab(tab)}
              aria-current={activeTab === tab ? 'page' : undefined}
            >
              {tab === 'overview' ? 'Overview' : null}
              {tab === 'signal' ? 'Paper signal lane' : null}
              {tab === 'sandbox' ? 'Paper sandbox' : null}
              {tab === 'monitor' ? 'API monitor' : null}
              {tab === 'onchain' ? 'On-chain board' : null}
              {tab === 'library' ? 'Factors / notebooks' : null}
            </button>
          ))}
        </nav>
      </section>

      {activeTab === 'overview' ? (
        <section className="analysis-overview" aria-label="Research overview">
          {overviewError ? (
            <p role="alert">{overviewError}</p>
          ) : null}
          <div className="risk-dashboard-grid">
            <article className="risk-dashboard-card">
              <span>Research modules</span>
              <strong>
                {factorLibrary ? `Loaded ${factorLibrary.factors.length}` : 'Waiting for load'}
              </strong>
              <small>Factor library & framework metadata</small>
            </article>
            <article className="risk-dashboard-card">
              <span>Paper sandbox sessions</span>
              <strong>{sandboxList.length}</strong>
              <small>Active paper simulation sessions</small>
            </article>
            <article className="risk-dashboard-card">
              <span>API telemetry</span>
              <strong>
                {monitorData ? `${monitorData.totalCalls} calls` : 'Not polled'}
              </strong>
              <small>Auth-safe and timestamped</small>
            </article>
            <article className="risk-dashboard-card">
              <span>Notebook templates</span>
              <strong>
                {notebookCatalog ? `${notebookCatalog.templates.length} templates` : 'Not loaded'}
              </strong>
              <small>Play-ready research workflows</small>
            </article>
          </div>
          <div className="toolbar">
            <button
              type="button"
              className="secondary-action"
              onClick={() => {
                setActiveTab('signal');
              }}
            >
              <BotMessageSquare aria-hidden="true" />
              Open live signal lane
            </button>
            <button
              type="button"
              className="secondary-action"
              onClick={() => {
                setActiveTab('sandbox');
              }}
            >
              <Target aria-hidden="true" />
              Open sandbox lane
            </button>
            <button
              type="button"
              className="secondary-action"
              onClick={() => {
                setActiveTab('monitor');
              }}
            >
              <ServerCog aria-hidden="true" />
              Open API monitor
            </button>
          </div>
        </section>
      ) : null}

      {activeTab === 'signal' ? (
        <section className="analysis-overview" aria-label="Paper signal monitoring">
          <div className="chart-heading">
            <div>
              <p className="eyebrow">Paper Signal</p>
              <h2>Read-only strategy tracking</h2>
              <p>
                Feed a strategy and optional price list to inspect live decision
                snapshots before any deployment handoff.
              </p>
            </div>
            <div className="toolbar">
              <button
                type="button"
                className="secondary-action"
                onClick={() => {
                  setSignalStrategyText(toPrettyJson(
                    STRATEGY_TEMPLATES[0].strategy,
                  ));
                  setSignalPricesText('');
                }}
              >
                <Sparkles aria-hidden="true" />
                Reset template
              </button>
              <button
                type="button"
                className="secondary-action"
                onClick={() => {
                  const random = randomStrategyDraft();
                  setSignalStrategyText(toPrettyJson(random.strategy));
                }}
              >
                <CalendarClock aria-hidden="true" />
                Random strategy
              </button>
            </div>
          </div>
          <div className="workshop-grid">
            <label htmlFor="signal-strategy">
              Strategy JSON
              <textarea
                id="signal-strategy"
                rows={10}
                value={signalStrategyText}
                onChange={event => setSignalStrategyText(event.target.value)}
              />
            </label>
            <label htmlFor="signal-prices">
              Price input (optional, comma/space separated)
              <textarea
                id="signal-prices"
                rows={3}
                value={signalPricesText}
                onChange={event => setSignalPricesText(event.target.value)}
                placeholder="101, 102, 103, 104, ... (optional)"
              />
            </label>
            <label htmlFor="signal-steps">
              Track refresh interval (ms)
              <select
                id="signal-steps"
                value={signalSteps}
                onChange={event => setSignalSteps(event.target.value)}
              >
                <option value="3">Short (3s)</option>
                <option value="5">Medium (5s)</option>
                <option value="8">Long (8s)</option>
              </select>
            </label>
          </div>
          <div className="toolbar">
            <button
              type="button"
              className="secondary-action"
              onClick={() => {
                setSignalLive(false);
                void runSignal();
              }}
              disabled={signalLoading}
            >
              <Search aria-hidden="true" />
              {signalLoading ? 'Running signal...' : 'Run once'}
            </button>
            <button
              type="button"
              className={signalLive ? 'secondary-action' : 'primary-action'}
              onClick={() => setSignalLive(current => !current)}
            >
              <Activity aria-hidden="true" />
              {signalLive ? 'Pause live lane' : 'Start live lane'}
            </button>
          </div>
          {signalError ? <p role="alert">{signalError}</p> : null}
          {signalHistory.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th>Latest signal</th>
                  <th>Position</th>
                  <th>Equity</th>
                  <th>Trades</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {signalHistory.map(item => (
                  <tr key={`${item.timestamp}-${item.signal}`}>
                    <td>{item.signal}</td>
                    <td>{item.position}</td>
                    <td>{formatNumber(item.equity, 6)}</td>
                    <td>{item.totalTrades}</td>
                    <td>{item.timestamp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
          {signalResult ? (
            <pre>{signalResult}</pre>
          ) : null}
        </section>
      ) : null}

      {activeTab === 'sandbox' ? (
        <section className="analysis-overview" aria-label="Paper sandbox">
          <div className="chart-heading">
            <div>
              <p className="eyebrow">Paper sandbox</p>
              <h2>Simulate strategy execution</h2>
              <p>
                Step through a synthetic trading path, inspect fills, costs, and
                equity evolution, and keep sessions for comparison.
              </p>
            </div>
            <div className="toolbar">
              <button
                type="button"
                className="secondary-action"
                onClick={() => {
                  setSandboxStrategyText(toPrettyJson(
                    STRATEGY_TEMPLATES[1].strategy,
                  ));
                }}
              >
                <Sparkles aria-hidden="true" />
                Load preset
              </button>
              <button
                type="button"
                className="secondary-action"
                onClick={() => {
                  const random = randomStrategyDraft();
                  setSandboxStrategyText(toPrettyJson(random.strategy));
                  setSandboxPricesText('');
                  setSandboxMaxBars('240');
                }}
              >
                <CircleDashed aria-hidden="true" />
                Random sandbox strategy
              </button>
            </div>
          </div>

          <label htmlFor="sandbox-strategy">
            Strategy JSON
            <textarea
              id="sandbox-strategy"
              rows={10}
              value={sandboxStrategyText}
              onChange={event => setSandboxStrategyText(event.target.value)}
            />
          </label>
          <div className="workshop-grid">
            <label htmlFor="sandbox-prices">
              Synthetic prices (optional)
              <textarea
                id="sandbox-prices"
                rows={4}
                value={sandboxPricesText}
                onChange={event => setSandboxPricesText(event.target.value)}
              />
            </label>
            <label htmlFor="sandbox-bars">
              Max bars
              <input
                id="sandbox-bars"
                type="number"
                min="50"
                max="1000"
                value={sandboxMaxBars}
                onChange={event => setSandboxMaxBars(event.target.value)}
              />
            </label>
            <label htmlFor="sandbox-step">
              Steps per click
              <input
                id="sandbox-step"
                type="number"
                min="1"
                max="100"
                value={sandboxStep}
                onChange={event => setSandboxStep(event.target.value)}
              />
            </label>
          </div>
          <div className="toolbar">
            <button
              type="button"
              className="primary-action"
              onClick={createSandboxSession}
              disabled={sandboxLoading}
            >
              <Sparkles aria-hidden="true" />
              {sandboxLoading ? 'Starting...' : 'Create paper session'}
            </button>
            <button
              type="button"
              className="secondary-action"
              onClick={stepSandbox}
              disabled={sandboxLoading || !sandboxSessionId}
            >
              <RefreshCw aria-hidden="true" />
              Step session
            </button>
            {sandboxSessionId ? (
              <button
                type="button"
                className="danger-action"
                onClick={() => closeSandbox(sandboxSessionId)}
                disabled={sandboxLoading}
              >
                <Trash2 aria-hidden="true" />
                Close selected
              </button>
            ) : null}
          </div>
          {sandboxError ? <p role="alert">{sandboxError}</p> : null}
          <div className="risk-dashboard-grid">
            <div className="risk-dashboard-card">
              <span>Active sessions</span>
              <strong>{sandboxList.length}</strong>
              <small>use load to inspect state</small>
            </div>
            <div className="risk-dashboard-card">
              <span>Current session</span>
              <strong>{sandboxSession?.id ?? 'none'}</strong>
              <small>
                {sandboxSession
                  ? `${sandboxSession.currentIndex} / ${sandboxSession.totalBars}`
                  : 'no active session'}
              </small>
            </div>
          </div>
          {sandboxSession ? (
            <section className="chart-panel" aria-label="Active sandbox details">
              <div className="chart-heading">
                <h3>{sandboxSession.strategyName}</h3>
                <span>
                  {sandboxSession.symbol} · {sandboxSession.timeframe} ·
                  {sandboxSession.status}
                </span>
              </div>
              <pre>{toPrettyJson(sandboxSession)}</pre>
            </section>
          ) : null}
          {sandboxList.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Symbol</th>
                  <th>Frame</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {sandboxList.map(item => (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td>{item.symbol}</td>
                    <td>
                      {item.currentIndex}
                      /
                      {item.totalBars}
                    </td>
                    <td>{item.status}</td>
                    <td>
                      <button
                        type="button"
                        className="secondary-action"
                        onClick={() => void loadSandboxSession(item.id)}
                      >
                        load
                      </button>
                      <button
                        type="button"
                        className="danger-action"
                        onClick={() => void closeSandbox(item.id)}
                      >
                        <Trash2 aria-hidden="true" />
                        remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>
      ) : null}

      {activeTab === 'monitor' ? (
        <section className="analysis-overview" aria-label="API monitor">
          <div className="chart-heading">
            <div>
              <p className="eyebrow">API call telemetry</p>
              <h2>Live request quality</h2>
            </div>
            <div className="toolbar">
              <label htmlFor="monitor-limit">
                Monitor limit
                <input
                  id="monitor-limit"
                  type="number"
                  min="1"
                  max="500"
                  value={monitorLimit}
                  onChange={event => setMonitorLimit(event.target.value)}
                />
              </label>
              <label htmlFor="monitor-interval">
                Refresh interval (ms)
                <select
                  id="monitor-interval"
                  value={monitorRefreshMs}
                  onChange={event => setMonitorRefreshMs(event.target.value)}
                >
                  <option value="4000">4</option>
                  <option value="8000">8</option>
                  <option value="12000">12</option>
                </select>
              </label>
            </div>
          </div>
          <div className="toolbar">
            <button
              type="button"
              className="primary-action"
              onClick={refreshMonitor}
              disabled={monitorLoading}
            >
              <ServerCog aria-hidden="true" />
              {monitorLoading ? 'Refreshing...' : 'Refresh now'}
            </button>
          </div>
          {monitorError ? <p role="alert">{monitorError}</p> : null}
          {monitorData ? (
            <div className="analysis-overview">
              <p>
                Total calls:
                {' '}
                {monitorData.totalCalls}
              </p>
              <p>
                Total errors:
                {' '}
                {monitorData.totalErrors}
              </p>
              <p>
                Success:
                {' '}
                {formatNumber(monitorData.successRate, 2)}
                %
              </p>
            </div>
          ) : null}
          {monitorData ? (
            <>
              <h3>Top routes</h3>
              <table>
                <thead>
                  <tr>
                    <th>Path</th>
                    <th>Calls</th>
                    <th>Errors</th>
                    <th>Avg ms</th>
                    <th>Success</th>
                  </tr>
                </thead>
                <tbody>
                  {monitorData.topPaths.map(item => (
                    <tr key={item.path}>
                      <td>{item.path}</td>
                      <td>{item.count}</td>
                      <td>{item.errorCount}</td>
                      <td>{formatNumber(item.avgDurationMs, 2)}</td>
                      <td>{formatNumber(item.successRate, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <h3>Recent calls</h3>
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Method</th>
                    <th>Path</th>
                    <th>Status</th>
                    <th>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {monitorData.recent.map(entry => (
                    <tr key={entry.id}>
                      <td>{entry.timestamp}</td>
                      <td>{entry.method}</td>
                      <td>{entry.path}</td>
                      <td>{entry.statusCode}</td>
                      <td>{formatNumber(entry.durationMs, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : null}
        </section>
      ) : null}

      {activeTab === 'onchain' ? (
        <section className="analysis-overview" aria-label="On-chain dashboard">
          <div className="chart-heading">
            <div>
              <p className="eyebrow">On-chain signals</p>
              <h2>Market structure and risk state</h2>
            </div>
            <div className="toolbar">
              <label htmlFor="onchain-symbol">
                Symbol
                <select
                  id="onchain-symbol"
                  value={onchainSymbol}
                  onChange={event => setOnchainSymbol(event.target.value)}
                >
                  {SAMPLE_SYMBOLS.map(symbol => (
                    <option key={symbol} value={symbol}>
                      {symbol}
                    </option>
                  ))}
                </select>
              </label>
              <label htmlFor="onchain-timeframe">
                Timeframe
                <select
                  id="onchain-timeframe"
                  value={onchainTimeframe}
                  onChange={event => setOnchainTimeframe(
                    event.target.value as typeof onchainTimeframe,
                  )}
                >
                  {SAMPLE_TIMEFRAMES.map(timeframe => (
                    <option key={timeframe} value={timeframe}>
                      {timeframe}
                    </option>
                  ))}
                  <option value="12h">12h</option>
                </select>
              </label>
              <button
                type="button"
                className="primary-action"
                onClick={refreshOnchain}
                disabled={onchainLoading}
              >
                <RefreshCw aria-hidden="true" />
                {onchainLoading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>
          {onchainError ? <p role="alert">{onchainError}</p> : null}
          {onchainData ? (
            <div className="risk-dashboard-grid">
              <div className="risk-dashboard-card">
                <span>On-chain flow</span>
                <strong>{formatNumber(onchainData.onChainFlowUsd, 2)}</strong>
              </div>
              <div className="risk-dashboard-card">
                <span>Spot volume</span>
                <strong>{formatNumber(onchainData.spotVolumeUsd, 2)}</strong>
              </div>
              <div className="risk-dashboard-card">
                <span>Perps OI</span>
                <strong>{formatNumber(onchainData.perpsOpenInterestUsd, 2)}</strong>
              </div>
              <div className="risk-dashboard-card">
                <span>Fund rate</span>
                <strong>{onchainData.fundingRate.toFixed(4)}</strong>
              </div>
            </div>
          ) : null}
          {onchainData ? (
            <pre>{toPrettyJson(onchainData)}</pre>
          ) : null}
          <div className="toolbar">
            <button
              type="button"
              className="secondary-action"
              onClick={() => {
                if (onchainData) {
                  downloadText(
                    `onchain-${onchainSymbol.toLowerCase()}-${onchainTimeframe}.json`,
                    toPrettyJson(onchainData),
                  );
                }
              }}
              disabled={!onchainData}
            >
              <FileJson aria-hidden="true" />
              Export on-chain snapshot
            </button>
          </div>
        </section>
      ) : null}

      {activeTab === 'library' ? (
        <section className="analysis-overview" aria-label="Factors and notebooks">
          <div className="chart-heading">
            <div>
              <p className="eyebrow">Research library</p>
              <h2>Factor map and notebooks</h2>
            </div>
            <div className="toolbar">
              <button
                type="button"
                className="secondary-action"
                onClick={refreshOverview}
                disabled={overviewError !== undefined && false}
              >
                <RefreshCw aria-hidden="true" />
                Reload library
              </button>
            </div>
          </div>
          {factorLibrary && framework ? (
            <>
              <h3>Factor library</h3>
              <p className="eyebrow">Version {factorLibrary.frameworkVersion}</p>
              <div className="risk-dashboard-grid">
                {Object.entries(
                  factorLibrary.factors.reduce<Record<string, number>>((acc, item) => {
                    acc[item.group] = (acc[item.group] ?? 0) + 1;
                    return acc;
                  }, {}),
                ).map(([group, count]) => (
                  <div className="risk-dashboard-card" key={group}>
                    <span>{group}</span>
                    <strong>{count}</strong>
                  </div>
                ))}
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Factor</th>
                    <th>Group</th>
                    <th>Use</th>
                    <th>Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {factorLibrary.factors.map(item => (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td>{item.group}</td>
                      <td>{item.scenarioUse}</td>
                      <td>{formatNumber(item.defaultWeight, 4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <h3>Multi-factor workflow</h3>
              <div className="workshop-grid">
                <div>
                  <p className="eyebrow">Stages</p>
                  <ul>
                    {framework.stages.map(item => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="eyebrow">Safeguards</p>
                  <ul>
                    {framework.safeguards.map(item => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="eyebrow">Outputs</p>
                  <ul>
                    {framework.outputs.map(item => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </>
          ) : null}
          {notebookCatalog ? (
            <>
              <h3>Notebook templates</h3>
              <div className="workshop-grid">
                {notebookCatalog.templates.map(item => (
                  <article className="summary-card" key={item.id}>
                    <p className="eyebrow">{item.id}</p>
                    <strong>{item.title}</strong>
                    <small>
                      {item.cells.length}
                      {' '}
                      cells
                    </small>
                  </article>
                ))}
              </div>
            </>
          ) : null}
          {factorLibrary || notebookCatalog || framework ? null : (
            <p>No research assets available. Refresh to retry.</p>
          )}
        </section>
      ) : null}

      <div className="research-footer">
        <div className="status-row">
          <span><ShieldAlert aria-hidden="true" /> This research plane is deterministic by seed where possible.</span>
          <span><Cpu aria-hidden="true" /> Real-time lane intentionally reads simulation signals only.</span>
          <span><Timer aria-hidden="true" /> Keep intervals within API limits in evaluation mode.</span>
          <button
            type="button"
            className="secondary-action"
            onClick={() => {
              const samples = STRATEGY_TEMPLATES.map(item => item.strategy);
              downloadText('quick-strategy-samples.json', toPrettyJson(samples));
            }}
          >
            <FileJson aria-hidden="true" />
            Export strategy samples
          </button>
        </div>
      </div>
    </section>
  );
}
