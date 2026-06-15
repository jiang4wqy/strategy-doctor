import type { StoredDiagnosis } from '../api/types.ts';

const HISTORY_KEY = 'strategy-doctor:diagnoses:v1';

function isStoredDiagnosis(value: unknown): value is StoredDiagnosis {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const item = value as Partial<StoredDiagnosis>;
  return typeof item.id === 'string'
    && typeof item.createdAt === 'string'
    && typeof item.description === 'string'
    && typeof item.requestId === 'string'
    && typeof item.request === 'object'
    && item.request !== null
    && typeof item.view === 'object'
    && item.view !== null;
}

function write(records: readonly StoredDiagnosis[]): void {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(records));
}

export function loadDiagnoses(): StoredDiagnosis[] {
  const stored = localStorage.getItem(HISTORY_KEY);
  if (!stored) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed)
      ? parsed.filter(isStoredDiagnosis).slice(0, 10)
      : [];
  } catch {
    return [];
  }
}

export function saveDiagnosis(
  record: StoredDiagnosis,
): { saved: boolean } {
  const current = loadDiagnoses().filter(item => item.id !== record.id);
  const next = [record, ...current].slice(0, 10);
  try {
    write(next);
    return { saved: true };
  } catch {
    const withoutOldest = [
      record,
      ...current.slice(0, Math.max(0, current.length - 1)),
    ].slice(0, 10);
    try {
      write(withoutOldest);
      return { saved: true };
    } catch {
      return { saved: false };
    }
  }
}

export function deleteDiagnosis(id: string): void {
  write(loadDiagnoses().filter(record => record.id !== id));
}
