import { parseStrategy } from '../strategy/parse.ts';
import { getStrategyAdapter, type AnyStrategyAdapter } from '../strategy/registry.ts';
import { generatePath } from '../backtest/path.ts';
import type {
  PaperSandboxListView,
  PaperSandboxRequest,
  PaperSandboxSessionSummary,
  PaperSandboxSessionView,
  PaperSandboxStatus,
  PaperSignalStepSnapshot,
  PaperSandboxStepRequest,
} from '../platform/contracts.ts';
import type {
  PositionDirection,
  Strategy,
  StrategyDecision,
} from '../contracts.ts';

interface PaperSandboxConfig {
  id: string;
  strategy: Strategy;
  prices: number[];
  status: 'active' | 'ended';
  createdAt: string;
  updatedAt: string;
  currentIndex: number;
  frames: PaperSignalStepSnapshot[];
}

const DEFAULT_MAX_BARS = 240;
const MIN_BARS = 50;
const MAX_BARS = 1000;
const MIN_PRICE = 0.01;

function createFallbackPrices(seed: number, maxBars: number): number[] {
  const shock = {
    kind: 'grind' as const,
    seed,
    magnitude: 0.08,
    durationBars: Math.max(40, Math.floor(maxBars / 2)),
    volMult: 1.15,
  };
  return generatePath(shock, maxBars, 100);
}

function randomSessionId(): string {
  const now = new Date().toISOString().replace(/[-:.TZ]/g, '');
  const random = Math.floor(Math.random() * 10_000_000).toString(16);
  return `paper-${now}-${random}`;
}

function fallbackSymbol(strategy: Strategy): string {
  return strategy.universe[0] ?? 'BTCUSDT';
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value)
    && value.length >= 2
    && value.every(item => typeof item === 'number' && Number.isFinite(item) && item > 0);
}

function normalizeBars(value: unknown): number {
  if (value === undefined) {
    return DEFAULT_MAX_BARS;
  }
  if (
    !Number.isFinite(Number(value))
    || !Number.isInteger(Number(value))
    || Number(value) < MIN_BARS
    || Number(value) > MAX_BARS
  ) {
    throw new Error(`maxBars must be an integer between ${MIN_BARS} and ${MAX_BARS}.`);
  }
  return Number(value);
}

function normalizeStep(value: PaperSandboxStepRequest | undefined): number {
  if (value === undefined || value.steps === undefined) {
    return 1;
  }
  const parsed = Number(value.steps);
  if (
    !Number.isFinite(parsed)
    || !Number.isInteger(parsed)
    || parsed < 1
    || parsed > 100
  ) {
    throw new Error('steps must be an integer from 1 to 100.');
  }
  return parsed;
}

function simulatePaperPath(
  strategy: Strategy,
  prices: number[],
): PaperSignalStepSnapshot[] {
  const { leverage, stopLossPct, positionPct } = strategy.params;
  const feeRatePct = strategy.execution?.feeRatePct ?? 0;
  const slippagePct = strategy.execution?.slippagePct ?? 0;
  const adapter = getStrategyAdapter(strategy.archetype) as AnyStrategyAdapter;

  const frames: PaperSignalStepSnapshot[] = [];
  let equity = 1;
  let direction: PositionDirection = 0;
  let entryPrice = 0;
  let blockedDirection: PositionDirection = 0;
  let liquidated = false;
  let numTrades = 0;
  let turnoverPct = 0;
  let feeCostPct = 0;
  let slippageCostPct = 0;
  const liquidationLine = 0.9 / leverage;
  const noteAt = Date.now();

  function applyExecutionCost(multiplier: number): void {
    if (multiplier <= 0) {
      return;
    }
    const turnover = positionPct * leverage * multiplier;
    turnoverPct += turnover;
    feeCostPct += turnover * feeRatePct;
    slippageCostPct += turnover * slippagePct;
    const cost = turnover * (feeRatePct + slippagePct);
    equity = Math.max(MIN_PRICE / 100, equity * (1 - cost));
  }

  const positionToText = (value: PositionDirection): PaperSignalStepSnapshot['position'] => {
    if (value > 0) {
      return 'long';
    }
    if (value < 0) {
      return 'short';
    }
    return 'flat';
  };

  frames.push({
    index: 0,
    time: new Date(noteAt).toISOString(),
    signal: 'hold',
    position: 'flat',
    equity,
    totalTrades: 0,
    turnoverPct: 0,
    feeCostPct: 0,
    slippageCostPct: 0,
  });

  for (let index = 1; index < prices.length; index++) {
    if (direction !== 0 && !liquidated) {
      const barReturn = direction * (prices[index] / prices[index - 1] - 1);
      const equityChange = Math.max(
        -positionPct,
        barReturn * leverage * positionPct,
      );
      equity = Math.max(MIN_PRICE / 100, equity * (1 + equityChange));

      const excursion = direction * (prices[index] / entryPrice - 1);
      if (excursion <= -liquidationLine) {
        liquidated = true;
        direction = 0;
      } else if (excursion <= -stopLossPct) {
        blockedDirection = direction;
        direction = 0;
      }
    }

    if (equity <= 0.05) {
      liquidated = true;
      direction = 0;
    }

    const decision: StrategyDecision = adapter.decide(
      strategy.params as never,
      {
        prices,
        index,
        position: direction,
        entryPrice,
      },
    );

    let latestSignal: PaperSignalStepSnapshot['signal'] = 'hold';
    if (!liquidated) {
      if (decision === 'flat') {
        latestSignal = 'hold';
        if (direction !== 0) {
          applyExecutionCost(1);
        }
        direction = 0;
        entryPrice = 0;
        blockedDirection = 0;
      } else if (decision === 'long' || decision === 'short') {
        latestSignal = decision;
        const nextDirection: PositionDirection = decision === 'long' ? 1 : -1;
        if (
          nextDirection !== direction
          && nextDirection !== blockedDirection
        ) {
          applyExecutionCost(direction === 0 ? 1 : 2);
          direction = nextDirection;
          entryPrice = prices[index];
          numTrades++;
          blockedDirection = 0;
        }
      }
    }

    const time = new Date(noteAt + index * 60_000).toISOString();
    frames.push({
      index,
      time,
      signal: latestSignal,
      position: positionToText(direction),
      equity,
      totalTrades: numTrades,
      turnoverPct,
      feeCostPct,
      slippageCostPct,
    });
  }

  return frames;
}

function snapshotFromState(config: PaperSandboxConfig): PaperSandboxSessionView {
  const frame = config.frames[config.currentIndex];
  if (!frame) {
    throw new Error('paper session frame missing');
  }
  const { strategy } = config;
  return {
    id: config.id,
    strategyId: strategy.id,
    strategyName: strategy.name,
    symbol: fallbackSymbol(strategy),
    timeframe: strategy.timeframe,
    status: config.status,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
    currentIndex: config.currentIndex,
    totalBars: config.frames.length,
    signal: frame.signal,
    position: frame.position,
    equity: frame.equity,
    totalTrades: frame.totalTrades,
    turnoverPct: frame.turnoverPct,
    feeCostPct: frame.feeCostPct,
    slippageCostPct: frame.slippageCostPct,
    latestNotes: [
      `Session ${config.id} is ${config.status}.`,
      `Current bar index ${config.currentIndex} / ${config.frames.length - 1}.`,
      frame.index === config.frames.length - 1
        ? 'End of synthetic stream reached.'
        : 'Next step available.',
    ],
    history: config.frames.slice(0, config.currentIndex + 1),
  };
}

function sessionSummaryFromState(config: PaperSandboxConfig): PaperSandboxSessionSummary {
  return {
    id: config.id,
    strategyId: config.strategy.id,
    strategyName: config.strategy.name,
    symbol: fallbackSymbol(config.strategy),
    timeframe: config.strategy.timeframe,
    status: config.status,
    currentIndex: config.currentIndex,
    totalBars: config.frames.length,
    lastUpdatedAt: config.updatedAt,
    createdAt: config.createdAt,
  };
}

function parseAndValidatePaperSandboxRequest(
  request: PaperSandboxRequest,
): { strategy: Strategy; prices: number[] } {
  const strategy = parseStrategy(request.strategy);
  if (strategy.universe.length === 0) {
    throw new Error('strategy universe cannot be empty for paper sandbox.');
  }
  const maxBars = normalizeBars(request.maxBars);
  const providedPrices = request.prices !== undefined
    ? request.prices
    : undefined;
  const fallbackSeed = strategy.name
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const prices = (isNumberArray(providedPrices) ? providedPrices : createFallbackPrices(fallbackSeed, maxBars))
    .slice(0, maxBars);
  return {
    strategy,
    prices,
  };
}

export interface PaperSandboxService {
  createSession(request: PaperSandboxRequest): PaperSandboxSessionView;
  listSessions(): PaperSandboxListView;
  getSession(sessionId: string): PaperSandboxSessionView;
  stepSession(sessionId: string, request: PaperSandboxStepRequest): PaperSandboxSessionView;
  closeSession(sessionId: string): PaperSandboxStatus;
}

export function createPaperSandboxService(): PaperSandboxService {
  const sessions = new Map<string, PaperSandboxConfig>();

  return {
    createSession(request: PaperSandboxRequest) {
      const { strategy, prices } = parseAndValidatePaperSandboxRequest(request);
      const normalizedPrices = prices.slice(
        0,
        Math.max(MIN_BARS, Math.min(MAX_BARS, prices.length)),
      );
      const frames = simulatePaperPath(strategy, normalizedPrices);
      const session: PaperSandboxConfig = {
        id: randomSessionId(),
        strategy,
        prices: normalizedPrices,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        currentIndex: 0,
        frames,
      };
      sessions.set(session.id, session);
      return snapshotFromState({
        ...session,
      });
    },
    listSessions() {
      return {
        sessions: [...sessions.values()]
          .map(session => sessionSummaryFromState(session)),
      };
    },
    getSession(sessionId) {
      const session = sessions.get(sessionId);
      if (!session) {
        throw new Error(`paper session ${sessionId} not found`);
      }
      return snapshotFromState(session);
    },
    stepSession(sessionId, request) {
      const session = sessions.get(sessionId);
      if (!session) {
        throw new Error(`paper session ${sessionId} not found`);
      }
      if (session.status !== 'active') {
        return snapshotFromState(session);
      }
      const steps = normalizeStep(request);
      const target = Math.min(
        session.frames.length - 1,
        session.currentIndex + steps,
      );
      session.currentIndex = target;
      if (session.currentIndex >= session.frames.length - 1) {
        session.status = 'ended';
      }
      session.updatedAt = new Date().toISOString();
      return snapshotFromState(session);
    },
    closeSession(sessionId) {
      const existed = sessions.delete(sessionId);
      if (!existed) {
        throw new Error(`paper session ${sessionId} not found`);
      }
      return { id: sessionId, status: 'removed' };
    },
  };
}
