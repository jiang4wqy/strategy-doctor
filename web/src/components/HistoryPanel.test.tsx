import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { HistoryPanel } from './HistoryPanel.tsx';
import { saveDiagnosis } from '../history/storage.ts';
import {
  diagnosisFixture,
  requestFixture,
} from '../test/fixtures.ts';

describe('HistoryPanel', () => {
  it('reopens, exports, and deletes local history without an API client', async () => {
    saveDiagnosis({
      id: 'history-1',
      createdAt: '2026-06-15T00:00:00.000Z',
      description: 'BTC moving average',
      requestId: 'req-history',
      request: requestFixture,
      view: diagnosisFixture,
    });
    const open = vi.fn();
    const exportRecord = vi.fn();
    const user = userEvent.setup();
    render(
      <HistoryPanel
        onOpen={open}
        onExport={exportRecord}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Open diagnosis' }));
    expect(open).toHaveBeenCalledWith(expect.objectContaining({
      id: 'history-1',
    }));

    await user.click(screen.getByRole('button', { name: 'Export diagnosis' }));
    expect(exportRecord).toHaveBeenCalledWith(expect.objectContaining({
      requestId: 'req-history',
    }));

    await user.click(screen.getByRole('button', { name: 'Delete diagnosis' }));
    expect(screen.queryByText('BTC moving average')).toBeNull();
  });
});
