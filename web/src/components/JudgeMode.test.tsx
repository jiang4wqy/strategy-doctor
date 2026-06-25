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
      name: 'Start live diagnosis',
    });
    expect(workspaceLink.getAttribute('href')).toBe('/showcase');
    expect(screen.getByRole('link', {
      name: 'Open API evidence',
    }).getAttribute('href')).toBe('/research');
    expect(screen.getByText('GitHub review surface')).toBeTruthy();
    expect(screen.getByText('jiang4wqy/strategy-doctor').closest('a'))
      .toHaveProperty('href', 'https://github.com/jiang4wqy/strategy-doctor');
    expect(screen.getByText('codex/p1-mcp').closest('a'))
      .toHaveProperty('href', 'https://github.com/jiang4wqy/strategy-doctor/tree/codex/p1-mcp');
  });
});
