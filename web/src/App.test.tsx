import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from './api/types.ts';
import { App } from './App.tsx';
import {
  capabilityFixture,
  diagnosisFixture,
  draftFixture,
} from './test/fixtures.ts';

vi.mock('./charts/EquityComparisonChart.tsx', () => ({
  EquityComparisonChart: () => (
    <div role="img" aria-label="Held-out equity comparison" />
  ),
}));
vi.mock('./charts/DrawdownCurveChart.tsx', () => ({
  DrawdownCurveChart: () => (
    <div role="img" aria-label="Treatment drawdown curve" />
  ),
}));
vi.mock('./charts/ExecutionQualityChart.tsx', () => ({
  ExecutionQualityChart: () => (
    <div role="img" aria-label="Execution cost and turnover" />
  ),
}));
vi.mock('./charts/RiskRadarChart.tsx', () => ({
  RiskRadarChart: () => (
    <div role="img" aria-label="Five-dimension risk radar" />
  ),
}));
vi.mock('./charts/ScenarioTimelineChart.tsx', () => ({
  ScenarioTimelineChart: () => (
    <div role="img" aria-label="Scenario damage timeline" />
  ),
}));
vi.mock('./charts/ParameterChangeChart.tsx', () => ({
  ParameterChangeChart: () => (
    <div role="img" aria-label="Parameter changes" />
  ),
}));

function mockResearchClient(overrides: Partial<ApiClient> = {}): ApiClient {
  let req = 0;
  const envelope = <T,>(data: T) => ({
    apiVersion: 'v1' as const,
    requestId: `req-${req += 1}`,
    data,
  });

  const sandboxSession = {
    id: 'session-0',
    strategyId: 'template-ma',
    strategyName: 'preset',
    symbol: 'BTCUSDT',
    timeframe: '1h',
    status: 'active' as const,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    currentIndex: 0,
    totalBars: 0,
    signal: 'hold' as const,
    position: 'flat' as const,
    equity: 1,
    totalTrades: 0,
    turnoverPct: 0,
    feeCostPct: 0,
    slippageCostPct: 0,
    latestNotes: [],
    history: [],
  };

  return {
    login: vi.fn(async () => undefined),
    logout: vi.fn(async () => undefined),
    capabilities: vi.fn(async () => envelope(capabilityFixture)),
    parse: vi.fn(async () => ({
      apiVersion: 'v1' as const,
      requestId: 'req-parse',
      data: draftFixture,
    })),
    diagnose: vi.fn(async () => ({
      apiVersion: 'v1' as const,
      requestId: 'req-diagnosis',
      data: diagnosisFixture,
    })),
    apiCallMonitor: vi.fn(async () => envelope({
      windowStart: '2026-01-01T00:00:00.000Z',
      windowEnd: '2026-01-01T00:01:00.000Z',
      totalCalls: 0,
      totalErrors: 0,
      successRate: 100,
      topPaths: [],
      recent: [],
    })),
    createPaperSandbox: vi.fn(async () => envelope({
      session: sandboxSession,
    })),
    listPaperSandboxes: vi.fn(async () => envelope({ sessions: [] })),
    getPaperSandbox: vi.fn(async () => envelope(sandboxSession)),
    stepPaperSandbox: vi.fn(async () => envelope({
      ...sandboxSession,
      currentIndex: 1,
      totalBars: 3,
    })),
    closePaperSandbox: vi.fn(async () => envelope({
      id: 'session-0',
      status: 'ended' as const,
    })),
    onChainDashboard: vi.fn(async () => envelope({
      symbol: 'BTCUSDT',
      timeframe: '1h',
      asOf: '2026-01-01T00:00:00.000Z',
      metrics: {
        flowPressure: {
          symbol: 'BTCUSDT',
          timeframe: '1h',
          asOf: '2026-01-01T00:00:00.000Z',
          onChainFlowUsd: 1,
          spotVolumeUsd: 2,
          perpsOpenInterestUsd: 3,
          fundingRate: 0.001,
          liquidationsUsd: 4,
        },
        liquidityPressure: {
          bidAskSpreadBps: 0.1,
          whaleOrderDepthUsd: 1,
          borrowRate: 0.001,
        },
        riskSignals: {
          squeezeRisk: 0.1,
          liquidationRisk: 0.01,
          momentumSkew: 0.02,
        },
      },
    })),
    factors: vi.fn(async () => envelope({ factors: [], frameworkVersion: 'v0' })),
    notebooks: vi.fn(async () => envelope({ templates: [] })),
    multiFactorFramework: vi.fn(async () => envelope({
      version: 'v1',
      stages: [],
      factorGroups: [],
      outputs: [],
      safeguards: [],
    })),
    paperSignal: vi.fn(async () => ({
      apiVersion: 'v1' as const,
      requestId: 'req-paper',
      data: {
        strategyId: 'template-ma',
        symbol: 'BTCUSDT',
        timeframe: '1h',
        latestSignal: 'hold' as const,
        simulatedPosition: 'flat' as const,
        paperEquity: 1,
        totalTrades: 0,
        turnoverPct: 0,
        feeCostPct: 0,
        slippageCostPct: 0,
        lastUpdatedAt: '2026-01-01T00:00:00.000Z',
        notes: [],
      },
    })),
    ...overrides,
  };
}

describe('App workflow', () => {
  it('moves from login to a fully named diagnosis workspace', async () => {
    const client = mockResearchClient({
      parse: vi.fn(async () => ({
        apiVersion: 'v1' as const,
        requestId: 'req-parse',
        data: draftFixture,
      })),
      diagnose: vi.fn(async () => ({
        apiVersion: 'v1' as const,
        requestId: 'req-diagnosis',
        data: diagnosisFixture,
      })),
    });
    const user = userEvent.setup();
    render(<App client={client} />);

    await user.type(screen.getByLabelText('Access code'), 'team-code');
    await user.click(screen.getByRole('button', { name: 'Enter workspace' }));
    await user.type(
      await screen.findByLabelText('Strategy description'),
      'BTC moving average crossover',
    );
    await user.click(screen.getByRole('button', { name: 'Parse strategy' }));
    await user.click(await screen.findByRole('button', {
      name: 'Confirm and diagnose',
    }));

    expect(await screen.findByRole('region', {
      name: 'Diagnosis summary',
    })).toBeTruthy();
    expect(screen.getByRole('region', {
      name: 'Diagnosis charts',
    })).toBeTruthy();
    expect(screen.getByRole('complementary', {
      name: 'Local diagnosis history',
    })).toBeTruthy();
    expect(screen.getByRole('heading', {
      name: 'Reproduce this diagnosis',
    })).toBeTruthy();
    expect(screen.getAllByRole('img')).toHaveLength(6);
  });

  it('sends selected market, timeframe, data source, and candle window', async () => {
    const client = mockResearchClient({
      parse: vi.fn(async () => ({
        apiVersion: 'v1' as const,
        requestId: 'req-parse',
        data: draftFixture,
      })),
      diagnose: vi.fn(async () => ({
        apiVersion: 'v1' as const,
        requestId: 'req-diagnosis',
        data: diagnosisFixture,
      })),
    });
    const user = userEvent.setup();
    render(<App client={client} />);

    await user.type(screen.getByLabelText('Access code'), 'team-code');
    await user.click(screen.getByRole('button', { name: 'Enter workspace' }));
    await user.type(
      await screen.findByLabelText('Strategy description'),
      'BTC moving average crossover',
    );
    await user.click(screen.getByRole('button', { name: 'Parse strategy' }));
    await user.selectOptions(await screen.findByLabelText('Symbol'), 'ETHUSDT');
    await user.selectOptions(screen.getByLabelText('Timeframe'), '4h');
    await user.selectOptions(screen.getByLabelText('Data source'), 'bitget-public');
    await user.clear(screen.getByLabelText('Candles'));
    await user.type(screen.getByLabelText('Candles'), '360');
    await user.type(screen.getByLabelText('Start date'), '2026-01-01');
    await user.type(screen.getByLabelText('End date'), '2026-06-01');
    await user.clear(screen.getByLabelText('Fee rate'));
    await user.type(screen.getByLabelText('Fee rate'), '0.001');
    await user.clear(screen.getByLabelText('Slippage'));
    await user.type(screen.getByLabelText('Slippage'), '0.0007');
    await user.click(screen.getByRole('button', {
      name: 'Confirm and diagnose',
    }));

    expect(client.diagnose).toHaveBeenCalledWith(expect.objectContaining({
      strategy: expect.objectContaining({
        universe: ['ETHUSDT'],
        timeframe: '4h',
        backtest: {
          source: 'bitget-public',
          candleLimit: 360,
          startDate: '2026-01-01',
          endDate: '2026-06-01',
        },
        execution: {
          feeRatePct: 0.001,
          slippagePct: 0.0007,
        },
      }),
    }));
  });

  it('can edit parameters after a result and compare with the original run', async () => {
    const secondDiagnosis = {
      ...diagnosisFixture,
      summary: {
        ...diagnosisFixture.summary,
        riskScore: 55,
        worstDrawdownPct: 0.3,
      },
    };
    const client = mockResearchClient({
      parse: vi.fn(async () => ({
        apiVersion: 'v1' as const,
        requestId: 'req-parse',
        data: draftFixture,
      })),
      diagnose: vi.fn()
        .mockResolvedValueOnce({
          apiVersion: 'v1' as const,
          requestId: 'req-diagnosis-1',
          data: diagnosisFixture,
        })
        .mockResolvedValueOnce({
          apiVersion: 'v1' as const,
          requestId: 'req-diagnosis-2',
          data: secondDiagnosis,
        }),
    });
    const user = userEvent.setup();
    render(<App client={client} />);

    await user.type(screen.getByLabelText('Access code'), 'team-code');
    await user.click(screen.getByRole('button', { name: 'Enter workspace' }));
    await user.type(
      await screen.findByLabelText('Strategy description'),
      'BTC moving average crossover',
    );
    await user.click(screen.getByRole('button', { name: 'Parse strategy' }));
    await user.selectOptions(await screen.findByLabelText('Symbol'), 'ETHUSDT');
    await user.selectOptions(screen.getByLabelText('Timeframe'), '4h');
    await user.selectOptions(screen.getByLabelText('Data source'), 'bitget-public');
    await user.clear(screen.getByLabelText('Candles'));
    await user.type(screen.getByLabelText('Candles'), '360');
    await user.type(screen.getByLabelText('Start date'), '2026-01-01');
    await user.type(screen.getByLabelText('End date'), '2026-06-01');
    await user.click(await screen.findByRole('button', {
      name: 'Confirm and diagnose',
    }));
    await user.click(await screen.findByRole('button', {
      name: 'Edit parameters',
    }));
    await user.clear(await screen.findByLabelText('Leverage'));
    await user.type(screen.getByLabelText('Leverage'), '4');
    await user.click(screen.getByRole('button', {
      name: 'Confirm and diagnose',
    }));

    expect(await screen.findByRole('heading', {
      name: 'Compared with original diagnosis',
    })).toBeTruthy();
    expect(client.diagnose).toHaveBeenCalledTimes(2);
  });
});
