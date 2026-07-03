-- <!-- AGENT: ARCHITECT -->
-- Rationale: We need to enforce atomic capacity checks (counting guests, not rows) to prevent overselling.
-- We also need to enforce valid state transitions for event registrations, ensuring idempotent approvals.
-- By moving registration and approval into PL/pgSQL functions, we can lock the event row to serialize capacity checks,
-- ensure `amount_due` is always calculated server-side (`event.price * guests`), and make side-effects (person_events) fully transactional.
-- We also implement an outbox claim mechanism for email retries.
--
-- Rollback Notes:
-- DROP FUNCTION IF EXISTS public.register_for_event(UUID, UUID, VARCHAR, VARCHAR, VARCHAR, VARCHAR, INTEGER, TEXT, BOOLEAN);
-- DROP FUNCTION IF EXISTS public.approve_event_registration(UUID, UUID, VARCHAR);
-- DROP TRIGGER IF EXISTS trg_enforce_registration_status_transition ON public.event_registrations;
-- DROP FUNCTION IF EXISTS public.enforce_registration_status_transition();
-- DROP INDEX IF EXISTS public.idx_event_registrations_proof_url;
-- ALTER TABLE public.event_registrations DROP COLUMN IF EXISTS confirmation_email_claimed_at;

ALTER TABLE public.event_registrations ADD COLUMN IF NOT EXISTS confirmation_email_claimed_at TIMESTAMPTZ;

-- Before creating the index, check for duplicates and abort migration if any exist.
-- Manual reconciliation is required to avoid corrupting historical references.
DO $$
BEGIN
    IF EXISTS (
        SELECT payment_proof_url
        FROM public.event_registrations
        WHERE payment_proof_url IS NOT NULL
        GROUP BY payment_proof_url
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Duplicate payment_proof_urls exist. Run manual reconciliation before applying this migration.';
    END IF;
END $$;

DROP INDEX IF EXISTS public.idx_event_registrations_proof_url;
CREATE UNIQUE INDEX idx_event_registrations_proof_url
ON public.event_registrations(payment_proof_url)
WHERE payment_proof_url IS NOT NULL;


CREATE OR REPLACE FUNCTION public.enforce_registration_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.status = NEW.status THEN
        -- Allow idempotent updates (e.g., updating reviewed_by, confirmation_email_sent_at)
        RETURN NEW;
    END IF;

    IF OLD.status = 'pending_review' AND (NEW.status = 'approved' OR NEW.status = 'rejected') THEN
        -- Valid transitions
        RETURN NEW;
    END IF;

    RAISE EXCEPTION 'invalid_status_transition';
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_registration_status_transition ON public.event_registrations;
CREATE TRIGGER trg_enforce_registration_status_transition
BEFORE UPDATE OF status ON public.event_registrations
FOR EACH ROW
EXECUTE FUNCTION public.enforce_registration_status_transition();


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
    v_total_guests INTEGER;
    v_amount_due NUMERIC(10, 2);
    v_status public.registration_status;
    v_registration_id UUID;
    v_is_free BOOLEAN;
BEGIN
    -- 1. Lock the event row to serialize concurrent registrations and capacity checks
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

    -- 2. Validate guests
    IF p_guests IS NULL OR p_guests < 1 OR p_guests > 100 THEN
        RAISE EXCEPTION 'invalid_guest_count';
    END IF;

    -- 3. Check capacity using guest count (not rows), including approved and pending_review
    IF v_event.capacity IS NOT NULL THEN
        SELECT COALESCE(SUM(guests), 0) INTO v_total_guests
        FROM public.event_registrations
        WHERE event_id = p_event_id AND status != 'rejected';

        IF (v_total_guests + p_guests) > v_event.capacity THEN
            RAISE EXCEPTION 'event_full';
        END IF;
    END IF;

    -- 4. Calculate amount_due server-side
    v_amount_due := v_event.price * p_guests;
    v_is_free := v_event.price = 0;

    -- 5. Determine initial status
    -- All registrations start as pending_review.
    -- Free events will be auto-approved by the JS controller if no identity conflicts exist.
    v_status := 'pending_review';

    IF NOT v_is_free THEN
        -- Validate payment proof for paid events
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

    -- 6. Insert registration
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


CREATE OR REPLACE FUNCTION public.approve_event_registration(
    p_church_id UUID,
    p_registration_id UUID,
    p_reviewed_by VARCHAR
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_registration RECORD;
    v_event RECORD;
    v_person_id UUID;
    v_conflict TEXT;
BEGIN
    -- 1. Lock the registration row
    SELECT * INTO v_registration
    FROM public.event_registrations
    WHERE id = p_registration_id AND church_id = p_church_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Registration not found');
    END IF;

    IF v_registration.status != 'pending_review' AND v_registration.status != 'approved' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Registration cannot be approved');
    END IF;

    -- If already approved and person_id is set, it's idempotent success
    IF v_registration.status = 'approved' AND v_registration.person_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', true, 'already_approved', true);
    END IF;

    -- 2. Transactional person lookup/creation (returns specific columns)
    SELECT result_person_id, result_conflict INTO v_person_id, v_conflict
    FROM public.lookup_or_create_person(
        p_church_id,
        v_registration.email,
        v_registration.phone,
        v_registration.first_name,
        v_registration.last_name
    );

    IF v_conflict IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Identity conflict: ' || v_conflict);
    END IF;

    IF v_person_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Failed to resolve person identity');
    END IF;

    -- 3. Fetch event details for side-effects
    SELECT * INTO v_event FROM public.events WHERE id = v_registration.event_id;

    -- 4. Insert person_events log
    INSERT INTO public.person_events (
        church_id,
        person_id,
        source,
        event_type,
        metadata
    ) VALUES (
        p_church_id,
        v_person_id,
        'people',
        'event_registered',
        jsonb_build_object(
            'event_id', v_event.id,
            'event_name', v_event.name,
            'amount_paid', v_registration.amount_due
        )
    );

    -- 5. Update the registration
    UPDATE public.event_registrations
    SET
        status = 'approved',
        person_id = v_person_id,
        reviewed_by = p_reviewed_by,
        reviewed_at = NOW()
    WHERE id = p_registration_id;

    RETURN jsonb_build_object('success', true, 'person_id', v_person_id);
END;
$$;
REVOKE ALL ON FUNCTION public.approve_event_registration(UUID, UUID, VARCHAR) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_event_registration(UUID, UUID, VARCHAR) TO service_role;
