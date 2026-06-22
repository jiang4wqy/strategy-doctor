#!/usr/bin/env node
/*
Validate that a running Strategy Doctor service is reachable through the
official REST surface used by Agents and review scripts.
*/

const baseUrl = normalizeBaseUrl(
  process.env.STRATEGY_DOCTOR_URL ?? 'http://127.0.0.1:8080',
);
const apiKey = process.env.STRATEGY_DOCTOR_API_KEY?.trim();
const timeoutMs = Number(process.env.STRATEGY_DOCTOR_TIMEOUT_MS ?? 5000);

if (!apiKey) {
  console.error('Set STRATEGY_DOCTOR_API_KEY before running api:check.');
  process.exit(1);
}

if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
  console.error('STRATEGY_DOCTOR_TIMEOUT_MS must be a positive number.');
  process.exit(1);
}

try {
  const health = await requestJson('/api/v1/health');
  const capabilities = await requestJson('/api/v1/capabilities', true);
  const openapi = await requestJson('/api/v1/openapi.json', true);
  const archetypes = capabilities.data.map(item => item.archetype);

  console.log(`Base URL: ${baseUrl}`);
  console.log(`Health: ${health.data.status}`);
  console.log(`Capabilities: ${archetypes.length} strategy types`);
  console.log(`Archetypes: ${archetypes.join(', ')}`);
  console.log(`OpenAPI: ${openapi.info.title} ${openapi.info.version}`);
  console.log('API verification passed.');
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

function normalizeBaseUrl(value) {
  return value.trim().replace(/\/+$/, '');
}

async function requestJson(path, authenticated = false) {
  let lastError;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        headers: authenticated
          ? { Authorization: `Bearer ${apiKey}` }
          : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`${path} returned ${response.status}: ${body}`);
      }

      return await response.json();
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
    `API verification failed after 3 attempts: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
