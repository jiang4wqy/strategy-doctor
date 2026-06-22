#!/usr/bin/env node
/*
脚本作用：
加载本地环境变量文件并启动 Strategy Doctor 生产 Web/API 服务。

执行逻辑：
1. 从 STRATEGY_DOCTOR_ENV_FILE 指定的文件读取环境变量，默认读取 .env。
2. 检查 Web access code、session secret、API key 和 web/dist/index.html。
3. 使用当前 Node 进程启动 src/server/start.ts，并继承终端输入输出。

运行示例：
    STRATEGY_DOCTOR_ENV_FILE=.env npm run start:prod
*/

import { existsSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const envFile = process.env.STRATEGY_DOCTOR_ENV_FILE ?? '.env';
const envPath = resolve(envFile);

function loadEnvFile(path) {
  if (!existsSync(path)) {
    return;
  }
  const text = readFileSync(path, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
      continue;
    }
    const [key, ...rest] = trimmed.split('=');
    if (process.env[key] !== undefined) {
      continue;
    }
    process.env[key] = rest.join('=').replace(/^['"]|['"]$/g, '');
  }
}

function requireEnv(key) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} is required. Copy .env.example to .env and fill it.`);
  }
  return value;
}

loadEnvFile(envPath);

const staticRoot = process.env.DOCTOR_STATIC_ROOT ?? 'web/dist';
const indexPath = resolve(staticRoot, 'index.html');

requireEnv('DOCTOR_WEB_ACCESS_CODE');
const sessionSecret = requireEnv('DOCTOR_SESSION_SECRET');
requireEnv('DOCTOR_API_KEYS');

if (sessionSecret.length < 32) {
  throw new Error('DOCTOR_SESSION_SECRET must be at least 32 characters.');
}

if (!existsSync(indexPath)) {
  throw new Error(`Missing ${indexPath}. Run npm run build:web first.`);
}

process.env.DOCTOR_HOST ??= '0.0.0.0';
process.env.DOCTOR_PORT ??= '8080';
process.env.DOCTOR_STATIC_ROOT ??= staticRoot;

console.log(`Starting Strategy Doctor on ${process.env.DOCTOR_HOST}:${process.env.DOCTOR_PORT}`);
console.log(`Static root: ${process.env.DOCTOR_STATIC_ROOT}`);

const child = spawn(process.execPath, ['src/server/start.ts'], {
  env: process.env,
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exitCode = code ?? 1;
});
