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

describe('App workflow', () => {
  it('moves from login to a fully named diagnosis workspace', async () => {
    const client: ApiClient = {
      login: vi.fn(async () => undefined),
      logout: vi.fn(async () => undefined),
      capabilities: vi.fn(async () => ({
        apiVersion: 'v1' as const,
        requestId: 'req-capabilities',
        data: capabilityFixture,
      })),
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
    };
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
    expect(screen.getAllByRole('img')).toHaveLength(4);
  });

  it('sends selected market, timeframe, data source, and candle window', async () => {
    const client: ApiClient = {
      login: vi.fn(async () => undefined),
      logout: vi.fn(async () => undefined),
      capabilities: vi.fn(async () => ({
        apiVersion: 'v1' as const,
        requestId: 'req-capabilities',
        data: capabilityFixture,
      })),
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
    };
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
    const client: ApiClient = {
      login: vi.fn(async () => undefined),
      logout: vi.fn(async () => undefined),
      capabilities: vi.fn(async () => ({
        apiVersion: 'v1' as const,
        requestId: 'req-capabilities',
        data: capabilityFixture,
      })),
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
    };
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
