import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../api/types.ts';
import { draftFixture } from '../test/fixtures.ts';
import { StrategyComposer } from './StrategyComposer.tsx';

function fakeClient(parse: ApiClient['parse']): ApiClient {
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

    const description = 'BTC 四小时 RSI 10 配合布林带 14';
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

  it('renders strategy templates and parses the selected template', async () => {
    const parse = vi.fn(async () => ({
      apiVersion: 'v1' as const,
      requestId: 'req-parse',
      data: draftFixture,
    }));
    const changed = vi.fn();
    const parsed = vi.fn();
    const user = userEvent.setup();
    render(
      <StrategyComposer
        client={fakeClient(parse)}
        description=""
        onDescriptionChange={changed}
        onParsed={parsed}
      />,
    );

    expect(screen.getByRole('button', {
      name: /Moving Average Trend/i,
    })).toBeTruthy();
    expect(screen.getByRole('button', {
      name: /ATR Trend Breakout/i,
    })).toBeTruthy();
    expect(screen.getAllByText('Best in')).toHaveLength(4);
    expect(screen.getByText('ATR stop too tight in chop')).toBeTruthy();
    expect(screen.getAllByText('Use template')).toHaveLength(4);

    await user.click(screen.getByRole('button', {
      name: /ATR Trend Breakout/i,
    }));

    expect(parse).toHaveBeenCalledWith(expect.stringContaining('ATR breakout'));
    expect(changed).toHaveBeenCalledWith(expect.stringContaining('ATR breakout'));
    expect(parsed).toHaveBeenCalledWith(
      expect.stringContaining('ATR breakout'),
      draftFixture,
    );
  });
});
