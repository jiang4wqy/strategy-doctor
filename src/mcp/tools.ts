import { z } from 'zod';
import type {
  StrategyDoctorClient,
} from '../client/index.ts';
import type {
  AnyStrategyDefinition,
  DiagnosisView,
  StrategyDraft,
} from '../platform/contracts.ts';

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

export interface McpTool<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  inputSchema: z.ZodType<TInput>;
  handler: (
    client: StrategyDoctorClient,
    input: TInput,
  ) => Promise<TOutput>;
  invoke: (
    client: StrategyDoctorClient,
    rawInput: unknown,
  ) => Promise<TOutput>;
}

export interface RegisteredMcpTool {
  name: string;
  description: string;
  inputSchema: z.ZodType;
  invoke: (
    client: StrategyDoctorClient,
    rawInput: unknown,
  ) => Promise<unknown>;
}

function defineMcpTool<TInput, TOutput>(
  tool: Omit<McpTool<TInput, TOutput>, 'invoke'>,
): McpTool<TInput, TOutput> {
  return {
    ...tool,
    async invoke(client, rawInput) {
      const input = tool.inputSchema.parse(rawInput);
      return tool.handler(client, input);
    },
  };
}

export const listCapabilitiesTool: McpTool<
  Record<string, never>,
  readonly AnyStrategyDefinition[]
> = defineMcpTool({
  name: 'list_strategy_capabilities',
  description:
    'List the registered strategy archetypes, parameter definitions, examples, and validation boundaries.',
  inputSchema: z.object({}).strict(),
  async handler(client) {
    return client.capabilities();
  },
});

export const parseStrategyTool: McpTool<
  { description: string },
  StrategyDraft
> = defineMcpTool({
  name: 'parse_strategy_description',
  description:
    'Parse a natural-language trading-strategy description into a structured strategy draft.',
  inputSchema: z.object({
    description: descriptionSchema,
  }),
  async handler(client, input) {
    return client.parseStrategy({ description: input.description });
  },
});

export const diagnoseStrategyTool: McpTool<
  {
    strategy: string;
    style: 'conservative' | 'aggressive' | 'trend';
    seed: number;
    candidates: number;
  },
  DiagnosisView
> = defineMcpTool({
  name: 'diagnose_strategy',
  description:
    'Run five-dimension strategy diagnosis with failure causes, profile scores, targeted prescription, and held-out validation.',
  inputSchema: diagnoseInputSchema,
  async handler(client, input) {
    let strategy: unknown;
    try {
      strategy = JSON.parse(input.strategy);
    } catch {
      throw new Error(
        'invalid strategy JSON: the strategy field must be a valid JSON string',
      );
    }

    return client.diagnose({
      strategy: strategy as Parameters<StrategyDoctorClient['diagnose']>[0]['strategy'],
      style: input.style,
      seed: input.seed ?? 42,
      candidates: input.candidates ?? 6,
    });
  },
});

export const ALL_TOOLS: readonly RegisteredMcpTool[] = [
  listCapabilitiesTool,
  parseStrategyTool,
  diagnoseStrategyTool,
];
