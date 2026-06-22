const quickChecks = [
  ['Health', 'GET /api/v1/health', 'No auth, proves the server is alive.'],
  ['Capabilities', 'GET /api/v1/capabilities', 'Bearer key, lists supported strategy contracts.'],
  ['OpenAPI', 'GET /api/v1/openapi.json', 'Bearer key or reviewer session, documents the API.'],
  ['Diagnose', 'POST /api/v1/diagnoses', 'Bearer key, runs the full five-dimension diagnosis.'],
] as const;

const envRows = [
  ['DOCTOR_WEB_ACCESS_CODE', 'Server', 'Reviewer login code for the protected workspace.'],
  ['DOCTOR_SESSION_SECRET', 'Server', '32+ character secret for signed browser sessions.'],
  ['DOCTOR_API_KEYS', 'Server', 'Comma-separated private Bearer keys for Agents.'],
  ['STRATEGY_DOCTOR_URL', 'Client', 'Base URL used by curl, scripts, MCP, and the TypeScript client.'],
  ['STRATEGY_DOCTOR_API_KEY', 'Client', 'One private key from DOCTOR_API_KEYS.'],
] as const;

const commandBlocks = [
  {
    title: 'Start local Web/API',
    command: `export DOCTOR_WEB_ACCESS_CODE='<reviewer-code>'
export DOCTOR_SESSION_SECRET='<random-32-plus-char-secret>'
export DOCTOR_API_KEYS='<private-agent-key>'
export DOCTOR_HOST='0.0.0.0'
export DOCTOR_PORT='8080'
npm run web`,
  },
  {
    title: 'Check API access',
    command: `export STRATEGY_DOCTOR_URL='http://127.0.0.1:8080'
export STRATEGY_DOCTOR_API_KEY='<private-agent-key>'
npm run api:check
npm run healthcheck`,
  },
  {
    title: 'Generate usage record',
    command: `npm run submission:usage-record
head -n 8 examples/submission/api-call-log.jsonl`,
  },
] as const;

export function DeveloperPage() {
  return (
    <main className="app-shell developer-page">
      <header className="developer-hero">
        <div>
          <p className="eyebrow">Developer integration</p>
          <h1>Agent-ready API, without exchange custody</h1>
          <p>
            Strategy Doctor exposes the same diagnosis engine through Web,
            REST, TypeScript client, MCP, and CLI. Agents submit structured
            strategy JSON, receive deployment evidence, and never need Bitget
            private account credentials.
          </p>
          <div className="showcase-actions" aria-label="Developer actions">
            <a href="/showcase">Open showcase</a>
            <a href="/api/v1/openapi.json">OpenAPI schema</a>
            <a href="/">Protected workspace</a>
          </div>
        </div>
        <dl className="developer-proof">
          <div>
            <dt>Auth</dt>
            <dd>Bearer API key</dd>
          </div>
          <div>
            <dt>Default mode</dt>
            <dd>Offline MockBacktester</dd>
          </div>
          <div>
            <dt>Safety</dt>
            <dd>No orders or account reads</dd>
          </div>
        </dl>
      </header>

      <section className="developer-flow" aria-label="API verification flow">
        <div>
          <p className="eyebrow">Verification flow</p>
          <h2>Prove the API path before judging the UI</h2>
          <p>
            These calls are the minimum reviewer path: health confirms
            reachability, capabilities confirms the closed strategy contract,
            OpenAPI confirms discoverability, and diagnose confirms the actual
            risk engine.
          </p>
        </div>
        <ol>
          {quickChecks.map(([label, route, detail]) => (
            <li key={label}>
              <strong>{label}</strong>
              <code>{route}</code>
              <span>{detail}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="developer-env" aria-label="Environment variables">
        <div className="comparison-heading">
          <p className="eyebrow">Configuration boundary</p>
          <h2>Secrets stay in the terminal, not the browser</h2>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Variable</th>
                <th>Side</th>
                <th>Purpose</th>
              </tr>
            </thead>
            <tbody>
              {envRows.map(([name, side, purpose]) => (
                <tr key={name}>
                  <td><code>{name}</code></td>
                  <td>{side}</td>
                  <td>{purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section
        className="reviewer-terminal developer-commands"
        aria-label="Copy-ready API commands"
      >
        <div>
          <p className="eyebrow">Copy-ready commands</p>
          <h2>Start, verify, and regenerate evidence</h2>
          <p>
            The commands use placeholders by design. Put real secrets in your
            shell or process manager, never in committed files.
          </p>
        </div>
        <div className="terminal-grid">
          {commandBlocks.map(item => (
            <article key={item.title}>
              <strong>{item.title}</strong>
              <pre>{item.command}</pre>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
