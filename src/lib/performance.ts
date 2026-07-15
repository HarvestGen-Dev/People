// <!-- AGENT: BACKEND -->
type AsyncOperation<T> = PromiseLike<T> | (() => PromiseLike<T>);

export function createRequestPerformanceTracker(name: string) {
  const enabled = process.env.NODE_ENV !== 'production';
  const requestStartedAt = performance.now();
  let supabaseCallCount = 0;
  let supabaseDurationMs = 0;

  const track = async <T>(label: string, operation: AsyncOperation<T>): Promise<T> => {
    const startedAt = performance.now();
    try {
      return await (typeof operation === 'function' ? operation() : operation);
    } finally {
      const elapsedMs = performance.now() - startedAt;
      supabaseCallCount += 1;
      supabaseDurationMs += elapsedMs;

      if (enabled) {
        console.info(`[perf:${name}] ${label} ${elapsedMs.toFixed(1)}ms`);
      }
    }
  };

  const log = () => {
    if (!enabled) return;

    const elapsedMs = performance.now() - requestStartedAt;
    console.info(
      `[perf:${name}] total=${elapsedMs.toFixed(1)}ms supabase_calls=${supabaseCallCount} supabase_ms=${supabaseDurationMs.toFixed(1)}ms`
    );
  };

  return { track, log };
}
