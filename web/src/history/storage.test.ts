import { describe, expect, it, vi } from 'vitest';
import type { StoredDiagnosis } from '../../../src/platform/contracts.ts';
import {
  deleteDiagnosis,
  loadDiagnoses,
  saveDiagnosis,
} from './storage.ts';
import {
  diagnosisFixture,
  requestFixture,
} from '../test/fixtures.ts';

function record(index: number): StoredDiagnosis {
  return {
    id: `record-${index}`,
    createdAt: new Date(2026, 0, index + 1).toISOString(),
    description: `description ${index}`,
    requestId: `req-${index}`,
    request: requestFixture,
    view: diagnosisFixture,
  };
}

describe('diagnosis history storage', () => {
  it('keeps newest-first order and at most ten records', () => {
    for (let index = 0; index < 12; index++) {
      expect(saveDiagnosis(record(index))).toEqual({ saved: true });
    }

    const stored = loadDiagnoses();
    expect(stored).toHaveLength(10);
    expect(stored[0].id).toBe('record-11');
    expect(stored[9].id).toBe('record-2');

    deleteDiagnosis('record-8');
    expect(loadDiagnoses().some(item => item.id === 'record-8')).toBe(false);
  });

  it('drops the oldest record on quota failure and returns false after retry failure', () => {
    for (let index = 0; index < 3; index++) {
      saveDiagnosis(record(index));
    }
    const original = Storage.prototype.setItem;
    let calls = 0;
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(
      function (this: Storage, key, value) {
        calls++;
        if (calls === 1) {
          throw new DOMException('quota', 'QuotaExceededError');
        }
        return original.call(this, key, value);
      },
    );

    expect(saveDiagnosis(record(3))).toEqual({ saved: true });
    expect(loadDiagnoses().map(item => item.id)).toEqual([
      'record-3',
      'record-2',
      'record-1',
    ]);

    spy.mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    expect(saveDiagnosis(record(4))).toEqual({ saved: false });
    spy.mockRestore();
  });

  it('returns an empty history for invalid stored data', () => {
    localStorage.setItem('strategy-doctor:diagnoses:v1', '{broken');
    expect(loadDiagnoses()).toEqual([]);
  });
});
