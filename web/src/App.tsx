import { useReducer } from 'react';
import { createApiClient } from './api/client.ts';
import type { ApiClient } from './api/types.ts';
import { LoginScreen } from './components/LoginScreen.tsx';
import {
  appReducer,
  initialAppState,
} from './state/app-state.ts';

const defaultClient = createApiClient();

export interface AppProps {
  client?: ApiClient;
}

export function App({ client = defaultClient }: AppProps) {
  const [state, dispatch] = useReducer(appReducer, initialAppState);

  if (state.status === 'signedOut') {
    return (
      <LoginScreen onLogin={async accessCode => {
        await client.login(accessCode);
        const capabilities = await client.capabilities();
        dispatch({
          type: 'authenticated',
          capabilities: capabilities.data,
        });
      }} />
    );
  }

  return (
    <main className="app-shell">
      <h1>Strategy Doctor</h1>
      <p>Describe one of the registered strategies to begin.</p>
    </main>
  );
}
