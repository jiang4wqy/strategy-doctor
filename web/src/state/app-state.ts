import type {
  AnyStrategyDefinition,
  DiagnoseRequest,
  DiagnosisView,
  StrategyDraft,
} from '../api/types.ts';

interface StateError {
  error?: string;
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
    } & StateError)
  | ({
      status: 'diagnosing';
      description: string;
      capabilities: readonly AnyStrategyDefinition[];
      request: DiagnoseRequest;
    } & StateError)
  | ({
      status: 'result';
      description: string;
      capabilities: readonly AnyStrategyDefinition[];
      request: DiagnoseRequest;
      requestId: string;
      view: DiagnosisView;
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
    }
  | { type: 'failed'; message: string }
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
          }
        : state;
    case 'failed':
      return { ...state, error: action.message };
    case 'signedOut':
      return initialAppState;
  }
}
