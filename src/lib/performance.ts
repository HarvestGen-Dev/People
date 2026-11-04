// <!-- AGENT: BACKEND -->
type AsyncOperation<T> = PromiseLike<T> | (() => PromiseLike<T>);

export type PerformanceTrackerOptions = {
  requestId?: string;
  sampleRate?: number;
  slowQueryThresholdMs?: number;
  slowRequestThresholdMs?: number;
};

type SlowOperation = {
  label: string;
  durationMs: number;
};

const DEFAULT_SLOW_QUERY_THRESHOLD_MS = 100;
const DEFAULT_SLOW_REQUEST_THRESHOLD_MS = 250;

function parseSampleRate(): number {
  const envVal = process.env.PERF_SAMPLE_RATE;
  if (!envVal) return process.env.NODE_ENV === 'production' ? 0.05 : 1.0;
  const parsed = parseFloat(envVal);
  return Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : 0.05;
}

export function createRequestPerformanceTracker(
  name: string,
  options: PerformanceTrackerOptions = {}
) {
  const isDev = process.env.NODE_ENV !== 'production';
  const sampleRate = options.sampleRate ?? parseSampleRate();
  const slowQueryThreshold =
    options.slowQueryThresholdMs ?? DEFAULT_SLOW_QUERY_THRESHOLD_MS;
  const slowRequestThreshold =
    options.slowRequestThresholdMs ?? DEFAULT_SLOW_REQUEST_THRESHOLD_MS;

  // Decide if this specific request is sampled
  const isSampled = isDev || Math.random() < sampleRate;
  const requestStartedAt = performance.now();

  let supabaseCallCount = 0;
  let cumulativeDownstreamMs = 0;
  let errorCount = 0;
  const slowOperations: SlowOperation[] = [];

  const track = async <T>(
    label: string,
    operation: AsyncOperation<T>
  ): Promise<T> => {
    const startedAt = performance.now();
    try {
      return await (typeof operation === 'function' ? operation() : operation);
    } catch (err) {
      errorCount += 1;
      throw err;
    } finally {
      const elapsedMs = performance.now() - startedAt;
      supabaseCallCount += 1;
      cumulativeDownstreamMs += elapsedMs;

      if (elapsedMs >= slowQueryThreshold) {
        slowOperations.push({
          label: label.slice(0, 64),
          durationMs: +elapsedMs.toFixed(1),
        });
      }

      if (isDev) {
        console.info(`[perf:${name}] ${label} ${elapsedMs.toFixed(1)}ms`);
      }
    }
  };

  const log = () => {
    try {
      const wallClockDurationMs = performance.now() - requestStartedAt;
      const isSlow =
        wallClockDurationMs >= slowRequestThreshold || slowOperations.length > 0;

      // Log if sampled or if slow
      if (!isSampled && !isSlow) return;

      const parallelFactor =
        wallClockDurationMs > 0
          ? +(cumulativeDownstreamMs / wallClockDurationMs).toFixed(2)
          : 1;

      const record = {
        type: 'performance_metric',
        name,
        request_id: options.requestId || undefined,
        wall_clock_ms: +wallClockDurationMs.toFixed(1),
        downstream_calls: supabaseCallCount,
        downstream_cumulative_ms: +cumulativeDownstreamMs.toFixed(1),
        parallel_factor: parallelFactor,
        slow: isSlow,
        slow_operations: slowOperations.length > 0 ? slowOperations : undefined,
        errors: errorCount > 0 ? errorCount : undefined,
      };

      if (isSlow && !isDev) {
        console.warn(JSON.stringify(record));
      } else if (!isDev) {
        console.info(JSON.stringify(record));
      } else {
        console.info(
          `[perf:${name}] total=${wallClockDurationMs.toFixed(1)}ms downstream_calls=${supabaseCallCount} cumulative_ms=${cumulativeDownstreamMs.toFixed(1)}ms parallel_factor=${parallelFactor}x`
        );
      }
    } catch {
      // Diagnostics must never throw
    }
  };

  return { track, log };
}
