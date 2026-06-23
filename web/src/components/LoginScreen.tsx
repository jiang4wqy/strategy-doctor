import { useState, type FormEvent } from 'react';

export interface LoginScreenProps {
  onLogin(accessCode: string): Promise<void>;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(undefined);
    try {
      await onLogin(accessCode);
    } catch (reason) {
      setError(reason instanceof Error
        ? reason.message
        : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card" aria-labelledby="login-title">
        <p className="eyebrow">Adversarial strategy lab</p>
        <h1 id="login-title">Strategy Doctor</h1>
        <p>
          Enter the shared preview code to inspect deterministic failure
          diagnoses and targeted repairs.
        </p>
        <form onSubmit={submit}>
          <label htmlFor="access-code">Access code</label>
          <input
            id="access-code"
            type="password"
            autoComplete="current-password"
            value={accessCode}
            disabled={loading}
            onChange={event => setAccessCode(event.target.value)}
          />
          {error ? <p role="alert">{error}</p> : null}
          <button type="submit" disabled={loading || accessCode.length === 0}>
            {loading ? 'Checking access...' : 'Enter workspace'}
          </button>
        </form>
      </section>
    </main>
  );
}
