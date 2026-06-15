import { describe, expect, it } from 'vitest';
import {
  exportDiagnosisJson,
  renderDiagnosisMarkdown,
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
});
