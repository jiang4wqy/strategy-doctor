import type { MarketShock } from '../contracts.ts';

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function generatePath(
  shock: MarketShock,
  totalBars = 240,
  startPrice = 100,
): number[] {
  const random = mulberry32(shock.seed);
  const prices = [startPrice];
  const shockStart = Math.floor(totalBars / 3);
  const shockEnd = Math.min(totalBars - 1, shockStart + shock.durationBars);
  const span = Math.max(1, shockEnd - shockStart);
  const squeezeRiseBars = Math.max(1, Math.floor(span / 3));
  const baseVolatility = 0.008 * shock.volMult;

  for (let index = 1; index < totalBars; index++) {
    let drift = 0.0005;
    let jump = 0;

    if (index >= shockStart && index < shockEnd) {
      const shockOffset = index - shockStart;
      switch (shock.kind) {
        case 'crash':
        case 'grind':
          drift = -shock.magnitude / span;
          break;
        case 'squeeze':
          drift = shockOffset < squeezeRiseBars
            ? (shock.magnitude / 2) / squeezeRiseBars
            : -(shock.magnitude * 1.5) / Math.max(1, span - squeezeRiseBars);
          break;
        case 'whipsaw':
          drift = Math.sin((shockOffset / span) * Math.PI * 6) * shock.magnitude / 8;
          break;
        case 'gap':
          if (index === shockStart) {
            jump = -shock.magnitude;
          }
          break;
      }
    }

    const noise = (random() * 2 - 1) * baseVolatility;
    const nextPrice = prices[index - 1] * (1 + drift + noise + jump);
    prices.push(Math.max(0.01, nextPrice));
  }

  return prices;
}
