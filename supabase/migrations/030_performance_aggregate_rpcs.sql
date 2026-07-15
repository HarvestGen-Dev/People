-- <!-- AGENT: ARCHITECT -->
-- Rationale: Move aggregate-heavy dashboard, event index, and registration count queries into Postgres
-- so Next.js does not fan out repeated exact counts or load registration rows just to summarize them.
-- These functions are service-role only because they bypass RLS through SECURITY DEFINER and require
-- an already-authorized tenant context from the server.
--
-- Rollback plan:
-- 1. DROP FUNCTION IF EXISTS public.get_event_capacity_claimed_spots(UUID, UUID);
-- 2. DROP FUNCTION IF EXISTS public.get_registration_status_counts(UUID, UUID);
-- 3. DROP FUNCTION IF EXISTS public.get_event_index_with_stats(UUID);
-- 4. DROP FUNCTION IF EXISTS public.get_dashboard_summary(UUID);
-- 5. DROP INDEX IF EXISTS public.idx_workflow_cards_church_completed_due;
-- 6. DROP INDEX IF EXISTS public.idx_person_events_church_occurred_at_desc;
-- 7. DROP INDEX IF EXISTS public.idx_event_registrations_church_event_status_created_at;
-- 8. DROP INDEX IF EXISTS public.idx_event_registrations_church_event_created_at;
-- 9. DROP INDEX IF EXISTS public.idx_people_church_status_created_at;
-- 10. DROP INDEX IF EXISTS public.idx_people_church_name_order;

CREATE INDEX IF NOT EXISTS idx_people_church_name_order
  ON public.people(church_id, last_name, first_name);

CREATE INDEX IF NOT EXISTS idx_people_church_status_created_at
  ON public.people(church_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_registrations_church_event_created_at
  ON public.event_registrations(church_id, event_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_registrations_church_event_status_created_at
  ON public.event_registrations(church_id, event_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_person_events_church_occurred_at_desc
  ON public.person_events(church_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_cards_church_completed_due
  ON public.workflow_cards(church_id, completed_at, due_date);

CREATE OR REPLACE FUNCTION public.get_dashboard_summary(p_church_id UUID)
RETURNS TABLE (
  active_count BIGINT,
  visitor_count BIGINT,
  new_this_month_count BIGINT,
  activity_this_week_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH boundaries AS (
    SELECT
      date_trunc('month', now()) AS month_start,
      (date_trunc('week', now() + interval '1 day') - interval '1 day') AS week_start
  ),
  people_summary AS (
    SELECT
      COUNT(*) FILTER (WHERE person.status = 'active') AS active_count,
      COUNT(*) FILTER (WHERE person.status = 'visitor') AS visitor_count,
      COUNT(*) FILTER (WHERE person.created_at >= boundaries.month_start) AS new_this_month_count
    FROM public.people AS person
    CROSS JOIN boundaries
    WHERE person.church_id = p_church_id
  ),
  activity_summary AS (
    SELECT COUNT(*) AS activity_this_week_count
    FROM public.person_events AS person_event
    CROSS JOIN boundaries
    WHERE person_event.church_id = p_church_id
      AND person_event.occurred_at >= boundaries.week_start
  )
  SELECT
    people_summary.active_count,
    people_summary.visitor_count,
    people_summary.new_this_month_count,
    activity_summary.activity_this_week_count
  FROM people_summary
  CROSS JOIN activity_summary;
$$;

REVOKE ALL ON FUNCTION public.get_dashboard_summary(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_summary(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.get_event_index_with_stats(p_church_id UUID)
RETURNS TABLE (
  id UUID,
  display_id TEXT,
  church_id UUID,
  slug VARCHAR,
  name VARCHAR,
  description TEXT,
  cover_image_url TEXT,
  location VARCHAR,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  capacity INTEGER,
  price NUMERIC,
  currency VARCHAR,
  payment_qr_url TEXT,
  payment_link TEXT,
  payment_instructions TEXT,
  status public.event_status,
  target_workflow_id UUID,
  created_by VARCHAR,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  registration_count BIGINT,
  pending_count BIGINT,
  approved_count BIGINT,
  spots_remaining INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH registration_stats AS (
    SELECT
      registration.event_id,
      COUNT(*) AS registration_count,
      COUNT(*) FILTER (WHERE registration.status = 'pending_review') AS pending_count,
      COUNT(*) FILTER (WHERE registration.status = 'approved') AS approved_count,
      COALESCE(SUM(registration.guests) FILTER (WHERE registration.status <> 'rejected'), 0) AS claimed_spots
    FROM public.event_registrations AS registration
    WHERE registration.church_id = p_church_id
    GROUP BY registration.event_id
  )
  SELECT
    event.id,
    event.display_id,
    event.church_id,
    event.slug,
    event.name,
    event.description,
    event.cover_image_url,
    event.location,
    event.start_at,
    event.end_at,
    event.capacity,
    event.price,
    event.currency,
    event.payment_qr_url,
    event.payment_link,
    event.payment_instructions,
    event.status,
    event.target_workflow_id,
    event.created_by,
    event.created_at,
    event.updated_at,
    COALESCE(registration_stats.registration_count, 0) AS registration_count,
    COALESCE(registration_stats.pending_count, 0) AS pending_count,
    COALESCE(registration_stats.approved_count, 0) AS approved_count,
    CASE
      WHEN event.capacity IS NULL THEN NULL
      ELSE event.capacity - COALESCE(registration_stats.claimed_spots, 0)::INTEGER
    END AS spots_remaining
  FROM public.events AS event
  LEFT JOIN registration_stats
    ON registration_stats.event_id = event.id
  WHERE event.church_id = p_church_id
  ORDER BY event.start_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_event_index_with_stats(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_event_index_with_stats(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.get_registration_status_counts(
  p_church_id UUID,
  p_event_id UUID
)
RETURNS TABLE (
  all_count BIGINT,
  pending_review_count BIGINT,
  approved_count BIGINT,
  rejected_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    COUNT(*) AS all_count,
    COUNT(*) FILTER (WHERE registration.status = 'pending_review') AS pending_review_count,
    COUNT(*) FILTER (WHERE registration.status = 'approved') AS approved_count,
    COUNT(*) FILTER (WHERE registration.status = 'rejected') AS rejected_count
  FROM public.event_registrations AS registration
  WHERE registration.church_id = p_church_id
    AND registration.event_id = p_event_id;
$$;

REVOKE ALL ON FUNCTION public.get_registration_status_counts(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_registration_status_counts(UUID, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.get_event_capacity_claimed_spots(
  p_church_id UUID,
  p_event_id UUID
)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(SUM(registration.guests), 0)::INTEGER
  FROM public.event_registrations AS registration
  WHERE registration.church_id = p_church_id
    AND registration.event_id = p_event_id
    AND registration.status <> 'rejected';
$$;

REVOKE ALL ON FUNCTION public.get_event_capacity_claimed_spots(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_event_capacity_claimed_spots(UUID, UUID) TO service_role;
