import { describe, expect, it } from 'vitest';
import {
  exportDiagnosisJson,
  exportRiskDashboardJson,
  renderDiagnosisMarkdown,
  renderRiskDashboardMarkdown,
} from './report.ts';
import {
  diagnosisFixture,
  requestFixture,
} from '../test/fixtures.ts';

describe('diagnosis exports', () => {
  it('serializes the confirmed request and server view', () => {
    const parsed = JSON.parse(
      exportDiagnosisJson(requestFixture, diagnosisFixture),
    );

    expect(parsed.request).toEqual(requestFixture);
    expect(parsed.view.summary).toEqual(diagnosisFixture.summary);
    expect(parsed.view.charts).toEqual(diagnosisFixture.charts);
    expect(parsed.view.scorecard.strategyId).toBe(
      diagnosisFixture.scorecard.strategyId,
    );
  });

  it('renders an honest Markdown diagnosis', () => {
    const markdown = renderDiagnosisMarkdown(
      requestFixture,
      diagnosisFixture,
    );

    expect(markdown).toContain('Risk score');
    expect(markdown).toContain('sentiment');
    expect(markdown).toContain('technical');
    expect(markdown).toContain('Lower leverage');
    expect(markdown).toContain('Held-out trade-off');
    expect(markdown).toMatch(/does not guarantee|not guarantee/i);
  });

  it('exports a risk dashboard payload', () => {
    const markdown = renderRiskDashboardMarkdown(
      requestFixture,
      diagnosisFixture,
    );
    const parsed = JSON.parse(
      exportRiskDashboardJson(requestFixture, diagnosisFixture),
    );

    expect(markdown).toContain('Risk dashboard');
    expect(markdown).toContain('Trend score');
    expect(parsed.riskDashboard.trendScore).toBe(
      diagnosisFixture.riskDashboard?.trendScore,
    );
    expect(parsed.tradeoff.robustnessGain).toBe(
      diagnosisFixture.scorecard.tradeoff.robustnessGain,
    );
  });
});
