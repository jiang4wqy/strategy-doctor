import type { StyleName } from '../contracts.ts';

export interface StyleProfile {
  style: StyleName;
  maxDrawdown: number;
  liquidationTolerance: number;
  pnlWeight: number;
  ddWeight: number;
}

export const STYLES: StyleProfile[] = [
  {
    style: 'conservative',
    maxDrawdown: 0.2,
    liquidationTolerance: 0,
    pnlWeight: 0.2,
    ddWeight: 0.8,
  },
  {
    style: 'aggressive',
    maxDrawdown: 0.6,
    liquidationTolerance: 0.2,
    pnlWeight: 0.7,
    ddWeight: 0.3,
  },
  {
    style: 'trend',
    maxDrawdown: 0.4,
    liquidationTolerance: 0.1,
    pnlWeight: 0.5,
    ddWeight: 0.5,
  },
];

export function getProfile(name: StyleName): StyleProfile {
  const profile = STYLES.find(candidate => candidate.style === name);
  if (!profile) {
    throw new Error(`未知风格: ${name}`);
  }
  return profile;
}
