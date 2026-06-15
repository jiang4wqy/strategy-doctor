import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LoginScreen } from './LoginScreen.tsx';

describe('LoginScreen', () => {
  it('submits the access code and enters the application', async () => {
    const login = vi.fn(async () => undefined);
    const user = userEvent.setup();
    render(<LoginScreen onLogin={login} />);

    await user.type(screen.getByLabelText('Access code'), 'team-code');
    await user.click(screen.getByRole('button', { name: 'Enter workspace' }));

    expect(login).toHaveBeenCalledWith('team-code');
  });

  it('shows a rejected login without clearing the form', async () => {
    const login = vi.fn(async () => {
      throw new Error('Access code is invalid.');
    });
    const user = userEvent.setup();
    render(<LoginScreen onLogin={login} />);

    const input = screen.getByLabelText('Access code') as HTMLInputElement;
    await user.type(input, 'wrong-code');
    await user.click(screen.getByRole('button', { name: 'Enter workspace' }));

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Access code is invalid.',
    );
    expect(input.value).toBe('wrong-code');
    expect(input.disabled).toBe(false);
  });
});
