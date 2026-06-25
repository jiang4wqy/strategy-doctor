import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../api/types.ts';
import { draftFixture } from '../test/fixtures.ts';
import { StrategyComposer } from './StrategyComposer.tsx';

function fakeClient(parse: ApiClient['parse']): ApiClient {
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
    login: async () => undefined,
    logout: async () => undefined,
    capabilities: async () => ({
      apiVersion: 'v1',
      requestId: 'req-cap',
      data: [],
    }),
    parse,
    diagnose: async () => {
      throw new Error('not used');
    },
    apiCallMonitor: vi.fn(async () => envelope({
      windowStart: '2026-01-01T00:00:00.000Z',
      windowEnd: '2026-01-01T00:01:00.000Z',
      totalCalls: 0,
      totalErrors: 0,
      successRate: 100,
      topPaths: [],
      recent: [],
    })),
    createPaperSandbox: vi.fn(async () => envelope({ session: sandboxSession })),
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
  };
}

describe('StrategyComposer', () => {
  it('parses a Chinese description without starting diagnosis', async () => {
    const parse = vi.fn(async () => ({
      apiVersion: 'v1' as const,
      requestId: 'req-parse',
      data: draftFixture,
    }));
    const parsed = vi.fn();
    const user = userEvent.setup();
    render(
      <StrategyComposer
        client={fakeClient(parse)}
        description=""
        onDescriptionChange={() => undefined}
        onParsed={parsed}
      />,
    );

    const description = 'BTC moving average, RSI 10 oversold 30 overbought 70';
    await user.type(screen.getByLabelText('Strategy description'), description);
    await user.click(screen.getByRole('button', { name: 'Parse strategy' }));

    expect(parse).toHaveBeenCalledWith(description);
    expect(parsed).toHaveBeenCalledWith(description, draftFixture);
  });

  it('keeps text visible after unsupported parsing', async () => {
    const user = userEvent.setup();
    render(
      <StrategyComposer
        client={fakeClient(async () => {
          throw new Error('Only MA or RSI Bollinger is supported.');
        })}
        description=""
        onDescriptionChange={() => undefined}
        onParsed={() => undefined}
      />,
    );

    const input = screen.getByLabelText(
      'Strategy description',
    ) as HTMLTextAreaElement;
    await user.type(input, 'custom grid strategy');
    await user.click(screen.getByRole('button', { name: 'Parse strategy' }));

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Only MA or RSI Bollinger is supported.',
    );
    expect(input.value).toBe('custom grid strategy');
  });

  it('fills the verified judge demo prompt without starting diagnosis', async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    const parsed = vi.fn();
    render(
      <StrategyComposer
        client={fakeClient(async () => ({
          apiVersion: 'v1' as const,
          requestId: 'req-parse',
          data: draftFixture,
        }))}
        description=""
        onDescriptionChange={changed}
        onParsed={parsed}
      />,
    );

    await user.click(screen.getByRole('button', {
      name: 'Judge demo prompt',
    }));

    expect(screen.getByLabelText('Strategy description')).toHaveProperty(
      'value',
      expect.stringContaining('conservative BTC 4h RSI Bollinger'),
    );
    expect(changed).toHaveBeenCalledWith(
      expect.stringContaining('RSI period: 8'),
    );
    expect(parsed).not.toHaveBeenCalled();
  });
});
