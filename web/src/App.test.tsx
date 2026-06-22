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
  it('renders a public no-login showcase route', async () => {
    window.history.pushState({}, '', '/showcase');

    render(<App />);

    expect(screen.getByRole('heading', {
      name: 'Strategy Doctor public showcase',
    })).toBeTruthy();
    expect(screen.getByText('269 passed / 2 skipped')).toBeTruthy();
    expect(screen.getByRole('region', {
      name: 'Submission evidence chain',
    })).toBeTruthy();
    expect(screen.getByRole('heading', {
      name: 'From public demo to reproducible API calls',
    })).toBeTruthy();
    expect(screen.getByText('8 REST calls + 4 reproducible diagnoses')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Judge summary' })).toBeTruthy();
    expect(screen.getByText('Playbook pre-publication risk auditor')).toBeTruthy();
    expect(screen.getByRole('region', {
      name: 'Strategy comparison',
    })).toBeTruthy();
    expect(screen.getByRole('button', {
      name: 'MA trend follower',
      pressed: true,
    })).toBeTruthy();
    expect(screen.getByRole('button', {
      name: 'RSI/Bollinger mean reversion',
    })).toBeTruthy();
    expect(screen.getByRole('button', {
      name: 'Confirmed breakout',
    })).toBeTruthy();
    expect(screen.getByRole('button', {
      name: 'ATR trend breakout',
    })).toBeTruthy();
    expect(screen.getByRole('heading', {
      name: 'Four archetypes, one risk contract',
    })).toBeTruthy();
    expect(screen.getByText('api:check verifies health, capabilities, OpenAPI')).toBeTruthy();
    expect(await screen.findByRole('region', {
      name: 'Diagnosis summary',
    })).toBeTruthy();
    expect(await screen.findByRole('region', {
      name: 'Playbook readiness',
    })).toBeTruthy();
    expect(screen.queryByLabelText('Access code')).toBeNull();

    window.history.pushState({}, '', '/');
  });

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
      name: 'Playbook readiness',
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
});
