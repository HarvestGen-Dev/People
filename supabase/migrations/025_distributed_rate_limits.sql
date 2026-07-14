-- <!-- AGENT: ARCHITECT -->
-- Rationale: Public event endpoints are currently protected by process-local
-- memory, which resets on deploys and is not shared across app instances. This
-- table and RPC provide an atomic, Supabase-backed fixed-window limiter for
-- public routes without exposing rate-limit state to anon/authenticated users.
--
-- Rollback Notes:
-- DROP FUNCTION IF EXISTS public.check_rate_limit(TEXT, INTEGER, INTEGER);
-- DROP TABLE IF EXISTS public.rate_limits;

CREATE TABLE IF NOT EXISTS public.rate_limits (
    key TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
    window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_rate_limits_updated_at
    ON public.rate_limits(updated_at);

CREATE OR REPLACE FUNCTION public.check_rate_limit(
    p_key TEXT,
    p_limit INTEGER,
    p_window_seconds INTEGER
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_now TIMESTAMPTZ := NOW();
    v_window_start TIMESTAMPTZ;
    v_count INTEGER;
    v_allowed BOOLEAN;
    v_reset_at TIMESTAMPTZ;
BEGIN
    IF p_key IS NULL OR LENGTH(TRIM(p_key)) = 0 THEN
        RAISE EXCEPTION 'rate_limit_key_required';
    END IF;

    IF p_limit IS NULL OR p_limit < 1 OR p_limit > 10000 THEN
        RAISE EXCEPTION 'invalid_rate_limit';
    END IF;

    IF p_window_seconds IS NULL OR p_window_seconds < 1 OR p_window_seconds > 86400 THEN
        RAISE EXCEPTION 'invalid_rate_limit_window';
    END IF;

    INSERT INTO public.rate_limits AS limits (key, count, window_start, updated_at)
    VALUES (p_key, 1, v_now, v_now)
    ON CONFLICT (key) DO UPDATE
    SET
        count = CASE
            WHEN limits.window_start <= v_now - (p_window_seconds * INTERVAL '1 second') THEN 1
            ELSE limits.count + 1
        END,
        window_start = CASE
            WHEN limits.window_start <= v_now - (p_window_seconds * INTERVAL '1 second') THEN v_now
            ELSE limits.window_start
        END,
        updated_at = v_now
    RETURNING limits.count, limits.window_start
    INTO v_count, v_window_start;

    v_allowed := v_count <= p_limit;
    v_reset_at := v_window_start + (p_window_seconds * INTERVAL '1 second');

    RETURN jsonb_build_object(
        'allowed', v_allowed,
        'remaining', GREATEST(p_limit - v_count, 0),
        'reset_at', v_reset_at
    );
END;
$$;

REVOKE ALL ON TABLE public.rate_limits FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;
