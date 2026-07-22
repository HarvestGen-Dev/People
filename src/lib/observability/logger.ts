// <!-- AGENT: BACKEND -->

export const OPERATIONAL_EVENTS = {
  registrationSubmitFailed: 'registration.submit.failed',
  registrationApprovalFailed: 'registration.approval.failed',
  registrationRejectionFailed: 'registration.rejection.failed',
  emailClaimStuck: 'email.claim.stuck',
  emailSendFailed: 'email.send.failed',
  emailSendCompleted: 'email.send.completed',
  webhookDeliveryRetryScheduled: 'webhook.delivery.retry_scheduled',
  webhookDeliveryPermanentlyFailed: 'webhook.delivery.permanently_failed',
  webhookWorkerFailed: 'webhook.worker.failed',
  missingPersonsRunFailed: 'missing_persons.run.failed',
  missingPersonsRunPartial: 'missing_persons.run.partial',
  missingPersonsRunSkippedLocked: 'missing_persons.run.skipped_locked',
  missingPersonsRunAbandoned: 'missing_persons.run.abandoned',
  operationalSummaryFailed: 'operational.summary.failed',
} as const;

export type OperationalEventName =
  (typeof OPERATIONAL_EVENTS)[keyof typeof OPERATIONAL_EVENTS];
export type OperationalSeverity = 'info' | 'warning' | 'error' | 'critical';
type MetadataValue = string | number | boolean | null;

export type OperationalLogInput = {
  event: OperationalEventName;
  severity: OperationalSeverity;
  outcome?: string;
  requestId?: string;
  runId?: string;
  churchId?: string;
  resourceType?: string;
  resourceId?: string;
  errorCode?: string;
  retryable?: boolean;
  durationMs?: number;
  metadata?: Record<string, unknown>;
};

const MAX_METADATA_KEYS = 16;
const MAX_STRING_LENGTH = 256;
const REDACTED = '[redacted]';
const SENSITIVE_KEY =
  /(authorization|cookie|password|secret|token|api.?key|service.?role|smtp|payload|email.?body|pastoral|phone|payment.?proof|storage.?path)/i;
const SECRET_VALUE =
  /(bearer\s+\S+|people_k\d+_[\w.-]+|(?:password|secret|token|api[_-]?key)\s*[:=]\s*\S+)/gi;

function bounded(value: unknown, maxLength = MAX_STRING_LENGTH): string | undefined {
  if (typeof value !== 'string') return undefined;
  return value.replace(SECRET_VALUE, REDACTED).slice(0, maxLength);
}

export function sanitizeOperationalMetadata(
  metadata: Record<string, unknown> | undefined
): Record<string, MetadataValue> | undefined {
  if (!metadata) return undefined;

  const sanitized: Record<string, MetadataValue> = {};
  for (const [rawKey, rawValue] of Object.entries(metadata).slice(0, MAX_METADATA_KEYS)) {
    const key = rawKey.slice(0, 64);
    if (SENSITIVE_KEY.test(key)) {
      sanitized[key] = REDACTED;
      continue;
    }
    if (rawValue === null || typeof rawValue === 'number' || typeof rawValue === 'boolean') {
      sanitized[key] = rawValue;
    } else if (typeof rawValue === 'string') {
      sanitized[key] = bounded(rawValue) ?? '';
    } else {
      sanitized[key] = '[unsupported]';
    }
  }
  return sanitized;
}

export function normalizeOperationalError(error: unknown): {
  errorCode: string;
  errorMessage: string;
} {
  if (error instanceof Error) {
    const candidateCode = (error as Error & { code?: unknown }).code;
    return {
      errorCode: bounded(candidateCode, 64) || error.name.slice(0, 64) || 'error',
      errorMessage: bounded(error.message) || 'An internal operation failed.',
    };
  }
  return {
    errorCode: 'unknown_error',
    errorMessage: bounded(error) || 'An internal operation failed.',
  };
}

export function logOperationalEvent(input: OperationalLogInput, error?: unknown): void {
  try {
    const normalizedError = error === undefined ? null : normalizeOperationalError(error);
    const record = {
      timestamp: new Date().toISOString(),
      event: input.event,
      severity: input.severity,
      outcome: bounded(input.outcome, 64),
      request_id: bounded(input.requestId, 128),
      run_id: bounded(input.runId, 128),
      church_id: bounded(input.churchId, 128),
      resource_type: bounded(input.resourceType, 64),
      resource_id: bounded(input.resourceId, 128),
      error_code: bounded(input.errorCode, 64) || normalizedError?.errorCode,
      error_message: normalizedError?.errorMessage,
      retryable: input.retryable,
      duration_ms:
        typeof input.durationMs === 'number' && Number.isFinite(input.durationMs)
          ? Math.max(0, Math.round(input.durationMs))
          : undefined,
      metadata: sanitizeOperationalMetadata(input.metadata),
    };
    const output = JSON.stringify(record);
    if (input.severity === 'critical' || input.severity === 'error') {
      console.error(output);
    } else if (input.severity === 'warning') {
      console.warn(output);
    } else {
      console.log(output);
    }
  } catch {
    // Observability must never interrupt the business operation it describes.
  }
}
