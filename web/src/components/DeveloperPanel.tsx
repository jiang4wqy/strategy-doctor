import type { DiagnoseRequest } from '../api/types.ts';

export interface DeveloperPanelProps {
  request: DiagnoseRequest;
  requestId: string;
}

export function DeveloperPanel({
  request,
  requestId,
}: DeveloperPanelProps) {
  const requestJson = JSON.stringify(request, null, 2);
  const curl = `curl -X POST "$STRATEGY_DOCTOR_URL/api/v1/diagnoses" \\
  -H "Authorization: Bearer $STRATEGY_DOCTOR_API_KEY" \\
  -H "Content-Type: application/json" \\
  --data '${JSON.stringify(request)}'`;
  const typescript = `const result = await doctor.diagnose(${requestJson});`;

  return (
    <aside className="developer-panel" aria-labelledby="developer-title">
      <p className="eyebrow">Developer handoff</p>
      <h2 id="developer-title">Reproduce this diagnosis</h2>
      <dl>
        <div>
          <dt>Request ID</dt>
          <dd><code>{requestId}</code></dd>
        </div>
      </dl>
      <details>
        <summary>Confirmed Strategy JSON</summary>
        <pre>{JSON.stringify(request.strategy, null, 2)}</pre>
      </details>
      <details>
        <summary>curl request</summary>
        <pre>{curl}</pre>
      </details>
      <details>
        <summary>TypeScript client example</summary>
        <pre>{typescript}</pre>
      </details>
      <a href="/api/v1/openapi.json" target="_blank" rel="noreferrer">
        OpenAPI schema
      </a>
    </aside>
  );
}
