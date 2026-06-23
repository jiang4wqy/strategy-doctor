import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { JudgeMode } from './JudgeMode.tsx';

describe('JudgeMode', () => {
  it('renders the public competition evidence surface', () => {
    render(<JudgeMode />);

    expect(screen.getByRole('heading', {
      name: 'Strategy Doctor',
    })).toBeTruthy();
    expect(screen.getByText(/Playbook bridge accepts exported strategy JSON/i))
      .toBeTruthy();
    expect(screen.getByText('scripts\\verify-project.cmd')).toBeTruthy();
    const workspaceLink = screen.getByRole('link', {
      name: 'Open private workspace',
    });
    expect(workspaceLink.getAttribute('href')).toBe('/showcase');
  });
});
