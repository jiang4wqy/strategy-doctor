import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { diagnosisFixture } from '../test/fixtures.ts';
import { DrawdownCurveChart } from './DrawdownCurveChart.tsx';
import { EquityComparisonChart } from './EquityComparisonChart.tsx';
import { ExecutionQualityChart } from './ExecutionQualityChart.tsx';
import { ParameterChangeChart } from './ParameterChangeChart.tsx';
import { RiskRadarChart } from './RiskRadarChart.tsx';
import { ScenarioTimelineChart } from './ScenarioTimelineChart.tsx';

const mocks = vi.hoisted(() => ({
  setOption: vi.fn(),
  resize: vi.fn(),
  dispose: vi.fn(),
}));

vi.mock('./echarts.ts', () => ({
  init: () => mocks,
}));

let resizeCallback: ResizeObserverCallback;
class TestResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    resizeCallback = callback;
  }
  observe() {}
  disconnect() {}
  unobserve() {}
}

describe('diagnosis charts', () => {
  beforeEach(() => {
    mocks.setOption.mockClear();
    mocks.resize.mockClear();
    mocks.dispose.mockClear();
    vi.stubGlobal('ResizeObserver', TestResizeObserver);
  });

  it('renders the default held-out dimension and switches series', async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <EquityComparisonChart charts={diagnosisFixture.charts} />,
    );

    expect(screen.getByRole('img', {
      name: 'Held-out equity comparison',
    })).toBeTruthy();
    expect(mocks.setOption).toHaveBeenCalledWith(
      expect.objectContaining({
        series: expect.arrayContaining([
          expect.objectContaining({ name: 'Original' }),
          expect.objectContaining({ name: 'Patched' }),
        ]),
      }),
      { notMerge: true },
    );
    await user.selectOptions(
      screen.getByLabelText('Held-out dimension'),
      'sentiment',
    );
    expect(mocks.setOption).toHaveBeenLastCalledWith(
      expect.objectContaining({
        series: expect.arrayContaining([
          expect.objectContaining({ data: [1, 0.8, 0.9] }),
        ]),
      }),
      { notMerge: true },
    );

    resizeCallback([], {} as ResizeObserver);
    expect(mocks.resize).toHaveBeenCalled();
    unmount();
    expect(mocks.dispose).toHaveBeenCalled();
  });

  it('maps radar, timeline, and changed parameters without recomputing', () => {
    render(
      <>
        <RiskRadarChart risks={diagnosisFixture.charts.riskRadar} />
        <DrawdownCurveChart charts={diagnosisFixture.charts} />
        <ExecutionQualityChart
          items={diagnosisFixture.charts.executionQuality}
        />
        <ScenarioTimelineChart
          items={diagnosisFixture.charts.scenarioTimeline}
        />
        <ParameterChangeChart
          changes={diagnosisFixture.charts.parameterChanges}
        />
      </>,
    );

    expect(screen.getByRole('img', {
      name: 'Five-dimension risk radar',
    })).toBeTruthy();
    expect(screen.getByRole('img', {
      name: 'Treatment drawdown curve',
    })).toBeTruthy();
    expect(screen.getByRole('img', {
      name: 'Execution cost and turnover',
    })).toBeTruthy();
    expect(screen.getByRole('img', {
      name: 'Scenario damage timeline',
    })).toBeTruthy();
    expect(screen.getByRole('img', {
      name: 'Parameter changes',
    })).toBeTruthy();
    expect(mocks.setOption).toHaveBeenCalledWith(
      expect.objectContaining({
        radar: expect.objectContaining({
          indicator: expect.arrayContaining([
            expect.objectContaining({ name: 'sentiment' }),
          ]),
        }),
      }),
      { notMerge: true },
    );
    expect(mocks.setOption).toHaveBeenCalledWith(
      expect.objectContaining({
        series: expect.arrayContaining([
          expect.objectContaining({ name: 'Drawdown' }),
        ]),
      }),
      { notMerge: true },
    );
    expect(mocks.setOption).toHaveBeenCalledWith(
      expect.objectContaining({
        legend: expect.objectContaining({
          data: ['Fee drag', 'Slippage drag', 'Turnover'],
        }),
      }),
      { notMerge: true },
    );
    expect(mocks.setOption).toHaveBeenCalledWith(
      expect.objectContaining({
        yAxis: expect.objectContaining({
          data: ['Technical whipsaw', 'News gap'],
        }),
      }),
      { notMerge: true },
    );
    expect(mocks.setOption).toHaveBeenCalledWith(
      expect.objectContaining({
        xAxis: expect.objectContaining({
          data: ['Leverage', 'Stop loss'],
        }),
      }),
      { notMerge: true },
    );
  });
});
