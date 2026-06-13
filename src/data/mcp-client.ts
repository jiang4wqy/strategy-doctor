interface McpClientOptions {
  endpoint: string;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}

interface RpcResponse {
  id?: number;
  result?: unknown;
  error?: {
    code?: number;
    message?: string;
  };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return JSON.parse(text.replace(/:\s*NaN(?=\s*[,}])/g, ': null'));
  }
}

async function parseRpcResponse(response: Response): Promise<RpcResponse> {
  const text = await response.text();
  if (text.trim() === '') {
    return {};
  }
  if (response.headers.get('content-type')?.includes('text/event-stream')) {
    const payloads = text
      .split(/\r?\n/)
      .filter(line => line.startsWith('data:'))
      .map(line => line.slice(5).trim())
      .filter(payload => payload !== '' && payload !== '[DONE]')
      .map(payload => parseJson(payload) as RpcResponse);
    const message = payloads.find(payload => payload.result || payload.error);
    if (!message) {
      throw new Error('MCP response did not contain a result');
    }
    return message;
  }
  return parseJson(text) as RpcResponse;
}

function toolText(result: unknown): string {
  if (typeof result !== 'object' || result === null) {
    throw new Error('MCP tool result is malformed');
  }
  const content = (result as Record<string, unknown>).content;
  if (!Array.isArray(content)) {
    throw new Error('MCP tool result is missing content');
  }
  const block = content.find(candidate => (
    typeof candidate === 'object'
    && candidate !== null
    && (candidate as Record<string, unknown>).type === 'text'
    && typeof (candidate as Record<string, unknown>).text === 'string'
  )) as Record<string, unknown> | undefined;
  if (!block) {
    throw new Error('MCP tool result is missing text content');
  }
  return block.text as string;
}

export class McpClient {
  private readonly endpoint: string;
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly timeoutMs: number;
  private sessionId?: string;
  private initialization?: Promise<void>;
  private nextId = 1;

  constructor(options: McpClientOptions) {
    this.endpoint = options.endpoint;
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  private async request(
    body: Record<string, unknown>,
    sessionId?: string,
  ): Promise<{ response: Response; rpc: RpcResponse }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(this.endpoint, {
        method: 'POST',
        headers: {
          accept: 'application/json, text/event-stream',
          'content-type': 'application/json',
          ...(sessionId ? { 'mcp-session-id': sessionId } : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`MCP request failed with status ${response.status}`);
      }
      return {
        response,
        rpc: await parseRpcResponse(response),
      };
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('MCP')) {
        throw error;
      }
      throw new Error('MCP request failed');
    } finally {
      clearTimeout(timeout);
    }
  }

  private async initialize(): Promise<void> {
    if (this.sessionId) {
      return;
    }
    if (!this.initialization) {
      this.initialization = this.performInitialize();
    }
    try {
      await this.initialization;
    } finally {
      this.initialization = undefined;
    }
  }

  private async performInitialize(): Promise<void> {
    const id = this.nextId++;
    const { response, rpc } = await this.request({
      jsonrpc: '2.0',
      id,
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: {
          name: 'strategy-doctor',
          version: '0.1.0',
        },
      },
    });
    if (rpc.error || !rpc.result) {
      throw new Error('MCP initialization failed');
    }
    const sessionId = response.headers.get('mcp-session-id');
    if (!sessionId) {
      throw new Error('MCP initialization did not return a session id');
    }
    this.sessionId = sessionId;
    await this.request({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    }, sessionId);
  }

  async callTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    await this.initialize();
    const id = this.nextId++;
    const { rpc } = await this.request({
      jsonrpc: '2.0',
      id,
      method: 'tools/call',
      params: {
        name,
        arguments: args,
      },
    }, this.sessionId);
    if (rpc.error) {
      throw new Error(`MCP tool call failed: ${rpc.error.message ?? 'unknown error'}`);
    }
    if (!rpc.result) {
      throw new Error('MCP tool call returned no result');
    }
    try {
      return parseJson(toolText(rpc.result));
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('MCP')) {
        throw error;
      }
      throw new Error('MCP tool text is not valid JSON');
    }
  }
}
