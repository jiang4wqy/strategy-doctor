import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  diagnosisFixture,
  requestFixture,
} from '../test/fixtures.ts';
import { DiagnosisWorkspace } from './DiagnosisWorkspace.tsx';

vi.mock('../charts/EquityComparisonChart.tsx', () => ({
  EquityComparisonChart: () => (
    <div role="img" aria-label="Held-out equity comparison" />
  ),
}));
vi.mock('../charts/RiskRadarChart.tsx', () => ({
  RiskRadarChart: () => (
    <div role="img" aria-label="Five-dimension risk radar" />
  ),
}));
vi.mock('../charts/ScenarioTimelineChart.tsx', () => ({
  ScenarioTimelineChart: () => (
    <div role="img" aria-label="Scenario damage timeline" />
  ),
}));
vi.mock('../charts/ParameterChangeChart.tsx', () => ({
  ParameterChangeChart: () => (
    <div role="img" aria-label="Parameter changes" />
  ),
}));

describe('DiagnosisWorkspace', () => {
  it('renders summary, charts, scenarios, prescription, and developer details', () => {
    render(
      <DiagnosisWorkspace
        request={requestFixture}
        requestId="req-workspace"
        view={diagnosisFixture}
      />,
    );

    expect(screen.getByText('42')).toBeTruthy();
    expect(screen.getByText('42.0%')).toBeTruthy();
    expect(screen.getByText('27')).toBeTruthy();
    expect(screen.getByText('+12')).toBeTruthy();
    expect(screen.getByText('-2.0%')).toBeTruthy();
    expect(screen.getAllByRole('img')).toHaveLength(4);
    expect(screen.getAllByTestId('scenario-row')).toHaveLength(5);
    expect(screen.getByText(
      'Lower leverage and tighten the stop loss.',
    )).toBeTruthy();
    expect(screen.getByText('Confirmed Strategy JSON')).toBeTruthy();
    expect(screen.getByText('curl request')).toBeTruthy();
    expect(screen.getByText('TypeScript client example')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'OpenAPI schema' })).toHaveProperty(
      'href',
      expect.stringContaining('/api/v1/openapi.json'),
    );
    expect(screen.getByText('req-workspace')).toBeTruthy();
  });
});
