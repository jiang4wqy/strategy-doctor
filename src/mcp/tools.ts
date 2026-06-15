// src/mcp/tools.ts — MCP 工具定义
//
// 只负责：定义工具名、描述、Zod 输入 schema、通过 Client 委派。
// 不包含应用/策略/回测逻辑。
// 不直接导入 application、strategy、backtest 模块。

import { z } from 'zod';
import type {
  StrategyDoctorClient,
} from '../client/index.ts';
import type {
  AnyStrategyDefinition,
  DiagnosisView,
  StrategyDraft,
} from '../platform/contracts.ts';

// ── Schema ──────────────────────────────────────────

const descriptionSchema = z
  .string()
  .min(1, 'description must be at least 1 character')
  .max(2000, 'description must be at most 2000 characters');

const styleSchema = z.enum(['conservative', 'aggressive', 'trend']);

const diagnoseInputSchema = z.object({
  strategy: z.string().min(1, 'strategy must be a non-empty JSON string'),
  style: styleSchema,
  seed: z.number().int().positive().optional().default(42),
  candidates: z.number().int().min(1).max(50).optional().default(6),
});

// ── Tool 定义 ───────────────────────────────────────

export interface McpTool<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  inputSchema: z.ZodType<TInput>;
  handler: (
    client: StrategyDoctorClient,
    input: TInput,
  ) => Promise<TOutput>;
}

/**
 * 列出策略医生支持的策略类型和能力
 */
export const listCapabilitiesTool: McpTool<
  Record<string, never>,
  readonly AnyStrategyDefinition[]
> = {
  name: 'list_strategy_capabilities',
  description: '列出策略医生当前支持的策略类型、参数定义和边界',
  inputSchema: z.object({}).strict(),
  async handler(client) {
    return client.capabilities();
  },
};

/**
 * 用自然语言描述策略，解析为结构化 JSON
 */
export const parseStrategyTool: McpTool<
  { description: string },
  StrategyDraft
> = {
  name: 'parse_strategy_description',
  description: '用一句话描述交易策略，返回结构化的策略 JSON 参数',
  inputSchema: z.object({
    description: descriptionSchema,
  }),
  async handler(client, input) {
    return client.parseStrategy({ description: input.description });
  },
};

/**
 * 对策略进行五维压力体检
 */
export const diagnoseStrategyTool: McpTool<
  {
    strategy: string;
    style: 'conservative' | 'aggressive' | 'trend';
    seed?: number;
    candidates?: number;
  },
  DiagnosisView
> = {
  name: 'diagnose_strategy',
  description: '对策略进行五维体检：诊断死因、三风格评分、开处方、held-out 复测',
  inputSchema: diagnoseInputSchema,
  async handler(client, input) {
    // strategy 从 JSON 字符串解析为对象
    let strategy: unknown;
    try {
      strategy = JSON.parse(input.strategy);
    } catch {
      throw new Error(
        `invalid strategy JSON: the strategy field must be a valid JSON string`,
      );
    }

    return client.diagnose({
      strategy: strategy as Parameters<StrategyDoctorClient['diagnose']>[0]['strategy'],
      style: input.style,
      seed: input.seed ?? 42,
      candidates: input.candidates ?? 6,
    });
  },
};

/** 所有工具的注册表 */
export const ALL_TOOLS: McpTool[] = [
  listCapabilitiesTool,
  parseStrategyTool,
  diagnoseStrategyTool,
];
