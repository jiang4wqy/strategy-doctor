import { useState } from 'react';
import type { StoredDiagnosis } from '../api/types.ts';
import {
  deleteDiagnosis,
  loadDiagnoses,
} from '../history/storage.ts';
import {
  downloadText,
  exportDiagnosisJson,
} from '../export/report.ts';

export interface HistoryPanelProps {
  onOpen(record: StoredDiagnosis): void;
  onExport?(record: StoredDiagnosis): void;
}

export function HistoryPanel({
  onOpen,
  onExport,
}: HistoryPanelProps) {
  const [records, setRecords] = useState(loadDiagnoses);

  if (records.length === 0) {
    return (
      <aside className="history-panel" aria-label="Local diagnosis history">
        <p className="eyebrow">Local history</p>
        <p>No saved diagnoses on this browser.</p>
      </aside>
    );
  }

  return (
    <aside className="history-panel" aria-label="Local diagnosis history">
      <p className="eyebrow">Local history · newest first</p>
      <ul>
        {records.map(record => (
          <li key={record.id}>
            <div>
              <strong>{record.description}</strong>
              <small>{new Date(record.createdAt).toLocaleString()}</small>
            </div>
            <div className="history-actions">
              <button type="button" onClick={() => onOpen(record)}>
                Open diagnosis
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onExport) {
                    onExport(record);
                    return;
                  }
                  downloadText(
                    `strategy-doctor-${record.request.strategy.id}.json`,
                    exportDiagnosisJson(record.request, record.view),
                    'application/json',
                  );
                }}
              >
                Export diagnosis
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteDiagnosis(record.id);
                  setRecords(loadDiagnoses());
                }}
              >
                Delete diagnosis
              </button>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}
