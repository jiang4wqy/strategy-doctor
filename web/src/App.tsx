import { useReducer } from 'react';
import { createApiClient } from './api/client.ts';
import type { ApiClient } from './api/types.ts';
import { LoginScreen } from './components/LoginScreen.tsx';
import { StrategyComposer } from './components/StrategyComposer.tsx';
import {
  StrategyConfirmation,
} from './components/StrategyConfirmation.tsx';
import { DiagnosisWorkspace } from './components/DiagnosisWorkspace.tsx';
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

  if (state.status === 'describing') {
    return (
      <main className="app-shell">
        <StrategyComposer
          client={client}
          description={state.description}
          onDescriptionChange={description => dispatch({
            type: 'descriptionChanged',
            description,
          })}
          onParsed={(description, draft) => dispatch({
            type: 'parsed',
            description,
            draft,
          })}
        />
      </main>
    );
  }

  if (state.status === 'confirming') {
    return (
      <main className="app-shell">
        <StrategyConfirmation
          draft={state.draft}
          capabilities={state.capabilities}
          externalError={state.error}
          onConfirm={async request => {
            const draft = state.draft;
            dispatch({ type: 'diagnosisStarted', request });
            try {
              const response = await client.diagnose(request);
              dispatch({
                type: 'diagnosed',
                requestId: response.requestId,
                view: response.data,
              });
            } catch (reason) {
              dispatch({
                type: 'diagnosisFailed',
                draft,
                message: reason instanceof Error
                  ? reason.message
                  : 'Diagnosis failed.',
              });
            }
          }}
        />
      </main>
    );
  }

  if (state.status === 'diagnosing') {
    return (
      <main className="app-shell" aria-live="polite">
        <p className="eyebrow">Running adversarial scenarios</p>
        <h1>Diagnosis in progress</h1>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <DiagnosisWorkspace
        request={state.request}
        requestId={state.requestId}
        view={state.view}
      />
    </main>
  );
}
