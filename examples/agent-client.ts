import { createStrategyDoctor } from '../src/client/index.ts';

const baseUrl = process.env.STRATEGY_DOCTOR_URL;
const apiKey = process.env.STRATEGY_DOCTOR_API_KEY;
if (!baseUrl || !apiKey) throw new Error('Set STRATEGY_DOCTOR_URL and STRATEGY_DOCTOR_API_KEY.');
const doctor = createStrategyDoctor({ baseUrl, apiKey });
const draft = await doctor.parseStrategy({ description: 'BTC 4h RSI and Bollinger mean reversion' });
const result = await doctor.diagnose({
  strategy: draft.strategy,
  style: 'conservative',
  seed: 42,
  candidates: 6,
});
console.log(result.summary);
