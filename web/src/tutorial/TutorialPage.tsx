export function TutorialPage() {
  return (
    <main className="app-shell">
      <section className="confirmation-panel" aria-labelledby="tutorial-title">
        <p className="eyebrow">Product quickstart</p>
        <h1 id="tutorial-title">How to use Strategy Doctor</h1>
        <div className="tutorial-grid">
          <section>
            <h2>1) Access</h2>
            <ol>
              <li>Open this page with the shared preview code.</li>
              <li>Paste any strategy description in the input field.</li>
              <li>Click <strong>Parse strategy</strong> and confirm parameters.</li>
            </ol>
          </section>
          <section>
            <h2>2) Backtest + Audit</h2>
            <ol>
              <li>Review defaulted assumptions and warnings.</li>
              <li>Run diagnosis to get five stress dimensions.</li>
              <li>Open prescription, held-out trade-off, and deployment panel.</li>
            </ol>
          </section>
          <section>
            <h2>3) Compare and Improve</h2>
            <ol>
              <li>Use <strong>Edit parameters</strong> to rerun the same strategy.</li>
              <li>Use <strong>Local history</strong> to recall previous runs.</li>
              <li>Export JSON/Markdown to track enterprise audit evidence.</li>
            </ol>
          </section>
        </div>
        <div className="history-actions">
          <a href="/">Open workspace</a>
          <a href="/showcase">Open public showcase</a>
        </div>
      </section>
    </main>
  );
}
