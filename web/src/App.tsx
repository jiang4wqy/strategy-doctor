import {
  lazy,
  Suspense,
  useReducer,
} from 'react';
import { createApiClient } from './api/client.ts';
import type { ApiClient } from './api/types.ts';
import { LoginScreen } from './components/LoginScreen.tsx';
import { StrategyComposer } from './components/StrategyComposer.tsx';
import {
  StrategyConfirmation,
} from './components/StrategyConfirmation.tsx';
import { HistoryPanel } from './components/HistoryPanel.tsx';
import { JudgeMode } from './components/JudgeMode.tsx';
import { saveDiagnosis } from './history/storage.ts';
import {
  appReducer,
  initialAppState,
} from './state/app-state.ts';

const defaultClient = createApiClient();
const DiagnosisWorkspace = lazy(async () => {
  const module = await import('./components/DiagnosisWorkspace.tsx');
  return { default: module.DiagnosisWorkspace };
});

export interface AppProps {
  client?: ApiClient;
}

export function App({ client = defaultClient }: AppProps) {
  const [state, dispatch] = useReducer(appReducer, initialAppState);

  if (window.location.pathname === '/judge') {
    return <JudgeMode />;
  }

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
        <HistoryPanel onOpen={record => dispatch({
          type: 'restored',
          record,
        })} />
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
              const saved = saveDiagnosis({
                id: response.requestId,
                createdAt: new Date().toISOString(),
                description: state.description,
                requestId: response.requestId,
                request,
                view: response.data,
              });
              dispatch({
                type: 'diagnosed',
                requestId: response.requestId,
                view: response.data,
                message: saved.saved
                  ? undefined
                  : 'The diagnosis could not be saved in local history.',
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
      <Suspense fallback={<p aria-live="polite">Loading visual analysis...</p>}>
        <DiagnosisWorkspace
          request={state.request}
          requestId={state.requestId}
          view={state.view}
        />
      </Suspense>
      {state.error ? <p role="status">{state.error}</p> : null}
      <HistoryPanel onOpen={record => dispatch({
        type: 'restored',
        record,
      })} />
    </main>
  );
}
