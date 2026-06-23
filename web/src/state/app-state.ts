import type {
  AnyStrategyDefinition,
  DiagnoseRequest,
  DiagnosisView,
  StoredDiagnosis,
  StrategyDraft,
} from '../api/types.ts';

interface StateError {
  error?: string;
}

export interface ComparisonBaseline {
  label: string;
  request: DiagnoseRequest;
  requestId: string;
  view: DiagnosisView;
}

type SignedOutState = { status: 'signedOut' } & StateError;

type WorkspaceState =
  | ({
      status: 'describing';
      description: string;
      capabilities: readonly AnyStrategyDefinition[];
    } & StateError)
  | ({
      status: 'confirming';
      description: string;
      capabilities: readonly AnyStrategyDefinition[];
      draft: StrategyDraft;
      baseline?: ComparisonBaseline;
    } & StateError)
  | ({
      status: 'diagnosing';
      description: string;
      capabilities: readonly AnyStrategyDefinition[];
      request: DiagnoseRequest;
      baseline?: ComparisonBaseline;
    } & StateError)
  | ({
      status: 'result';
      description: string;
      capabilities: readonly AnyStrategyDefinition[];
      request: DiagnoseRequest;
      requestId: string;
      view: DiagnosisView;
      baseline?: ComparisonBaseline;
    } & StateError);

type LearningState = {
  status: 'learning';
  previous: WorkspaceState;
} & StateError;

export type AppState =
  | SignedOutState
  | WorkspaceState
  | LearningState;

export type AppAction =
  | {
      type: 'authenticated';
      capabilities: readonly AnyStrategyDefinition[];
    }
  | { type: 'descriptionChanged'; description: string }
  | {
      type: 'parsed';
      description: string;
      draft: StrategyDraft;
    }
  | { type: 'diagnosisStarted'; request: DiagnoseRequest }
  | {
      type: 'diagnosed';
      requestId: string;
      view: DiagnosisView;
      message?: string;
    }
  | {
      type: 'diagnosisFailed';
      draft: StrategyDraft;
      message: string;
    }
  | { type: 'failed'; message: string }
  | { type: 'restored'; record: StoredDiagnosis }
  | { type: 'learnOpened' }
  | { type: 'back' }
  | { type: 'newStrategy' }
  | { type: 'editResult' }
  | { type: 'signedOut' };

export const initialAppState: AppState = { status: 'signedOut' };

export function appReducer(
  state: AppState,
  action: AppAction,
): AppState {
  switch (action.type) {
    case 'authenticated':
      return {
        status: 'describing',
        description: '',
        capabilities: action.capabilities,
      };
    case 'descriptionChanged':
      return state.status === 'describing'
        ? { ...state, description: action.description, error: undefined }
        : state;
    case 'learnOpened':
      return state.status === 'signedOut'
        ? state
        : {
            status: 'learning',
            previous: state.status === 'learning'
              ? state.previous
              : state,
          };
    case 'back':
      if (state.status === 'learning') {
        return state.previous;
      }
      if (state.status === 'confirming') {
        return {
          status: 'describing',
          description: state.description,
          capabilities: state.capabilities,
        };
      }
      if (state.status === 'result') {
        return {
          status: 'describing',
          description: state.description,
          capabilities: state.capabilities,
        };
      }
      return state;
    case 'editResult':
      return state.status === 'result'
        ? {
            status: 'confirming',
            description: state.description,
            capabilities: state.capabilities,
            draft: {
              strategy: state.request.strategy,
              source: 'rules',
              confidence: 1,
              assumptions: [],
              warnings: [],
            },
            baseline: {
              label: 'Original diagnosis',
              request: state.request,
              requestId: state.requestId,
              view: state.view,
            },
          }
        : state;
    case 'newStrategy':
      return state.status === 'signedOut'
        ? state
        : {
            status: 'describing',
            description: '',
            capabilities: state.status === 'learning'
              ? state.previous.capabilities
              : state.capabilities,
          };
    case 'parsed':
      return state.status === 'describing'
        ? {
            status: 'confirming',
            description: action.description,
            capabilities: state.capabilities,
            draft: action.draft,
          }
        : state;
    case 'diagnosisStarted':
      return state.status === 'confirming'
        ? {
            status: 'diagnosing',
            description: state.description,
            capabilities: state.capabilities,
            request: action.request,
            baseline: state.baseline,
          }
        : state;
    case 'diagnosed':
      return state.status === 'diagnosing'
        ? {
            status: 'result',
            description: state.description,
            capabilities: state.capabilities,
            request: state.request,
            requestId: action.requestId,
            view: action.view,
            baseline: state.baseline,
            error: action.message,
          }
        : state;
    case 'diagnosisFailed':
      return state.status === 'diagnosing'
        ? {
            status: 'confirming',
            description: state.description,
            capabilities: state.capabilities,
            draft: action.draft,
            baseline: state.baseline,
            error: action.message,
          }
        : state;
    case 'failed':
      return { ...state, error: action.message };
    case 'restored':
      return state.status === 'signedOut'
        ? state
        : {
            status: 'result',
            description: action.record.description,
            capabilities: state.status === 'learning'
              ? state.previous.capabilities
              : state.capabilities,
            request: action.record.request,
            requestId: action.record.requestId,
            view: action.record.view,
          };
    case 'signedOut':
      return initialAppState;
  }
}
