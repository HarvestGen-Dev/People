// <!-- AGENT: BACKEND -->
import 'server-only';

import { createServiceClient } from '@/lib/supabase/server';

type RelatedOne<T> = T | T[] | null;

type EventRelation = {
  id: string;
  name: string;
  start_at: string;
};

type PersonRelation = {
  first_name: string;
  last_name: string;
};

type WebhookRelation = {
  id: string;
  name: string;
};

type PendingRegistrationRow = {
  id: string;
  event_id: string;
  first_name: string;
  last_name: string;
  email: string;
  guests: number;
  amount_due: number;
  created_at: string;
  events: RelatedOne<EventRelation>;
};

type StuckEmailRow = {
  id: string;
  event_id: string;
  first_name: string;
  last_name: string;
  email: string;
  confirmation_email_claimed_at: string | null;
  reviewed_at: string | null;
  created_at: string;
  events: RelatedOne<EventRelation>;
};

type ClaimRequestRow = {
  id: string;
  email: string;
  person_id: string;
  created_at: string;
  people: RelatedOne<PersonRelation>;
};

type WebhookFailureRow = {
  id: string;
  event_type: string;
  response_status: number | null;
  error_message: string | null;
  failed_at: string | null;
  created_at: string;
  webhooks: RelatedOne<WebhookRelation>;
};

export type ReviewQueueItem = {
  id: string;
  title: string;
  detail: string;
  href: string;
  createdAt: string;
  meta?: string;
};

export type ReviewQueue = {
  counts: {
    pendingRegistrations: number;
    claimRequests: number;
    stuckEmails: number;
    webhookFailures: number;
  };
  pendingRegistrations: ReviewQueueItem[];
  claimRequests: ReviewQueueItem[];
  stuckEmails: ReviewQueueItem[];
  webhookFailures: ReviewQueueItem[];
};

function one<T>(value: RelatedOne<T>): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function displayName(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`.trim();
}

export async function getReviewQueue(churchId: string): Promise<ReviewQueue> {
  const supabase = createServiceClient();

  const [
    pendingRegistrationCount,
    claimRequestCount,
    stuckEmailCount,
    webhookFailureCount,
    pendingRegistrationsResult,
    claimRequestsResult,
    stuckEmailsResult,
    webhookFailuresResult,
  ] = await Promise.all([
    supabase
      .from('event_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('church_id', churchId)
      .eq('status', 'pending_review'),
    supabase
      .from('person_claim_requests')
      .select('id', { count: 'exact', head: true })
      .eq('church_id', churchId)
      .eq('status', 'pending'),
    supabase
      .from('event_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('church_id', churchId)
      .eq('status', 'approved')
      .is('confirmation_email_sent_at', null),
    supabase
      .from('webhook_deliveries')
      .select('id', { count: 'exact', head: true })
      .eq('church_id', churchId)
      .not('failed_at', 'is', null),
    supabase
      .from('event_registrations')
      .select(`
        id,
        event_id,
        first_name,
        last_name,
        email,
        guests,
        amount_due,
        created_at,
        events(id, name, start_at)
      `)
      .eq('church_id', churchId)
      .eq('status', 'pending_review')
      .order('created_at', { ascending: true })
      .limit(8),
    supabase
      .from('person_claim_requests')
      .select('id, email, person_id, created_at, people(first_name, last_name)')
      .eq('church_id', churchId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(8),
    supabase
      .from('event_registrations')
      .select(`
        id,
        event_id,
        first_name,
        last_name,
        email,
        confirmation_email_claimed_at,
        reviewed_at,
        created_at,
        events(id, name, start_at)
      `)
      .eq('church_id', churchId)
      .eq('status', 'approved')
      .is('confirmation_email_sent_at', null)
      .order('reviewed_at', { ascending: true, nullsFirst: false })
      .limit(8),
    supabase
      .from('webhook_deliveries')
      .select(`
        id,
        event_type,
        response_status,
        error_message,
        failed_at,
        created_at,
        webhooks(id, name)
      `)
      .eq('church_id', churchId)
      .not('failed_at', 'is', null)
      .order('failed_at', { ascending: false })
      .limit(8),
  ]);

  const errors = [
    pendingRegistrationCount.error,
    claimRequestCount.error,
    stuckEmailCount.error,
    webhookFailureCount.error,
    pendingRegistrationsResult.error,
    claimRequestsResult.error,
    stuckEmailsResult.error,
    webhookFailuresResult.error,
  ].filter(Boolean);

  if (errors.length > 0) {
    throw errors[0];
  }

  const pendingRegistrations = (
    (pendingRegistrationsResult.data || []) as unknown as PendingRegistrationRow[]
  ).map((registration) => {
    const event = one(registration.events);
    return {
      id: registration.id,
      title: displayName(registration.first_name, registration.last_name),
      detail: `${registration.email} · ${registration.guests} guest${
        registration.guests === 1 ? '' : 's'
      } · RM ${registration.amount_due}`,
      href: `/events/${registration.event_id}/registrations`,
      createdAt: registration.created_at,
      meta: event?.name || 'Event registration',
    };
  });

  const claimRequests = (
    (claimRequestsResult.data || []) as unknown as ClaimRequestRow[]
  ).map((request) => {
    const person = one(request.people);
    return {
      id: request.id,
      title: person
        ? displayName(person.first_name, person.last_name)
        : 'Unknown profile',
      detail: request.email,
      href: '/settings/team',
      createdAt: request.created_at,
      meta: 'Profile claim',
    };
  });

  const stuckEmails = (
    (stuckEmailsResult.data || []) as unknown as StuckEmailRow[]
  ).map((registration) => {
    const event = one(registration.events);
    return {
      id: registration.id,
      title: displayName(registration.first_name, registration.last_name),
      detail: registration.email,
      href: `/events/${registration.event_id}/registrations`,
      createdAt:
        registration.confirmation_email_claimed_at ||
        registration.reviewed_at ||
        registration.created_at,
      meta: event?.name || 'Confirmation email pending',
    };
  });

  const webhookFailures = (
    (webhookFailuresResult.data || []) as unknown as WebhookFailureRow[]
  ).map((delivery) => {
    const webhook = one(delivery.webhooks);
    return {
      id: delivery.id,
      title: webhook?.name || 'Webhook delivery failed',
      detail:
        delivery.error_message ||
        (delivery.response_status
          ? `HTTP ${delivery.response_status}`
          : 'Delivery failed'),
      href: '/settings/webhooks',
      createdAt: delivery.failed_at || delivery.created_at,
      meta: delivery.event_type,
    };
  });

  return {
    counts: {
      pendingRegistrations: pendingRegistrationCount.count || 0,
      claimRequests: claimRequestCount.count || 0,
      stuckEmails: stuckEmailCount.count || 0,
      webhookFailures: webhookFailureCount.count || 0,
    },
    pendingRegistrations,
    claimRequests,
    stuckEmails,
    webhookFailures,
  };
}
