// <!-- AGENT: BACKEND -->
import 'server-only';

import { createServiceClient } from '@/lib/supabase/server';
import { logOperationalEvent, OPERATIONAL_EVENTS } from '@/lib/observability/logger';

export type HealthState = 'healthy' | 'warning' | 'critical' | 'unknown';

export type RegistrationHealth = {
  pending_review_count: number;
  oldest_pending_at: string | null;
  payment_review_count: number;
  recent_24h_count: number;
  recent_7d_count: number;
  submission_failures_24h: number;
  approval_failures_24h: number;
  technical_failures_7d: number;
  oldest_active_failure_at: string | null;
};

export type EmailHealth = {
  lease_seconds: number;
  eligible_to_send_count: number;
  active_claim_count: number;
  stuck_claim_count: number;
  oldest_stuck_claim_at: string | null;
  retryable_failure_count: number;
  smtp_failures_24h: number;
  smtp_failures_7d: number;
  last_success_at: string | null;
  last_failure_at: string | null;
};

export type WebhookHealth = {
  lease_seconds: number;
  pending_due_count: number;
  retry_scheduled_count: number;
  permanently_failed_count: number;
  abandoned_processing_count: number;
  oldest_outstanding_at: string | null;
  last_success_at: string | null;
  last_failure_at: string | null;
  failures_24h: number;
  failures_7d: number;
};

export type PulseHealth = {
  abandoned_after_seconds: number;
  last_success_at: string | null;
  last_partial_at: string | null;
  last_failure_at: string | null;
  abandoned_running_count: number;
  lock_skips_24h: number;
  lock_skips_7d: number;
  latest_run_failed_configs: number;
  latest_success_cards_created: number;
  latest_run_at: string | null;
};

export type HealthResult<T> =
  | { available: true; state: HealthState; data: T }
  | { available: false; state: 'unknown'; data: null };

function ageHours(value: string | null, now = Date.now()) {
  return value ? Math.max(0, (now - new Date(value).getTime()) / 3_600_000) : 0;
}

export function classifyRegistrationHealth(data: RegistrationHealth): HealthState {
  if (data.approval_failures_24h >= 3 || data.submission_failures_24h >= 5) return 'critical';
  if (ageHours(data.oldest_pending_at) >= 72) return 'critical';
  if (
    data.approval_failures_24h > 0 ||
    data.submission_failures_24h > 0 ||
    ageHours(data.oldest_pending_at) >= 24
  ) return 'warning';
  return 'healthy';
}

export function classifyEmailHealth(data: EmailHealth): HealthState {
  if (data.stuck_claim_count >= 3 || data.smtp_failures_24h >= 3) return 'critical';
  if (
    data.stuck_claim_count > 0 ||
    data.smtp_failures_24h > 0 ||
    data.eligible_to_send_count > 0
  ) return 'warning';
  return 'healthy';
}

export function classifyWebhookHealth(data: WebhookHealth): HealthState {
  if (data.abandoned_processing_count > 0 || data.permanently_failed_count >= 3) return 'critical';
  if (
    data.permanently_failed_count > 0 ||
    data.retry_scheduled_count > 0 ||
    data.pending_due_count >= 5
  ) return 'warning';
  return 'healthy';
}

function isAfter(left: string | null, right: string | null) {
  if (!left) return false;
  return !right || new Date(left).getTime() > new Date(right).getTime();
}

export function classifyPulseHealth(data: PulseHealth): HealthState {
  if (
    data.abandoned_running_count > 0 ||
    data.lock_skips_24h >= 10 ||
    isAfter(data.last_failure_at, data.last_success_at)
  ) return 'critical';
  if (
    data.lock_skips_24h >= 3 ||
    data.latest_run_failed_configs > 0 ||
    isAfter(data.last_partial_at, data.last_success_at)
  ) return 'warning';
  return 'healthy';
}

async function runSummary<T>(
  functionName: string,
  churchId: string,
  classify: (data: T) => HealthState
): Promise<HealthResult<T>> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc(functionName, { p_church_id: churchId });
  if (error || !data || typeof data !== 'object') {
    logOperationalEvent({
      event: OPERATIONAL_EVENTS.operationalSummaryFailed,
      severity: 'error',
      outcome: 'unavailable',
      churchId,
      errorCode: 'operational_summary_unavailable',
      retryable: true,
      metadata: { summary: functionName },
    }, error);
    return { available: false, state: 'unknown', data: null };
  }
  const typedData = data as T;
  return { available: true, state: classify(typedData), data: typedData };
}

export async function loadOperationalHealth(churchId: string) {
  const [registration, email, webhooks, pulse] = await Promise.all([
    runSummary<RegistrationHealth>(
      'get_operational_registration_health',
      churchId,
      classifyRegistrationHealth
    ),
    runSummary<EmailHealth>('get_operational_email_health', churchId, classifyEmailHealth),
    runSummary<WebhookHealth>('get_operational_webhook_health', churchId, classifyWebhookHealth),
    runSummary<PulseHealth>('get_operational_pulse_health', churchId, classifyPulseHealth),
  ]);

  if (email.available && email.data.stuck_claim_count > 0) {
    logOperationalEvent({
      event: OPERATIONAL_EVENTS.emailClaimStuck,
      severity: email.state === 'critical' ? 'critical' : 'warning',
      outcome: 'detected',
      churchId,
      errorCode: 'email_claim_lease_expired',
      retryable: true,
      metadata: { count: email.data.stuck_claim_count },
    });
  }
  if (pulse.available && pulse.data.abandoned_running_count > 0) {
    logOperationalEvent({
      event: OPERATIONAL_EVENTS.missingPersonsRunAbandoned,
      severity: 'critical',
      outcome: 'detected',
      churchId,
      errorCode: 'pulse_run_abandoned',
      retryable: true,
      metadata: { count: pulse.data.abandoned_running_count },
    });
  }

  const states = [registration.state, email.state, webhooks.state, pulse.state];
  const overall: HealthState = states.includes('unknown')
    ? 'unknown'
    : states.includes('critical')
      ? 'critical'
      : states.includes('warning')
        ? 'warning'
        : 'healthy';

  return { overall, registration, email, webhooks, pulse };
}
