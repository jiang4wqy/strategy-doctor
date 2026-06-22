#!/usr/bin/env node
/*
脚本作用：
检查 Strategy Doctor Web/API 服务是否可访问，并在提供 API key 时验证开发者接口。

执行逻辑：
1. 从 STRATEGY_DOCTOR_URL 读取服务地址，默认 http://127.0.0.1:8080。
2. 固定检查 health 和 showcase；如果存在 STRATEGY_DOCTOR_API_KEY，再检查 capabilities 和 OpenAPI。
3. 每个请求最多重试三次，每次默认 5 秒超时；失败时打印原因并退出非 0。

运行示例：
    STRATEGY_DOCTOR_URL=http://127.0.0.1:8080 STRATEGY_DOCTOR_API_KEY=<key> npm run healthcheck
*/

const baseUrl = (process.env.STRATEGY_DOCTOR_URL ?? 'http://127.0.0.1:8080')
  .replace(/\/$/, '');
const apiKey = process.env.STRATEGY_DOCTOR_API_KEY;
const timeoutMs = Number(process.env.STRATEGY_DOCTOR_HEALTH_TIMEOUT_MS ?? 5000);
const maxAttempts = 3;

const checks = [
  { name: 'health', path: '/api/v1/health', auth: false, expectJson: true },
  { name: 'showcase', path: '/showcase', auth: false, expectJson: false },
  { name: 'developer', path: '/developer', auth: false, expectJson: false },
  { name: 'capabilities', path: '/api/v1/capabilities', auth: true, expectJson: true },
  { name: 'openapi', path: '/api/v1/openapi.json', auth: true, expectJson: true },
];

function headers(check) {
  if (!check.auth) {
    return undefined;
  }
  return { Authorization: `Bearer ${apiKey}` };
}

async function request(check) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const started = Date.now();
    const response = await fetch(`${baseUrl}${check.path}`, {
      headers: headers(check),
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${text.slice(0, 160)}`);
    }
    if (check.expectJson) {
      JSON.parse(text);
    }
    return Date.now() - started;
  } finally {
    clearTimeout(timeout);
  }
}

async function runCheck(check) {
  if (check.auth && !apiKey) {
    console.log(`SKIP ${check.name}: STRATEGY_DOCTOR_API_KEY is not set`);
    return true;
  }
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const latencyMs = await request(check);
      console.log(`PASS ${check.name}: ${latencyMs}ms`);
      return true;
    } catch (error) {
      lastError = error;
      console.log(`RETRY ${check.name} ${attempt}/${maxAttempts}: ${error.message}`);
    }
  }
  console.error(`FAIL ${check.name}: ${lastError?.message ?? 'unknown error'}`);
  return false;
}

let ok = true;
for (const check of checks) {
  ok = await runCheck(check) && ok;
}

process.exitCode = ok ? 0 : 1;
