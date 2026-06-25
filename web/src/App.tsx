import {
  lazy,
  Suspense,
  useReducer,
} from 'react';
import {
  ArrowLeft,
  Brain,
  Compass,
  Home,
  BookOpen,
  LineChart,
} from 'lucide-react';
import { createApiClient } from './api/client.ts';
import type { ApiClient } from './api/types.ts';
import { LoginScreen } from './components/LoginScreen.tsx';
import { StrategyComposer } from './components/StrategyComposer.tsx';
import {
  StrategyConfirmation,
} from './components/StrategyConfirmation.tsx';
import { HistoryPanel } from './components/HistoryPanel.tsx';
import { JudgeMode } from './components/JudgeMode.tsx';
import { LearnMode } from './components/LearnMode.tsx';
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
const ResearchCenter = lazy(async () => {
  const module = await import('./components/ResearchCenter.tsx');
  return { default: module.ResearchCenter };
});

export interface AppProps {
  client?: ApiClient;
}

interface WorkspaceHeaderProps {
  heading: string;
  description: string;
  onBack?: () => void;
  onNewStrategy?: () => void;
  onOpenLearn?: () => void;
  onOpenResearch?: () => void;
  showWorkspaceLink?: boolean;
}

function WorkspaceHeader({
  heading,
  description,
  onBack,
  onNewStrategy,
  onOpenLearn,
  onOpenResearch,
  showWorkspaceLink = true,
}: WorkspaceHeaderProps) {
  return (
    <header className="enterprise-topbar" role="navigation" aria-label="Workspace navigation">
      <div className="enterprise-brand">
        <p className="eyebrow">Strategy Doctor</p>
        <h1 className="enterprise-brand-title">{heading}</h1>
        <p>{description}</p>
      </div>
      <div className="enterprise-actions">
        {onBack ? (
          <button
            type="button"
            className="ghost-action"
            onClick={onBack}
          >
            <ArrowLeft aria-hidden="true" />
            Back
          </button>
        ) : null}
        {onNewStrategy ? (
          <button type="button" onClick={onNewStrategy}>
            <Compass aria-hidden="true" />
            New strategy
          </button>
        ) : null}
        {onOpenLearn ? (
          <button
            type="button"
            className="secondary-action"
            onClick={onOpenLearn}
          >
            <BookOpen aria-hidden="true" />
            Tutorial / QA
          </button>
        ) : null}
        {onOpenResearch ? (
          <a className="secondary-action home-link" href="/research">
            <Brain aria-hidden="true" />
            Research center
          </a>
        ) : null}
        <a className="secondary-action home-link" href="/judge">
          <Home aria-hidden="true" />
          Judge mode
        </a>
        {showWorkspaceLink ? (
          <a className="secondary-action home-link" href="/showcase">
            <LineChart aria-hidden="true" />
            Workspace
          </a>
        ) : null}
      </div>
    </header>
  );
}

export function App({ client = defaultClient }: AppProps) {
  const [state, dispatch] = useReducer(appReducer, initialAppState);
  const path = window.location.pathname;

  if (path === '/judge') {
    return <JudgeMode />;
  }

  if (path === '/learn') {
    return <LearnMode />;
  }

  if (path === '/research') {
    return (
      <main className="app-shell">
        <WorkspaceHeader
          heading="Research center"
          description="Cross-layer dashboards for API telemetry, paper sandbox sessions, and on-chain signals."
          onBack={() => {
            window.location.assign('/showcase');
          }}
          onOpenLearn={() => {
            dispatch({ type: 'learnOpened' });
          }}
        />
        <Suspense fallback={<p aria-live="polite">Loading research cockpit...</p>}>
          <ResearchCenter
            client={client}
            onBack={() => {
              window.location.assign('/showcase');
            }}
          />
        </Suspense>
      </main>
    );
  }

  if (path === '/showcase') {
    // keep compatibility with historic routing and direct links.
    // no-op: render workspace as regular signed-in flow.
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
        <WorkspaceHeader
          heading="Strategy workspace"
          description="Describe a strategy, pick a sample, or generate one randomly before signing into diagnosis."
          onOpenLearn={() => dispatch({ type: 'learnOpened' })}
          onNewStrategy={() => dispatch({ type: 'newStrategy' })}
          onOpenResearch={() => {
            window.location.assign('/research');
          }}
          showWorkspaceLink={false}
        />
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
        <WorkspaceHeader
          heading="Strategy confirmation"
          description="Review assumptions, trading costs and backtest boundaries. Then launch deterministic diagnosis."
          onBack={() => dispatch({ type: 'back' })}
          onOpenLearn={() => dispatch({ type: 'learnOpened' })}
          onOpenResearch={() => {
            window.location.assign('/research');
          }}
        />
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
        <WorkspaceHeader
          heading="Diagnosis progress"
          description="Adversarial stress suite running. One strategy path remains accessible below when complete."
          onBack={() => dispatch({ type: 'back' })}
          onOpenLearn={() => dispatch({ type: 'learnOpened' })}
          onOpenResearch={() => {
            window.location.assign('/research');
          }}
        />
        <div className="workspace-nav">
          <button
            type="button"
            className="ghost-action"
            onClick={() => dispatch({ type: 'back' })}
          >
            <ArrowLeft aria-hidden="true" />
            Back to parameters
          </button>
          <button type="button" onClick={() => dispatch({ type: 'back' })}>
            <Compass aria-hidden="true" />
            Re-run diagnosis
          </button>
          <button
            type="button"
            className="secondary-action"
            onClick={() => dispatch({ type: 'learnOpened' })}
          >
            <BookOpen aria-hidden="true" />
            Tutorial / QA
          </button>
        </div>
        <p className="eyebrow">Running adversarial scenarios</p>
        <h1>Diagnosis in progress</h1>
      </main>
    );
  }

  if (state.status === 'learning') {
    return (
      <main className="app-shell">
        <WorkspaceHeader
          heading="Tutorial / QA"
          description="Learn workflow, assumptions and judge handoff process."
          onBack={() => dispatch({ type: 'back' })}
          onOpenResearch={() => {
            window.location.assign('/research');
          }}
        />
        <LearnMode onBack={() => dispatch({ type: 'back' })} />
      </main>
    );
  }

  return (
    <main className="app-shell">
      <WorkspaceHeader
        heading="Diagnosis report"
        description={state.request?.strategy.name
          ? `${state.request.strategy.name} - enterprise diagnostics`
          : 'Deterministic adversarial results'}
        onBack={() => dispatch({ type: 'back' })}
        onNewStrategy={() => dispatch({ type: 'newStrategy' })}
        onOpenLearn={() => dispatch({ type: 'learnOpened' })}
        onOpenResearch={() => {
          window.location.assign('/research');
        }}
      />
      <Suspense fallback={<p aria-live="polite">Loading visual analysis...</p>}>
        <DiagnosisWorkspace
          request={state.request}
          requestId={state.requestId}
          view={state.view}
          baseline={state.baseline}
          onEditParameters={() => dispatch({ type: 'editResult' })}
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
