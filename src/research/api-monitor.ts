import type { ApiCallRecord, ApiCallTelemetry, ApiCallPathMetric } from '../platform/contracts.ts';

interface InternalPathMetric {
  count: number;
  errorCount: number;
  totalDurationMs: number;
  lastStatus: number;
  lastSeen: string;
}

export interface ApiCallMonitorService {
  record(
    method: ApiCallRecord['method'],
    path: string,
    statusCode: number,
    durationMs: number,
    requestId: string,
  ): void;
  getSnapshot(limit?: number): ApiCallTelemetry;
}

const MAX_ENTRIES = 300;

function pathBucket(pathname = ''): string {
  const trimmed = pathname.trim();
  if (!trimmed.startsWith('/')) {
    return '/unknown';
  }
  try {
    return new URL(trimmed, 'http://localhost').pathname || '/unknown';
  } catch {
    return trimmed;
  }
}

export function createApiCallMonitorService(): ApiCallMonitorService {
  const pathMetrics = new Map<string, InternalPathMetric>();
  const records: ApiCallRecord[] = [];

  function nowString(): string {
    return new Date().toISOString();
  }

  return {
    record(method, path, statusCode, durationMs, requestId) {
      const safePath = pathBucket(path);
      const metric = pathMetrics.get(safePath) ?? {
        count: 0,
        errorCount: 0,
        totalDurationMs: 0,
        lastStatus: statusCode,
        lastSeen: nowString(),
      };
      metric.count += 1;
      metric.totalDurationMs += durationMs;
      metric.lastStatus = statusCode;
      metric.lastSeen = nowString();
      if (statusCode >= 400) {
        metric.errorCount += 1;
      }
      pathMetrics.set(safePath, metric);

      records.push({
        id: randomId(),
        requestId,
        method,
        path: safePath,
        statusCode,
        durationMs,
        timestamp: nowString(),
      });
      if (records.length > MAX_ENTRIES) {
        records.shift();
      }
    },
    getSnapshot(limit = 30) {
      const totalCalls = records.length;
      const totalErrors = records.filter(entry => entry.statusCode >= 400).length;
      const topPaths: ApiCallPathMetric[] = [...pathMetrics.entries()]
        .map(([path, metric]) => ({
          path,
          count: metric.count,
          errorCount: metric.errorCount,
          avgDurationMs: Math.round(metric.totalDurationMs / metric.count),
          successRate: Number(
            (((metric.count - metric.errorCount) / metric.count) * 100).toFixed(2),
          ),
          lastStatus: metric.lastStatus,
          lastSeen: metric.lastSeen,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, Math.max(1, limit));

      return {
        windowStart: records.length > 0 ? records[0].timestamp : nowString(),
        windowEnd: nowString(),
        totalCalls,
        totalErrors,
        successRate: totalCalls === 0
          ? 100
          : Number((((totalCalls - totalErrors) / totalCalls) * 100).toFixed(2)),
        topPaths,
        recent: records
          .slice(-Math.max(1, Math.min(limit, records.length))),
      };
    },
  };
}

function randomId() {
  return Math.random().toString(36).slice(2, 12);
}
