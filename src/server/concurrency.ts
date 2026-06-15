import { ServerBusyError } from './errors.ts';

export class DiagnosisLimiter {
  private readonly maximum: number;
  private active = 0;

  constructor(maximum = 2) {
    if (!Number.isInteger(maximum) || maximum < 1) {
      throw new Error('maximum diagnosis capacity must be a positive integer');
    }
    this.maximum = maximum;
  }

  async run<T>(operation: () => Promise<T>): Promise<T> {
    if (this.active >= this.maximum) {
      throw new ServerBusyError();
    }
    this.active++;
    try {
      return await operation();
    } finally {
      this.active--;
    }
  }
}
