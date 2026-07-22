// <!-- AGENT: BACKEND -->
import 'server-only';

import { createServiceClient } from '@/lib/supabase/server';
import {
  logOperationalEvent,
  normalizeOperationalError,
  sanitizeOperationalMetadata,
  type OperationalEventName,
  type OperationalSeverity,
} from '@/lib/observability/logger';

type IncidentInput = {
  churchId: string;
  event: OperationalEventName;
  severity: OperationalSeverity;
  resourceType?: string;
  resourceId?: string;
  requestId?: string;
  errorCode?: string;
  retryable?: boolean;
  error?: unknown;
  metadata?: Record<string, string | number | boolean | null>;
};

export async function recordOperationalIncident(input: IncidentInput): Promise<void> {
  const normalized = normalizeOperationalError(input.error);
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from('operational_incidents').insert({
      church_id: input.churchId,
      event_name: input.event,
      severity: input.severity,
      resource_type: input.resourceType ?? null,
      resource_id: input.resourceId ?? null,
      request_id: input.requestId ?? null,
      error_code: input.errorCode ?? normalized.errorCode,
      retryable: input.retryable ?? false,
      metadata: sanitizeOperationalMetadata(input.metadata) ?? {},
    });
    if (error) throw error;
  } catch (error) {
    logOperationalEvent(
      {
        event: input.event,
        severity: 'error',
        outcome: 'incident_record_failed',
        churchId: input.churchId,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        errorCode: 'incident_record_failed',
      },
      error
    );
  }
}

export async function resolveOperationalIncidents(input: {
  churchId: string;
  event: OperationalEventName;
  resourceId?: string;
}): Promise<void> {
  try {
    const supabase = createServiceClient();
    let query = supabase
      .from('operational_incidents')
      .update({ resolved_at: new Date().toISOString() })
      .eq('church_id', input.churchId)
      .eq('event_name', input.event)
      .is('resolved_at', null);
    if (input.resourceId) query = query.eq('resource_id', input.resourceId);
    const { error } = await query;
    if (error) throw error;
  } catch (error) {
    logOperationalEvent(
      {
        event: input.event,
        severity: 'warning',
        outcome: 'incident_resolution_failed',
        churchId: input.churchId,
        resourceId: input.resourceId,
        errorCode: 'incident_resolution_failed',
      },
      error
    );
  }
}
