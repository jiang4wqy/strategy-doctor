import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  capabilityFixture,
  draftFixture,
} from '../test/fixtures.ts';
import { StrategyConfirmation } from './StrategyConfirmation.tsx';

describe('StrategyConfirmation', () => {
  it('renders metadata-driven fields and requires valid confirmation', async () => {
    const diagnose = vi.fn(async () => undefined);
    const user = userEvent.setup();
    render(
      <StrategyConfirmation
        draft={draftFixture}
        capabilities={capabilityFixture}
        onBack={() => undefined}
        onConfirm={diagnose}
      />,
    );

    expect(screen.getByText('Registered default')).toBeTruthy();
    expect(screen.getByLabelText('Fast MA')).toHaveProperty('value', '8');

    const leverage = screen.getByLabelText('Leverage');
    await user.clear(leverage);
    await user.type(leverage, '5');

    const stopLoss = screen.getByLabelText('Stop loss');
    await user.clear(stopLoss);
    await user.type(stopLoss, '2');
    await user.click(
      screen.getByRole('button', { name: 'Confirm and diagnose' }),
    );
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      expect.stringContaining('Stop loss'),
    );
    expect(diagnose).not.toHaveBeenCalled();

    await user.clear(stopLoss);
    await user.type(stopLoss, '0.1');
    await user.click(
      screen.getByRole('button', { name: 'Confirm and diagnose' }),
    );

    expect(diagnose).toHaveBeenCalledWith(expect.objectContaining({
      style: 'conservative',
      seed: 42,
      candidates: 6,
      strategy: expect.objectContaining({
        params: expect.objectContaining({
          leverage: 5,
          stopLossPct: 0.1,
        }),
      }),
    }));
  });
});
