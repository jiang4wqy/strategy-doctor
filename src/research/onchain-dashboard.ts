import type {
  OnChainDashboardRequest,
  OnChainDashboardView,
  OnChainSymbolDashboard,
} from '../platform/contracts.ts';

const KNOWN_SYMBOLS = new Set(['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT']);

function stableString(input: string): number {
  return [...input].reduce((acc, char) => {
    return (acc * 31 + char.charCodeAt(0)) % 1_000_000;
  }, 7);
}

function deterministicUnit(value: string): number {
  const normalized = value.toLowerCase();
  const seed = stableString(normalized);
  const radians = (seed % 360) * Math.PI / 180;
  return Number((0.35 + Math.sin(radians) * 0.25 + 0.5).toFixed(4));
}

function normalizeTimeframe(timeframe: string): string {
  const supported = ['1h', '4h', '1d', '12h'];
  return supported.includes(timeframe) ? timeframe : '1h';
}

function timeframeMultiplier(timeframe: string): number {
  if (timeframe === '1d') {
    return 1.7;
  }
  if (timeframe === '4h') {
    return 1.15;
  }
  if (timeframe === '12h') {
    return 1.35;
  }
  return 1;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function createOnChainDashboardService() {
  function getDashboard(request: OnChainDashboardRequest): OnChainDashboardView {
    const symbol = request.symbol.trim().toUpperCase();
    const normalizedSymbol = KNOWN_SYMBOLS.has(symbol) ? symbol : 'BTCUSDT';
    const timeframe = normalizeTimeframe(request.timeframe);
    const symbolSeed = `${normalizedSymbol}|${timeframe}`;
    const base = stableString(symbolSeed);
    const baseFlow = deterministicUnit(symbolSeed);
    const baseSpread = deterministicUnit(`${symbolSeed}|spread`);
    const baseBorrow = deterministicUnit(`${symbolSeed}|borrow`);
    const baseRisk = deterministicUnit(`${symbolSeed}|risk`);
    const baseLiquid = deterministicUnit(`${symbolSeed}|liquidity`);
    const now = new Date();
    const perpsOpenInterestUsd = clamp(
      250_000_000 + base * timeframeMultiplier(timeframe) * 3_000_000,
      80_000_000,
      950_000_000,
    );
    const spotVolumeUsd = clamp(
      150_000_000 + (baseFlow + 40) * 2_000_000,
      50_000_000,
      900_000_000,
    );
    const onChainFlowUsd = clamp(
      spotVolumeUsd * (0.04 + 0.03 * baseSpread + 0.005 * baseRisk),
      1_000_000,
      30_000_000,
    );
    const fundingRate = clamp(
      Number((0.0002 * clamp(baseFlow % 1, -0.9, 0.9)).toFixed(6)),
      -0.03,
      0.03,
    );
    const liquidationsUsd = clamp(
      onChainFlowUsd * 1.9 + baseRisk * 150_000,
      1_000_000,
      220_000_000,
    );
    const flowPressure: OnChainSymbolDashboard = {
      symbol: normalizedSymbol,
      timeframe,
      asOf: now.toISOString(),
      onChainFlowUsd,
      spotVolumeUsd,
      perpsOpenInterestUsd,
      fundingRate: fundingRate,
      liquidationsUsd,
    };

    return {
      symbol: normalizedSymbol,
      timeframe,
      asOf: now.toISOString(),
      metrics: {
        flowPressure,
        liquidityPressure: {
          bidAskSpreadBps: Number((8 + baseSpread * 5 * timeframeMultiplier(timeframe)).toFixed(2)),
          whaleOrderDepthUsd: clamp(8_000_000 + baseLiquid * 500_000, 1_600_000, 120_000_000),
          borrowRate: Number((0.003 + baseBorrow * 0.004).toFixed(5)),
        },
        riskSignals: {
          squeezeRisk: Number((clamp(baseRisk * 100, 0, 100) * 0.7).toFixed(3)),
          liquidationRisk: Number((clamp(liquidationsUsd / perpsOpenInterestUsd, 0, 2.8) * 60).toFixed(3)),
          momentumSkew: Number((clamp(58 - baseFlow, 0, 100)).toFixed(3)),
        },
      },
    };
  }

  return { getDashboard };
}
