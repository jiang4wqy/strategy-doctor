export function simpleMovingAverage(
  prices: readonly number[],
  period: number,
  index: number,
): number | null {
  if (index < period - 1 || index >= prices.length) {
    return null;
  }

  let sum = 0;
  for (let cursor = index - period + 1; cursor <= index; cursor++) {
    sum += prices[cursor];
  }
  return sum / period;
}

export function populationStandardDeviation(
  prices: readonly number[],
  period: number,
  index: number,
): number | null {
  const average = simpleMovingAverage(prices, period, index);
  if (average === null) {
    return null;
  }

  let squaredDifferenceSum = 0;
  for (let cursor = index - period + 1; cursor <= index; cursor++) {
    const difference = prices[cursor] - average;
    squaredDifferenceSum += difference * difference;
  }
  return Math.sqrt(squaredDifferenceSum / period);
}

export function wilderRsi(
  prices: readonly number[],
  period: number,
  index: number,
): number | null {
  if (index < period || index >= prices.length) {
    return null;
  }

  let averageGain = 0;
  let averageLoss = 0;
  for (let cursor = 1; cursor <= period; cursor++) {
    const change = prices[cursor] - prices[cursor - 1];
    averageGain += Math.max(0, change);
    averageLoss += Math.max(0, -change);
  }
  averageGain /= period;
  averageLoss /= period;

  for (let cursor = period + 1; cursor <= index; cursor++) {
    const change = prices[cursor] - prices[cursor - 1];
    const gain = Math.max(0, change);
    const loss = Math.max(0, -change);
    averageGain = (averageGain * (period - 1) + gain) / period;
    averageLoss = (averageLoss * (period - 1) + loss) / period;
  }

  if (averageGain === 0 && averageLoss === 0) {
    return 50;
  }
  if (averageLoss === 0) {
    return 100;
  }
  if (averageGain === 0) {
    return 0;
  }

  const relativeStrength = averageGain / averageLoss;
  return 100 - 100 / (1 + relativeStrength);
}
