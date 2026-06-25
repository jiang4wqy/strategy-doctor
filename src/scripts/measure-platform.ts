import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import type { StrategyDraft } from '../platform/contracts.ts';
import { buildServer } from '../server/app.ts';

interface TimingSummary {
  mean: number;
  minimum: number;
  maximum: number;
}

export interface PlatformMeasurement {
  samples: number;
  parseMs: TimingSummary;
  diagnosisMs: TimingSummary;
}

const description =
  'BTC 4h RSI 10 with Bollinger 14, oversold 30, overbought 70.';
const headers = {
  authorization: 'Bearer measurement-key',
  'content-type': 'application/json',
};

function summarize(values: readonly number[]): TimingSummary {
  return {
    mean: values.reduce((total, value) => total + value, 0) / values.length,
    minimum: Math.min(...values),
    maximum: Math.max(...values),
  };
}

async function time(
  samples: number,
  operation: () => Promise<void>,
): Promise<number[]> {
  const values: number[] = [];
  for (let index = 0; index < samples; index++) {
    const startedAt = performance.now();
    await operation();
    values.push(performance.now() - startedAt);
  }
  return values;
}

export async function measurePlatform(
  samples = 5,
): Promise<PlatformMeasurement> {
  if (!Number.isInteger(samples) || samples < 1 || samples > 5) {
    throw new Error('samples must be an integer from 1 to 5');
  }
  const app = await buildServer({
    env: {
      DOCTOR_API_KEYS: 'measurement-key',
      DOCTOR_STATIC_ROOT: 'intentionally-missing-build',
      DOCTOR_NL_AI_ENABLED: '0',
      DOCTOR_LLM_NARRATE: '0',
    },
  });

  async function parse(): Promise<StrategyDraft> {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/strategies/parse',
      headers,
      payload: { description },
    });
    if (response.statusCode !== 200) {
      throw new Error(`parse measurement failed: ${response.body}`);
    }
    return response.json().data as StrategyDraft;
  }

  async function diagnose(draft: StrategyDraft): Promise<void> {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/diagnoses',
      headers,
      payload: {
        strategy: draft.strategy,
        style: 'conservative',
        seed: 42,
        candidates: 6,
      },
    });
    if (response.statusCode !== 200) {
      throw new Error(`diagnosis measurement failed: ${response.body}`);
    }
  }

  try {
    const warmDraft = await parse();
    await diagnose(warmDraft);
    let latestDraft = warmDraft;
    const parseTimes = await time(samples, async () => {
      latestDraft = await parse();
    });
    const diagnosisTimes = await time(
      samples,
      () => diagnose(latestDraft),
    );
    return {
      samples,
      parseMs: summarize(parseTimes),
      diagnosisMs: summarize(diagnosisTimes),
    };
  } finally {
    await app.close();
  }
}

if (
  process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const result = await measurePlatform();
  console.log(JSON.stringify(result, null, 2));
}
