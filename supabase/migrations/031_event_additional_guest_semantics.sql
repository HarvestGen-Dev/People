-- 031_event_additional_guest_semantics.sql
-- <!-- AGENT: ARCHITECT -->
-- Rationale: Product semantics now define event_registrations.guests as
-- additional guests excluding the primary registrant. The column name remains
-- for API/database compatibility; all capacity math must count 1 + guests for
-- non-rejected registrations.
--
-- Historical rows are intentionally not rewritten here. The previous public
-- registration route and UI submitted total-attendee counts, but direct
-- service-role/database inserts cannot be proven from migration context alone.
-- Production rollout must audit historical rows before reconciliation:
--
--   SELECT
--     church_id,
--     COUNT(*) AS registrations,
--     COUNT(*) FILTER (WHERE guests > 0) AS rows_with_guest_values,
--     MIN(created_at) AS oldest_registration,
--     MAX(created_at) AS newest_registration
--   FROM public.event_registrations
--   GROUP BY church_id;
--
-- If a tenant's pre-031 rows are confirmed to use legacy total-attendee
-- semantics, reconcile them with an explicit, reviewed operational script:
--
--   UPDATE public.event_registrations
--   SET guests = GREATEST(guests - 1, 0)
--   WHERE church_id = '<confirmed church id>'
--     AND created_at < '<031 deployment timestamp>'
--     AND guests > 0;

ALTER TABLE public.event_registrations
  DROP CONSTRAINT IF EXISTS event_registrations_guests_range;

ALTER TABLE public.event_registrations
  ADD CONSTRAINT event_registrations_guests_range
  CHECK (guests >= 0 AND guests <= 20) NOT VALID;

ALTER TABLE public.event_registrations
  VALIDATE CONSTRAINT event_registrations_guests_range;

COMMENT ON COLUMN public.event_registrations.guests IS
  'Additional guest count excluding the primary registrant. Claimed capacity is 1 + guests.';

CREATE OR REPLACE FUNCTION public.register_for_event(
    p_church_id UUID,
    p_event_id UUID,
    p_first_name VARCHAR,
    p_last_name VARCHAR,
    p_email VARCHAR,
    p_phone VARCHAR,
    p_guests INTEGER,
    p_payment_proof_url TEXT,
    p_paid_checkbox BOOLEAN
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_event RECORD;
    v_claimed_spots INTEGER;
    v_requested_spots INTEGER;
    v_amount_due NUMERIC(10, 2);
    v_status public.registration_status;
    v_registration_id UUID;
    v_is_free BOOLEAN;
BEGIN
    SELECT * INTO v_event
    FROM public.events
    WHERE id = p_event_id AND church_id = p_church_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'event_not_found';
    END IF;

    IF v_event.status != 'published' THEN
        RAISE EXCEPTION 'event_not_published';
    END IF;

    IF v_event.start_at < NOW() THEN
        RAISE EXCEPTION 'event_closed';
    END IF;

    IF p_guests IS NULL OR p_guests < 0 OR p_guests > 20 THEN
        RAISE EXCEPTION 'invalid_guest_count';
    END IF;

    v_requested_spots := 1 + p_guests;

    IF v_event.capacity IS NOT NULL THEN
        SELECT COALESCE(SUM(1 + registration.guests), 0)::INTEGER
        INTO v_claimed_spots
        FROM public.event_registrations AS registration
        WHERE registration.church_id = p_church_id
          AND registration.event_id = p_event_id
          AND registration.status <> 'rejected';

        IF (v_claimed_spots + v_requested_spots) > v_event.capacity THEN
            RAISE EXCEPTION 'event_full';
        END IF;
    END IF;

    v_amount_due := v_event.price * v_requested_spots;
    v_is_free := v_event.price = 0;
    v_status := 'pending_review';

    IF NOT v_is_free THEN
        IF p_payment_proof_url IS NULL OR p_payment_proof_url NOT LIKE (p_church_id::TEXT || '/' || p_event_id::TEXT || '/%') THEN
            RAISE EXCEPTION 'invalid_payment_proof';
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM storage.objects
            WHERE bucket_id = 'payment-proofs'
              AND name = p_payment_proof_url
        ) THEN
            RAISE EXCEPTION 'payment_proof_not_found';
        END IF;

        IF EXISTS (
            SELECT 1 FROM public.event_registrations
            WHERE payment_proof_url = p_payment_proof_url
        ) THEN
            RAISE EXCEPTION 'proof_already_used';
        END IF;
    END IF;

    INSERT INTO public.event_registrations (
        church_id,
        event_id,
        first_name,
        last_name,
        email,
        phone,
        guests,
        amount_due,
        payment_proof_url,
        paid_checkbox,
        status
    ) VALUES (
        p_church_id,
        p_event_id,
        p_first_name,
        p_last_name,
        p_email,
        p_phone,
        p_guests,
        v_amount_due,
        p_payment_proof_url,
        COALESCE(p_paid_checkbox, FALSE),
        v_status
    ) RETURNING id INTO v_registration_id;

    RETURN v_registration_id;
END;
$$;

REVOKE ALL ON FUNCTION public.register_for_event(UUID, UUID, VARCHAR, VARCHAR, VARCHAR, VARCHAR, INTEGER, TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_for_event(UUID, UUID, VARCHAR, VARCHAR, VARCHAR, VARCHAR, INTEGER, TEXT, BOOLEAN) TO service_role;

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
      COALESCE(SUM(1 + registration.guests) FILTER (WHERE registration.status <> 'rejected'), 0) AS claimed_spots
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
  SELECT COALESCE(SUM(1 + registration.guests), 0)::INTEGER
  FROM public.event_registrations AS registration
  WHERE registration.church_id = p_church_id
    AND registration.event_id = p_event_id
    AND registration.status <> 'rejected';
$$;

REVOKE ALL ON FUNCTION public.get_event_capacity_claimed_spots(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_event_capacity_claimed_spots(UUID, UUID) TO service_role;
