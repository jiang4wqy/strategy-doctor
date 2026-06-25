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

interface ComparisonSnapshot {
  request: DiagnoseRequest;
  requestId: string;
  view: DiagnosisView;
}

export type AppState =
  | ({ status: 'signedOut' } & StateError)
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
      comparisonBaseline?: ComparisonSnapshot;
    } & StateError)
  | ({
      status: 'diagnosing';
      description: string;
      capabilities: readonly AnyStrategyDefinition[];
      request: DiagnoseRequest;
      draft: StrategyDraft;
      comparisonBaseline?: ComparisonSnapshot;
    } & StateError)
  | ({
      status: 'result';
      description: string;
      capabilities: readonly AnyStrategyDefinition[];
      request: DiagnoseRequest;
      requestId: string;
      view: DiagnosisView;
      draft: StrategyDraft;
      comparisonBaseline?: ComparisonSnapshot;
    } & StateError);

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
  | { type: 'backToDescribe' }
  | { type: 'backToConfirmation'; comparisonBaseline?: ComparisonSnapshot }
  | { type: 'startOver' }
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
            draft: state.draft,
            comparisonBaseline: state.comparisonBaseline,
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
            draft: state.draft,
            comparisonBaseline: state.comparisonBaseline,
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
            comparisonBaseline: state.comparisonBaseline,
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
            capabilities: state.capabilities,
            request: action.record.request,
            requestId: action.record.requestId,
            view: action.record.view,
            draft: {
              strategy: action.record.request.strategy,
              source: 'rules',
              confidence: 1,
              assumptions: [],
              warnings: [],
            },
            comparisonBaseline: undefined,
          };
    case 'backToDescribe':
      return state.status === 'signedOut'
        ? state
        : {
            status: 'describing',
            description: state.description,
            capabilities: state.capabilities,
          };
    case 'backToConfirmation':
      return state.status === 'result' || state.status === 'diagnosing'
        ? {
            status: 'confirming',
            description: state.description,
            capabilities: state.capabilities,
            draft: state.draft,
            comparisonBaseline: action.comparisonBaseline,
          }
        : state;
    case 'startOver':
      return state.status === 'signedOut'
        ? state
        : {
            status: 'describing',
            description: '',
            capabilities: state.capabilities,
          };
    case 'signedOut':
      return initialAppState;
  }
}
