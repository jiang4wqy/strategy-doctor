import {
  lazy,
  Suspense,
  useReducer,
  type ReactNode,
} from 'react';
import { createApiClient } from './api/client.ts';
import type { ApiClient } from './api/types.ts';
import { LoginScreen } from './components/LoginScreen.tsx';
import { StrategyComposer } from './components/StrategyComposer.tsx';
import { StrategyConfirmation } from './components/StrategyConfirmation.tsx';
import { HistoryPanel } from './components/HistoryPanel.tsx';
import { TopNavigation } from './components/TopNavigation.tsx';
import { saveDiagnosis } from './history/storage.ts';
import { ShowcasePage } from './showcase/ShowcasePage.tsx';
import { TutorialPage } from './tutorial/TutorialPage.tsx';
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
  const currentPath = window.location.pathname;
  const withNavigation = (content: ReactNode) => (
    <div className="app-page">
      <TopNavigation currentPath={currentPath} />
      {content}
    </div>
  );

  if (window.location.pathname === '/showcase') {
    return withNavigation(<ShowcasePage />);
  }
  if (window.location.pathname === '/tutorial') {
    return withNavigation(<TutorialPage />);
  }

  if (state.status === 'signedOut') {
    return withNavigation(
      <LoginScreen onLogin={async accessCode => {
        await client.login(accessCode);
        const capabilities = await client.capabilities();
        dispatch({
          type: 'authenticated',
          capabilities: capabilities.data,
        });
      }} />,
    );
  }

  if (state.status === 'describing') {
    return withNavigation(
      <main className="app-shell">
        <StrategyComposer
          client={client}
          description={state.description}
          onBack={() => dispatch({ type: 'startOver' })}
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
      </main>,
    );
  }

  if (state.status === 'confirming') {
    return withNavigation(
      <main className="app-shell">
        {state.comparisonBaseline ? (
          <p className="status-banner">
            Compare mode enabled. This run will be measured against baseline
            diagnosis {state.comparisonBaseline.requestId}.
          </p>
        ) : null}
        <StrategyConfirmation
          draft={state.draft}
          capabilities={state.capabilities}
          externalError={state.error}
          onBack={() => dispatch({ type: 'backToDescribe' })}
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
      </main>,
    );
  }

  if (state.status === 'diagnosing') {
    return withNavigation(
      <main className="app-shell" aria-live="polite">
        <p className="eyebrow">
          <button
            type="button"
            onClick={() => dispatch({ type: 'backToConfirmation' })}
          >
            Back to parameters
          </button>
          Running adversarial scenarios
        </p>
        <h1>Diagnosis in progress</h1>
      </main>,
    );
  }

  return withNavigation(
    <main className="app-shell">
      <Suspense fallback={<p aria-live="polite">Loading visual analysis...</p>}>
        <DiagnosisWorkspace
          request={state.request}
          requestId={state.requestId}
          view={state.view}
          comparison={state.comparisonBaseline}
          onReconfigure={() => dispatch({ type: 'backToConfirmation' })}
          onCompare={() => dispatch({
            type: 'backToConfirmation',
            comparisonBaseline: {
              request: state.request,
              requestId: state.requestId,
              view: state.view,
            },
          })}
          onNewStrategy={() => dispatch({ type: 'startOver' })}
        />
      </Suspense>
      {state.error ? <p role="status">{state.error}</p> : null}
      <HistoryPanel onOpen={record => dispatch({
        type: 'restored',
        record,
      })} />
    </main>,
  );
}
