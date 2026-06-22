export function ApiIntegrationPanel() {
  return (
    <section className="api-integration-panel" aria-labelledby="api-integration-title">
      <p className="eyebrow">Agent/API access</p>
      <h2 id="api-integration-title">API is configured outside the browser</h2>
      <p>
        The Web access code opens the reviewer workspace. Agent and script
        callers use a private Bearer key through the same REST API.
      </p>
      <dl className="api-checklist">
        <div>
          <dt>Service env</dt>
          <dd><code>DOCTOR_API_KEYS</code> enables authenticated API calls.</dd>
        </div>
        <div>
          <dt>Agent env</dt>
          <dd><code>STRATEGY_DOCTOR_API_KEY</code> is used by curl, MCP, and the TypeScript client.</dd>
        </div>
        <div>
          <dt>Review check</dt>
          <dd><code>npm run api:check</code> verifies health, capabilities, and OpenAPI.</dd>
        </div>
        <div>
          <dt>Preview access</dt>
          <dd><code>npm run preview:access</code> prints SSH tunnel and health-check commands.</dd>
        </div>
      </dl>
      <pre>{`export STRATEGY_DOCTOR_URL='http://127.0.0.1:8080'
export STRATEGY_DOCTOR_API_KEY='<private-agent-key>'
npm run api:check`}</pre>
    </section>
  );
}
