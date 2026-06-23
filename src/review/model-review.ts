import type { DiagnoseRequest } from '../platform/contracts.ts';
import type {
  DiagnosisView,
  StrategyModelReview,
} from '../platform/contracts.ts';

export interface StrategyReviewInput {
  request: DiagnoseRequest;
  view: DiagnosisView;
}

export interface StrategyReviewOptions {
  env?: Record<string, string | undefined>;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}

function boundedScore(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.max(0, Math.min(100, Math.round(parsed)))
    : fallback;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => (
      typeof item === 'string' && item.trim() !== ''
    )).map(item => item.trim()).slice(0, 6)
    : [];
}

function extractJsonObject(text: string): Record<string, unknown> | undefined {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : undefined;
  } catch {
    return undefined;
  }
}

function chatText(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const choices = (value as Record<string, unknown>).choices;
  if (!Array.isArray(choices)) {
    return undefined;
  }
  for (const choice of choices) {
    if (typeof choice !== 'object' || choice === null) {
      continue;
    }
    const message = (choice as Record<string, unknown>).message;
    if (typeof message !== 'object' || message === null) {
      continue;
    }
    const content = (message as Record<string, unknown>).content;
    if (typeof content === 'string' && content.trim() !== '') {
      return content;
    }
  }
  return undefined;
}

function prompt(input: StrategyReviewInput): string {
  const { request, view } = input;
  return JSON.stringify({
    task:
      'Review this trading strategy diagnosis. Return strict JSON with score, agreementRate, objections, recommendations, and summary.',
    strategy: {
      id: request.strategy.id,
      archetype: request.strategy.archetype,
      symbol: request.strategy.universe[0],
      timeframe: request.strategy.timeframe,
      params: request.strategy.params,
      execution: request.strategy.execution,
      backtest: request.strategy.backtest,
    },
    diagnosis: {
      riskScore: view.summary.riskScore,
      worstDrawdownPct: view.summary.worstDrawdownPct,
      totalTrades: view.summary.totalTrades,
      totalTurnoverPct: view.summary.totalTurnoverPct,
      costDragPct: view.summary.feeCostPct + view.summary.slippageCostPct,
      robustnessGain: view.summary.robustnessGain,
      returnDelta: view.summary.returnDelta,
      deaths: view.scorecard.deaths.map(death => ({
        dimension: death.dimension,
        cause: death.cause,
      })),
      prescription: view.scorecard.prescription.changes,
    },
  });
}

export function ruleBasedStrategyReview(
  input: StrategyReviewInput,
): StrategyModelReview {
  const { request, view } = input;
  const objections: string[] = [];
  const recommendations: string[] = [];
  const costDrag = view.summary.feeCostPct + view.summary.slippageCostPct;

  if (view.summary.worstDrawdownPct > 0.5) {
    objections.push('Worst drawdown is above 50%, so capital survival is weak.');
    recommendations.push('Reduce exposure or add a regime filter before deployment.');
  }
  if (request.strategy.params.leverage > 6) {
    objections.push('Leverage is high for an adversarial stress-tested strategy.');
    recommendations.push('Use the prescription as an upper bound for leverage.');
  }
  if (view.scorecard.deaths.length > 0) {
    objections.push('At least one stress scenario produced a death event.');
    recommendations.push('Review death dimensions before publishing to Playbook.');
  }
  if (costDrag > 0.01) {
    objections.push('Execution cost drag is material relative to account equity.');
    recommendations.push('Lower turnover or test lower-frequency variants.');
  }
  if (view.summary.robustnessGain < 0) {
    objections.push('The prescription reduced held-out robustness.');
    recommendations.push('Reject this repair and run a constrained alternative search.');
  }
  if (objections.length === 0) {
    recommendations.push('Keep current risk settings and monitor live signal drift.');
  }

  const penalty = objections.length * 12
    + Math.min(30, Math.round(view.summary.worstDrawdownPct * 30))
    + Math.min(15, Math.round(costDrag * 600));
  const score = Math.max(0, Math.min(100, 100 - penalty));
  return {
    reviewer: 'local-rule-reviewer',
    mode: 'rules',
    score,
    agreementRate: view.modelConsistency?.prescription?.agreementRate ?? 1,
    objections,
    recommendations,
    summary: objections.length > 0
      ? 'The strategy is diagnosable but still needs risk review before deployment.'
      : 'The strategy passed the local reviewer with no critical objections.',
  };
}

export async function reviewWithOpenSourceModel(
  input: StrategyReviewInput,
  options: StrategyReviewOptions = {},
): Promise<StrategyModelReview> {
  const env = options.env ?? process.env;
  if (env.DOCTOR_REVIEW_ENABLED !== '1') {
    return ruleBasedStrategyReview(input);
  }
  const model = env.DOCTOR_REVIEW_MODEL ?? env.DASHSCOPE_MODEL ?? 'qwen-plus';
  const baseUrl = (
    env.DOCTOR_REVIEW_BASE_URL
      ?? env.DASHSCOPE_BASE_URL
      ?? 'https://dashscope.aliyuncs.com/compatible-mode/v1'
  ).replace(/\/+$/, '');
  const apiKey = env.DOCTOR_REVIEW_API_KEY ?? env.DASHSCOPE_API_KEY;
  if (!model || !baseUrl || !apiKey) {
    return ruleBasedStrategyReview(input);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 4000);
  try {
    const response = await (options.fetch ?? globalThis.fetch)(
      `${baseUrl}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          messages: [{
            role: 'user',
            content: prompt(input),
          }],
        }),
        signal: controller.signal,
      },
    );
    if (!response.ok) {
      return ruleBasedStrategyReview(input);
    }
    const text = chatText(await response.json());
    const parsed = text ? extractJsonObject(text) : undefined;
    if (!parsed) {
      return ruleBasedStrategyReview(input);
    }
    const fallback = ruleBasedStrategyReview(input);
    return {
      reviewer: model,
      mode: 'open-source-model',
      score: boundedScore(parsed.score, fallback.score),
      agreementRate: Math.max(
        0,
        Math.min(1, Number(parsed.agreementRate) || fallback.agreementRate),
      ),
      objections: stringArray(parsed.objections),
      recommendations: stringArray(parsed.recommendations),
      summary: typeof parsed.summary === 'string' && parsed.summary.trim() !== ''
        ? parsed.summary.trim()
        : fallback.summary,
    };
  } catch {
    return ruleBasedStrategyReview(input);
  } finally {
    clearTimeout(timeout);
  }
}
