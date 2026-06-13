import { test } from 'node:test';
import assert from 'node:assert/strict';
import { McpClient } from '../../src/data/mcp-client.ts';

test('McpClient initializes once, carries the session, and parses SSE tool results', async () => {
  const requests: Array<{ body: Record<string, unknown>; headers: Headers }> = [];
  const responses = [
    new Response(JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      result: { protocolVersion: '2025-03-26' },
    }), {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'mcp-session-id': 'session-1',
      },
    }),
    new Response(null, { status: 202 }),
    new Response(
      'event: message\n'
      + 'data: {"jsonrpc":"2.0","id":2,"result":{"content":[{"type":"text","text":"[{\\"close\\":100}]"}]}}\n\n',
      { status: 200, headers: { 'content-type': 'text/event-stream' } },
    ),
    new Response(
      'data: {"jsonrpc":"2.0","id":3,"result":{"content":[{"type":"text","text":"{\\"ok\\":true}"}]}}\n\n',
      { status: 200, headers: { 'content-type': 'text/event-stream' } },
    ),
  ];
  const client = new McpClient({
    endpoint: 'https://example.test/mcp',
    fetch: async (_url, init) => {
      requests.push({
        body: init?.body ? JSON.parse(String(init.body)) : {},
        headers: new Headers(init?.headers),
      });
      return responses.shift()!;
    },
  });

  assert.deepEqual(
    await client.callTool('crypto_derivatives', { action: 'klines' }),
    [{ close: 100 }],
  );
  assert.deepEqual(await client.callTool('other', {}), { ok: true });
  assert.equal(requests.length, 4);
  assert.equal(requests[0].body.method, 'initialize');
  assert.equal(requests[1].body.method, 'notifications/initialized');
  assert.equal(requests[2].headers.get('mcp-session-id'), 'session-1');
  assert.equal(requests[3].headers.get('mcp-session-id'), 'session-1');
});

test('McpClient rejects non-success responses and malformed tool content', async () => {
  const initialized = () => new Response(JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    result: { protocolVersion: '2025-03-26' },
  }), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'mcp-session-id': 'session-1',
    },
  });

  for (const toolResponse of [
    new Response('unavailable', { status: 503 }),
    new Response(JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      result: { content: [] },
    }), { status: 200 }),
  ]) {
    const responses = [initialized(), new Response(null, { status: 202 }), toolResponse];
    const client = new McpClient({
      endpoint: 'https://example.test/mcp',
      fetch: async () => responses.shift()!,
    });
    await assert.rejects(
      client.callTool('crypto_derivatives', {}),
      /MCP/i,
    );
  }
});

test('McpClient shares one initialization across concurrent tool calls', async () => {
  let initializeCalls = 0;
  const client = new McpClient({
    endpoint: 'https://example.test/mcp',
    fetch: async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as {
        id?: number;
        method: string;
        params?: { name?: string };
      };
      if (body.method === 'initialize') {
        initializeCalls++;
        await new Promise(resolve => setTimeout(resolve, 5));
        return new Response(JSON.stringify({
          jsonrpc: '2.0',
          id: body.id,
          result: { protocolVersion: '2025-03-26' },
        }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'mcp-session-id': 'shared-session',
          },
        });
      }
      if (body.method === 'notifications/initialized') {
        return new Response(null, { status: 202 });
      }
      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        id: body.id,
        result: {
          content: [{
            type: 'text',
            text: JSON.stringify({ name: body.params?.name }),
          }],
        },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });

  const results = await Promise.all([
    client.callTool('one', {}),
    client.callTool('two', {}),
    client.callTool('three', {}),
  ]);

  assert.equal(initializeCalls, 1);
  assert.deepEqual(results, [
    { name: 'one' },
    { name: 'two' },
    { name: 'three' },
  ]);
});
