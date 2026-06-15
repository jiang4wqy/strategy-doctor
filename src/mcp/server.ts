// src/mcp/server.ts — MCP stdio 服务器
//
// 读取 STRATEGY_DOCTOR_URL 和 STRATEGY_DOCTOR_API_KEY 环境变量。
// 通过 stdio 传输协议暴露 3 个工具给 MCP 客户端。
//
// 使用方式：
//   $env:STRATEGY_DOCTOR_URL='http://127.0.0.1:8080'
//   $env:STRATEGY_DOCTOR_API_KEY='your-api-key'
//   npm run mcp

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { createStrategyDoctor } from '../client/index.ts';
import { ALL_TOOLS } from './tools.ts';

function fail(message: string): never {
  console.error(`fatal: ${message}`);
  process.exit(1);
}

const baseUrl = process.env.STRATEGY_DOCTOR_URL;
if (!baseUrl) {
  fail('STRATEGY_DOCTOR_URL environment variable is required');
}

const apiKey = process.env.STRATEGY_DOCTOR_API_KEY;
if (!apiKey) {
  fail('STRATEGY_DOCTOR_API_KEY environment variable is required');
}

// 初始化 client
const client = createStrategyDoctor({ baseUrl, apiKey });

// 创建 MCP server
const server = new Server(
  {
    name: 'strategy-doctor',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// 列出工具
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: ALL_TOOLS.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: zodSchemaToJsonSchema(tool.inputSchema),
    })),
  };
});

// 调用工具
server.setRequestHandler(CallToolRequestSchema, async request => {
  const tool = ALL_TOOLS.find(t => t.name === request.params.name);
  if (!tool) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `unknown tool: ${request.params.name}`,
        },
      ],
      isError: true,
    };
  }

  try {
    const parsed = tool.inputSchema.parse(request.params.arguments ?? {});
    const result = await tool.handler(client, parsed);
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text' as const,
          text: message,
        },
      ],
      isError: true,
    };
  }
});

/**
 * 将 Zod schema 转换为 MCP 兼容的 JSON Schema 格式。
 * MCP SDK 的 inputSchema 字段与 OpenAI 工具调用格式兼容，
 * 需要标准 JSON Schema。
 */
function zodSchemaToJsonSchema(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: any,
): Record<string, unknown> {
  // 对于简单的 object schema，直接生成 properties
  if (schema._def?.typeName === 'ZodObject') {
    return zodObjectToJsonSchema(schema);
  }

  // fallback: 返回宽松 schema
  return { type: 'object' };
}

function zodObjectToJsonSchema(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: any,
): Record<string, unknown> {
  const shape = schema._def?.shape?.();
  if (!shape) return { type: 'object' };

  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [key, fieldSchema] of Object.entries(shape)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fs = fieldSchema as any;
    properties[key] = zodTypeToJsonType(fs);

    // 检查是否为非 optional 字段
    const isOptional =
      fs._def?.typeName === 'ZodOptional' ||
      fs.isOptional?.();
    if (!isOptional) {
      // 默认值字段也算非必须
      const hasDefault = fs._def?.defaultValue !== undefined;
      if (!hasDefault) {
        required.push(key);
      }
    }
  }

  const result: Record<string, unknown> = {
    type: 'object',
    properties,
  };
  if (required.length > 0) {
    result.required = required;
  }
  return result;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function zodTypeToJsonType(schema: any): Record<string, unknown> {
  const typeName = schema._def?.typeName;

  switch (typeName) {
    case 'ZodString':
      return { type: 'string' };
    case 'ZodNumber':
      return { type: 'number' };
    case 'ZodBoolean':
      return { type: 'boolean' };
    case 'ZodEnum': {
      const values = schema._def?.values;
      if (Array.isArray(values)) {
        return { type: 'string', enum: values };
      }
      return { type: 'string' };
    }
    case 'ZodOptional':
      return zodTypeToJsonType(schema._def?.innerType);
    case 'ZodDefault':
      return zodTypeToJsonType(schema._def?.innerType);
    case 'ZodObject':
      return zodObjectToJsonSchema(schema);
    case 'ZodArray':
      return {
        type: 'array',
        items: zodTypeToJsonType(schema._def?.type),
      };
    default:
      return { type: 'string' };
  }
}

// 启动
const transport = new StdioServerTransport();
await server.connect(transport);
console.error('strategy-doctor MCP server running on stdio');
