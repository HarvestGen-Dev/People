-- <!-- AGENT: ARCHITECT -->
-- Rationale: Event list and public event pages need registration counts and
-- capacity totals without transferring every registration row to Next.js.
-- Capacity must match migration 017 by summing guests for non-rejected
-- registrations, not by counting rows.
--
-- <!-- AGENT: DEVOPS -->
-- Rollback Notes:
-- DROP FUNCTION IF EXISTS public.event_registration_stats(UUID, UUID[]);
-- DROP INDEX IF EXISTS public.idx_event_registrations_stats;

CREATE INDEX IF NOT EXISTS idx_event_registrations_stats
ON public.event_registrations(church_id, event_id, status)
INCLUDE (guests);

CREATE OR REPLACE FUNCTION public.event_registration_stats(
    p_church_id UUID,
    p_event_ids UUID[] DEFAULT NULL
) RETURNS TABLE (
    event_id UUID,
    registration_count BIGINT,
    pending_count BIGINT,
    approved_count BIGINT,
    active_guest_count BIGINT,
    pending_guest_count BIGINT,
    approved_guest_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT
        er.event_id,
        COUNT(*)::BIGINT AS registration_count,
        COUNT(*) FILTER (WHERE er.status = 'pending_review')::BIGINT AS pending_count,
        COUNT(*) FILTER (WHERE er.status = 'approved')::BIGINT AS approved_count,
        COALESCE(SUM(er.guests) FILTER (WHERE er.status <> 'rejected'), 0)::BIGINT AS active_guest_count,
        COALESCE(SUM(er.guests) FILTER (WHERE er.status = 'pending_review'), 0)::BIGINT AS pending_guest_count,
        COALESCE(SUM(er.guests) FILTER (WHERE er.status = 'approved'), 0)::BIGINT AS approved_guest_count
    FROM public.event_registrations er
    WHERE er.church_id = p_church_id
      AND (p_event_ids IS NULL OR er.event_id = ANY(p_event_ids))
    GROUP BY er.event_id;
$$;

REVOKE ALL ON FUNCTION public.event_registration_stats(UUID, UUID[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_registration_stats(UUID, UUID[]) TO service_role;
