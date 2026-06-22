#!/usr/bin/env node
/*
Generate submission-grade REST usage evidence from a running Strategy Doctor
service. The output is intentionally credential-free and reproducible by
reviewers with their own local API key.
*/

import {
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outputDir = join(repoRoot, 'examples/submission');
const baseUrl = normalizeBaseUrl(
  process.env.STRATEGY_DOCTOR_URL ?? 'http://127.0.0.1:8080',
);
const apiKey = process.env.STRATEGY_DOCTOR_API_KEY?.trim();
const timeoutMs = Number(process.env.STRATEGY_DOCTOR_TIMEOUT_MS ?? 15000);

if (!apiKey) {
  console.error('Set STRATEGY_DOCTOR_API_KEY before generating usage records.');
  process.exit(1);
}

if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
  console.error('STRATEGY_DOCTOR_TIMEOUT_MS must be a positive number.');
  process.exit(1);
}

const strategies = [
  ['ma', 'examples/trend-follower.json'],
  ['rsi', 'examples/rsi-bollinger.json'],
  ['breakout', 'examples/breakout-confirmation.json'],
  ['atr', 'examples/atr-trend-breakout.json'],
];

const usageLog = [];

try {
  mkdirSync(outputDir, { recursive: true });

  const health = await requestJson('GET', '/api/v1/health');
  usageLog.push(baseLog(health, {
    purpose: 'public health check',
    serviceStatus: health.json.data.status,
  }));

  const capabilities = await requestJson('GET', '/api/v1/capabilities', {
    authenticated: true,
  });
  usageLog.push(baseLog(capabilities, {
    purpose: 'authenticated capability discovery',
    capabilityCount: capabilities.json.data.length,
    archetypes: capabilities.json.data.map(item => item.archetype),
  }));

  const openapi = await requestJson('GET', '/api/v1/openapi.json', {
    authenticated: true,
  });
  usageLog.push(baseLog(openapi, {
    purpose: 'authenticated OpenAPI discovery',
    openapiTitle: openapi.json.info.title,
    openapiVersion: openapi.json.info.version,
  }));

  const parsed = await requestJson('POST', '/api/v1/strategies/parse', {
    authenticated: true,
    body: {
      description: 'BTC 4h ATR trend breakout with 20 candle breakout, 14 ATR, 2.5 ATR stop, 50 MA trend filter, 5x leverage, 60% position',
    },
  });
  usageLog.push(baseLog(parsed, {
    purpose: 'natural-language strategy parsing',
    parsedArchetype: parsed.json.data.strategy.archetype,
    parserSource: parsed.json.data.source,
    confidence: parsed.json.data.confidence,
  }));

  for (const [prefix, strategyPath] of strategies) {
    const strategy = readJson(strategyPath);
    const request = {
      strategy,
      style: 'conservative',
      seed: 42,
      candidates: 6,
    };
    const diagnosed = await requestJson('POST', '/api/v1/diagnoses', {
      authenticated: true,
      body: request,
    });
    const view = diagnosed.json.data;
    const scorecard = view.scorecard;

    writeJson(`examples/submission/${prefix}-diagnose-request.json`, request);
    writeJson(`examples/submission/${prefix}-diagnosis-view.json`, view);
    writeJson(`examples/submission/${prefix}-scorecard.json`, scorecard);

    usageLog.push(baseLog(diagnosed, {
      purpose: 'strategy diagnosis',
      strategyId: request.strategy.id,
      archetype: request.strategy.archetype,
      evaluations: scorecard.evaluations.length,
      selectedStyleRiskScore: view.summary.riskScore,
      deploymentStatus: view.deployment.status,
      deploymentScore: view.deployment.score,
      deaths: scorecard.deaths.map(death => death.cause),
    }));
  }

  writeFileSync(
    join(outputDir, 'api-call-log.jsonl'),
    `${usageLog.map(entry => JSON.stringify(entry)).join('\n')}\n`,
  );

  console.log(`Usage record written to ${join(outputDir, 'api-call-log.jsonl')}`);
  console.log(`Recorded ${usageLog.length} API calls from ${baseUrl}.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

function normalizeBaseUrl(value) {
  return value.trim().replace(/\/+$/, '');
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(join(repoRoot, relativePath), 'utf8'));
}

function writeJson(relativePath, value) {
  writeFileSync(
    join(repoRoot, relativePath),
    `${JSON.stringify(value, null, 2)}\n`,
  );
}

function baseLog(response, extra) {
  return {
    timestamp: new Date().toISOString(),
    endpoint: `${response.method} ${response.path}`,
    status: response.status,
    requestId: response.json.requestId ?? null,
    latencyMs: response.latencyMs,
    ...extra,
  };
}

async function requestJson(method, path, options = {}) {
  let lastError;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const started = performance.now();
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          ...(options.authenticated
            ? { Authorization: `Bearer ${apiKey}` }
            : {}),
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });
      const latencyMs = Math.round(performance.now() - started);
      const text = await response.text();
      const json = text ? JSON.parse(text) : {};

      if (!response.ok) {
        throw new Error(`${method} ${path} returned ${response.status}: ${text}`);
      }

      return {
        method,
        path,
        status: response.status,
        latencyMs,
        json,
      };
    } catch (error) {
      lastError = error;
      if (attempt === 3) {
        break;
      }
      await delay(250 * attempt);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(
    `${method} ${path} failed after 3 attempts: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
