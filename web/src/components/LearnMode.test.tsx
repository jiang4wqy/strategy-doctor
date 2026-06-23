import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LearnMode } from './LearnMode.tsx';

describe('LearnMode', () => {
  it('renders tutorial and QA content with an optional back action', async () => {
    const onBack = vi.fn();
    const user = userEvent.setup();
    render(<LearnMode onBack={onBack} />);

    expect(screen.getByRole('heading', {
      name: 'How to use Strategy Doctor',
    })).toBeTruthy();
    expect(screen.getByText('What if natural-language parsing fails?'))
      .toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
