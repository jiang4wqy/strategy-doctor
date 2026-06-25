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
  it('parses a strategy description without starting diagnosis', async () => {
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
        onBack={() => undefined}
        onDescriptionChange={() => undefined}
        onParsed={parsed}
      />,
    );

    const description = 'BTC 4h RSI 10 with Bollinger 14, oversold 30, overbought 70.';
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
        onBack={() => undefined}
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
});
