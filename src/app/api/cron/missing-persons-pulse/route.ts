// <!-- AGENT: BACKEND -->
import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { isAuthorizedCronRequest } from '@/lib/cron-auth';
import { createServiceClient } from '@/lib/supabase/server';
import type { MissingPersonsPulseResult } from '@/lib/types';
import { logOperationalEvent, OPERATIONAL_EVENTS } from '@/lib/observability/logger';

const RUN_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PULSE_STATUSES = new Set([
  'running',
  'completed',
  'completed_with_errors',
  'failed',
  'skipped_locked',
]);

function isPulseResult(value: unknown): value is MissingPersonsPulseResult {
  if (!value || typeof value !== 'object') return false;

  const result = value as Partial<MissingPersonsPulseResult>;
  return (
    typeof result.run_id === 'string' &&
    typeof result.status === 'string' &&
    PULSE_STATUSES.has(result.status) &&
    typeof result.configs_processed === 'number' &&
    typeof result.configs_failed === 'number' &&
    typeof result.configs_skipped === 'number' &&
    typeof result.people_scanned === 'number' &&
    typeof result.people_matched === 'number' &&
    typeof result.cards_created === 'number' &&
    typeof result.cards_skipped === 'number'
  );
}

export async function GET() {
  return NextResponse.json(
    {
      error: {
        code: 'method_not_allowed',
        message: 'Method not allowed.',
      },
    },
    { status: 405, headers: { Allow: 'POST' } }
  );
}

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    logOperationalEvent({
      event: OPERATIONAL_EVENTS.missingPersonsRunFailed,
      severity: 'critical',
      outcome: 'configuration_missing',
      errorCode: 'cron_not_configured',
      retryable: false,
    });
    return NextResponse.json(
      {
        error: {
          code: 'cron_not_configured',
          message: 'Cron is not configured.',
        },
      },
      { status: 503 }
    );
  }

  if (!isAuthorizedCronRequest(request.headers.get('authorization'), secret)) {
    return NextResponse.json(
      {
        error: {
          code: 'unauthorized',
          message: 'Unauthorized.',
        },
      },
      { status: 401 }
    );
  }

  const requestedRunId = request.headers.get('x-cron-run-id');
  if (requestedRunId && !RUN_ID_PATTERN.test(requestedRunId)) {
    return NextResponse.json(
      {
        error: {
          code: 'invalid_run_id',
          message: 'The run identifier is invalid.',
        },
      },
      { status: 400 }
    );
  }

  const runId = requestedRunId ?? randomUUID();
  const startedAt = performance.now();
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc('run_missing_persons_pulse', {
    p_run_id: runId,
  });

  if (error) {
    logOperationalEvent({
      event: OPERATIONAL_EVENTS.missingPersonsRunFailed,
      severity: 'error',
      outcome: 'rpc_failed',
      runId,
      errorCode: 'pulse_execution_failed',
      retryable: true,
      durationMs: performance.now() - startedAt,
    }, error);

    return NextResponse.json(
      {
        run_id: runId,
        status: 'failed',
        error: {
          code: 'pulse_execution_failed',
          message: 'The missing-person pulse could not be completed.',
        },
      },
      { status: 500 }
    );
  }

  if (!isPulseResult(data)) {
    logOperationalEvent({
      event: OPERATIONAL_EVENTS.missingPersonsRunFailed,
      severity: 'error',
      outcome: 'invalid_rpc_result',
      runId,
      errorCode: 'invalid_pulse_result',
      retryable: true,
      durationMs: performance.now() - startedAt,
    });

    return NextResponse.json(
      {
        run_id: runId,
        status: 'failed',
        error: {
          code: 'invalid_pulse_result',
          message: 'The missing-person pulse returned an invalid result.',
        },
      },
      { status: 500 }
    );
  }

  if (data.status === 'failed' || data.status === 'completed_with_errors' || data.status === 'skipped_locked') {
    const event = data.status === 'failed'
      ? OPERATIONAL_EVENTS.missingPersonsRunFailed
      : data.status === 'completed_with_errors'
        ? OPERATIONAL_EVENTS.missingPersonsRunPartial
        : OPERATIONAL_EVENTS.missingPersonsRunSkippedLocked;
    logOperationalEvent({
      event,
      severity: data.status === 'failed' ? 'error' : 'warning',
      outcome: data.status,
      runId: data.run_id,
      durationMs: performance.now() - startedAt,
      retryable: true,
      metadata: {
        configs_processed: data.configs_processed,
        configs_failed: data.configs_failed,
        configs_skipped: data.configs_skipped,
        cards_created: data.cards_created,
      },
    });
  }

  return NextResponse.json(data, {
    status: data.status === 'failed' ? 500 : 200,
  });
}
