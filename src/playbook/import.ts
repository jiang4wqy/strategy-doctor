import type { Strategy } from '../contracts.ts';
import type { StrategyDraft } from '../platform/contracts.ts';
import { parseStrategy } from '../strategy/parse.ts';

export type PlaybookImportSource = 'strategy-json' | 'description';

export interface PlaybookImportResult {
  source: PlaybookImportSource;
  playbookId?: string;
  playbookName?: string;
  description?: string;
  strategy: Strategy;
}

export type PlaybookDescriptionParser = (
  description: string,
) => Promise<StrategyDraft>;

export class PlaybookImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlaybookImportError';
  }
}

function record(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function stringField(
  source: Record<string, unknown> | undefined,
  keys: string[],
): string | undefined {
  if (!source) {
    return undefined;
  }
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return value;
  }
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return value;
  }
}

function nestedRecord(
  source: Record<string, unknown> | undefined,
  key: string,
): Record<string, unknown> | undefined {
  return record(parseMaybeJson(source?.[key]));
}

function strategyCandidates(
  source: Record<string, unknown>,
  nested: Record<string, unknown> | undefined,
): unknown[] {
  return [
    source.strategy,
    source.strategyJson,
    source.strategy_json,
    source.strategyDefinition,
    nested?.strategy,
    nested?.strategyJson,
    nested?.strategy_json,
    nested?.strategyDefinition,
  ].map(parseMaybeJson);
}

function descriptionCandidates(
  source: Record<string, unknown>,
  nested: Record<string, unknown> | undefined,
): string | undefined {
  return stringField(source, [
    'description',
    'strategyIdea',
    'strategy_idea',
    'idea',
    'prompt',
    'thesis',
  ]) ?? stringField(nested, [
    'description',
    'strategyIdea',
    'strategy_idea',
    'idea',
    'prompt',
    'thesis',
  ]);
}

function metadata(source: Record<string, unknown>) {
  const nested = nestedRecord(source, 'playbook')
    ?? nestedRecord(source, 'agent');
  return {
    nested,
    playbookId: stringField(source, [
      'playbookId',
      'playbook_id',
      'agentId',
      'agent_id',
      'id',
    ]) ?? stringField(nested, [
      'playbookId',
      'playbook_id',
      'agentId',
      'agent_id',
      'id',
    ]),
    playbookName: stringField(source, [
      'playbookName',
      'playbook_name',
      'name',
      'title',
    ]) ?? stringField(nested, [
      'playbookName',
      'playbook_name',
      'name',
      'title',
    ]),
  };
}

export async function importPlaybookStrategy(
  input: unknown,
  parseDescription: PlaybookDescriptionParser,
): Promise<PlaybookImportResult> {
  const source = record(parseMaybeJson(input));
  if (!source) {
    throw new PlaybookImportError('Playbook payload must be an object.');
  }
  const meta = metadata(source);

  for (const candidate of strategyCandidates(source, meta.nested)) {
    if (candidate === undefined) {
      continue;
    }
    return {
      source: 'strategy-json',
      playbookId: meta.playbookId,
      playbookName: meta.playbookName,
      strategy: parseStrategy(candidate),
    };
  }

  const description = descriptionCandidates(source, meta.nested);
  if (description) {
    const draft = await parseDescription(description);
    return {
      source: 'description',
      playbookId: meta.playbookId,
      playbookName: meta.playbookName,
      description,
      strategy: draft.strategy,
    };
  }

  throw new PlaybookImportError(
    'Playbook payload must include strategy JSON or a strategy description.',
  );
}
