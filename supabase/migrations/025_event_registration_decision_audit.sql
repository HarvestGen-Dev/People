-- <!-- AGENT: ARCHITECT -->
-- Rationale: Event registration decisions need a durable audit trail that
-- identifies the admin who approved or rejected a registration. The legacy
-- reviewed_by column stores a free-form email only, which is useful for display
-- but not a stable actor reference. This migration adds explicit actor fields,
-- preserves existing data, and enforces reviewer data on future manual
-- decisions.
--
-- Rollback Notes:
-- DROP FUNCTION IF EXISTS public.approve_event_registration(UUID, UUID, VARCHAR, UUID);
-- Recreate the previous approve_event_registration(UUID, UUID, VARCHAR) body from
-- migration 017_event_registration_integrity.sql.
-- ALTER TABLE public.event_registrations DROP CONSTRAINT IF EXISTS event_registrations_reviewed_by_actor_check;
-- ALTER TABLE public.event_registrations DROP CONSTRAINT IF EXISTS event_registrations_review_actor_check;
-- ALTER TABLE public.event_registrations DROP COLUMN IF EXISTS reviewed_by_actor;
-- ALTER TABLE public.event_registrations DROP COLUMN IF EXISTS reviewed_by_email;
-- ALTER TABLE public.event_registrations DROP COLUMN IF EXISTS reviewed_by_user_id;

ALTER TABLE public.event_registrations
ADD COLUMN IF NOT EXISTS reviewed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS reviewed_by_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS reviewed_by_actor VARCHAR(20) NOT NULL DEFAULT 'system';

UPDATE public.event_registrations
SET
    reviewed_by_email = COALESCE(reviewed_by_email, reviewed_by),
    reviewed_by_actor = CASE
        WHEN reviewed_by_user_id IS NOT NULL OR reviewed_by IS NOT NULL THEN 'user'
        ELSE 'system'
    END
WHERE reviewed_at IS NOT NULL;

ALTER TABLE public.event_registrations
DROP CONSTRAINT IF EXISTS event_registrations_reviewed_by_actor_check;

ALTER TABLE public.event_registrations
ADD CONSTRAINT event_registrations_reviewed_by_actor_check
CHECK (reviewed_by_actor IN ('system', 'user'));

ALTER TABLE public.event_registrations
DROP CONSTRAINT IF EXISTS event_registrations_review_actor_check;

ALTER TABLE public.event_registrations
ADD CONSTRAINT event_registrations_review_actor_check
CHECK (
    reviewed_at IS NULL
    OR reviewed_by_actor = 'system'
    OR reviewed_by_user_id IS NOT NULL
    OR reviewed_by_email IS NOT NULL
    OR reviewed_by IS NOT NULL
);

CREATE OR REPLACE FUNCTION public.enforce_registration_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.status = NEW.status THEN
        -- Allow idempotent updates (e.g., updating review metadata or email outbox fields).
        RETURN NEW;
    END IF;

    IF OLD.status = 'pending_review' AND (NEW.status = 'approved' OR NEW.status = 'rejected') THEN
        IF NEW.reviewed_at IS NULL THEN
            RAISE EXCEPTION 'registration_decision_missing_reviewed_at';
        END IF;

        IF NEW.reviewed_by_actor NOT IN ('system', 'user') THEN
            RAISE EXCEPTION 'registration_decision_invalid_actor';
        END IF;

        IF NEW.reviewed_by_actor = 'user'
            AND NEW.reviewed_by_user_id IS NULL
            AND NEW.reviewed_by_email IS NULL
            AND NEW.reviewed_by IS NULL THEN
            RAISE EXCEPTION 'registration_decision_missing_reviewer';
        END IF;

        IF NEW.status = 'rejected'
            AND (
                NEW.reviewed_by_actor <> 'user'
                OR (
                    NEW.reviewed_by_user_id IS NULL
                    AND NEW.reviewed_by_email IS NULL
                    AND NEW.reviewed_by IS NULL
                )
            ) THEN
            RAISE EXCEPTION 'registration_rejection_requires_reviewer';
        END IF;

        RETURN NEW;
    END IF;

    RAISE EXCEPTION 'invalid_status_transition';
END;
$$;

DROP FUNCTION IF EXISTS public.approve_event_registration(UUID, UUID, VARCHAR);

CREATE OR REPLACE FUNCTION public.approve_event_registration(
    p_church_id UUID,
    p_registration_id UUID,
    p_reviewed_by VARCHAR DEFAULT NULL,
    p_reviewed_by_user_id UUID DEFAULT NULL
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
    v_reviewed_by_actor VARCHAR(20);
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

    v_reviewed_by_actor := CASE
        WHEN p_reviewed_by_user_id IS NULL AND p_reviewed_by IS NULL THEN 'system'
        ELSE 'user'
    END;

    -- 5. Update the registration
    UPDATE public.event_registrations
    SET
        status = 'approved',
        person_id = v_person_id,
        reviewed_by = p_reviewed_by,
        reviewed_by_user_id = p_reviewed_by_user_id,
        reviewed_by_email = p_reviewed_by,
        reviewed_by_actor = v_reviewed_by_actor,
        reviewed_at = NOW()
    WHERE id = p_registration_id;

    RETURN jsonb_build_object('success', true, 'person_id', v_person_id);
END;
$$;

REVOKE ALL ON FUNCTION public.approve_event_registration(UUID, UUID, VARCHAR, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_event_registration(UUID, UUID, VARCHAR, UUID) TO service_role;
