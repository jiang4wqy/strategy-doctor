// tests/mcp/stdio-smoke.test.ts — MCP stdio 冒烟测试
//
// 需要 STRATEGY_DOCTOR_URL 和 STRATEGY_DOCTOR_API_KEY 环境变量。
// 默认跳过（CI 不打外网）。
//
// 启动 MCP server → 通过 stdio 发送 JSON-RPC 请求 → 验证响应。
// 测试后自动退出。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const skip = !process.env.STRATEGY_DOCTOR_URL
  || !process.env.STRATEGY_DOCTOR_API_KEY;

test('MCP stdio smoke: list tools + call capabilities', { skip }, async () => {
  const serverPath = new URL('../../src/mcp/server.ts', import.meta.url).pathname;
  const child = spawn(
    process.execPath,
    [serverPath],
    {
      env: {
        ...process.env,
        STRATEGY_DOCTOR_URL: process.env.STRATEGY_DOCTOR_URL!,
        STRATEGY_DOCTOR_API_KEY: process.env.STRATEGY_DOCTOR_API_KEY!,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
    },
  );

  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];

  child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
  child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));

  // 等待 server 启动
  await sleep(500);

  // 发送 list_tools 请求
  const listToolsRequest = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
  });
  child.stdin!.write(listToolsRequest + '\n');

  await sleep(300);

  // 发送 call_tool 请求
  const callToolRequest = JSON.stringify({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'list_strategy_capabilities',
      arguments: {},
    },
  });
  child.stdin!.write(callToolRequest + '\n');

  await sleep(1000);

  // 关闭
  child.stdin!.end();
  const exitCode = await new Promise<number | null>(resolve => {
    child.on('exit', code => resolve(code));
    setTimeout(() => {
      child.kill();
      resolve(null);
    }, 3000);
  });

  const output = Buffer.concat(stdout).toString();
  const errorLog = Buffer.concat(stderr).toString();

  // 验证收到了 list_tools 响应
  assert.ok(
    output.includes('"tools/') || output.includes('list_strategy_capabilities'),
    `expected tool listing in stdout, got: ${output.slice(0, 500)}`,
  );

  // 验证收到了 call_tool 响应
  assert.ok(
    output.includes('ma-cross') || output.includes('archetype'),
    `expected capabilities result in stdout, got: ${output.slice(0, 500)}`,
  );

  // 验证 server 没有因错误退出
  assert.ok(
    exitCode === null || exitCode === 0,
    `server exited with code ${exitCode}. stderr: ${errorLog.slice(0, 500)}`,
  );
});
