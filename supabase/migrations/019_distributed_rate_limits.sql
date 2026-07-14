-- <!-- AGENT: ARCHITECT -->
-- Rationale: Public endpoints need rate limiting that works across serverless
-- instances and deployment restarts. A process-local Map is not sufficient.
-- Store only hashed keys so request IPs are not persisted in plaintext.
--
-- <!-- AGENT: DEVOPS -->
-- Rollback Notes:
-- DROP FUNCTION IF EXISTS public.check_rate_limit(TEXT, INTEGER, INTEGER);
-- DROP TABLE IF EXISTS public.rate_limits;

CREATE TABLE IF NOT EXISTS public.rate_limits (
    key_hash TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
    window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_rate_limits_expires_at
ON public.rate_limits(expires_at);

REVOKE ALL ON public.rate_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.check_rate_limit(
    p_key_hash TEXT,
    p_limit INTEGER,
    p_window_seconds INTEGER
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_now TIMESTAMPTZ := NOW();
    v_count INTEGER;
    v_expires_at TIMESTAMPTZ;
BEGIN
    IF p_key_hash IS NULL OR LENGTH(p_key_hash) < 32 THEN
        RAISE EXCEPTION 'invalid_rate_limit_key';
    END IF;

    IF p_limit IS NULL OR p_limit < 1 OR p_limit > 10000 THEN
        RAISE EXCEPTION 'invalid_rate_limit_limit';
    END IF;

    IF p_window_seconds IS NULL OR p_window_seconds < 1 OR p_window_seconds > 86400 THEN
        RAISE EXCEPTION 'invalid_rate_limit_window';
    END IF;

    DELETE FROM public.rate_limits
    WHERE expires_at < v_now - INTERVAL '1 hour';

    INSERT INTO public.rate_limits (
        key_hash,
        count,
        window_start,
        expires_at
    ) VALUES (
        p_key_hash,
        1,
        v_now,
        v_now + MAKE_INTERVAL(secs => p_window_seconds)
    )
    ON CONFLICT (key_hash) DO UPDATE
    SET
        count = CASE
            WHEN public.rate_limits.expires_at <= v_now THEN 1
            ELSE public.rate_limits.count + 1
        END,
        window_start = CASE
            WHEN public.rate_limits.expires_at <= v_now THEN v_now
            ELSE public.rate_limits.window_start
        END,
        expires_at = CASE
            WHEN public.rate_limits.expires_at <= v_now THEN v_now + MAKE_INTERVAL(secs => p_window_seconds)
            ELSE public.rate_limits.expires_at
        END
    RETURNING count, expires_at INTO v_count, v_expires_at;

    RETURN jsonb_build_object(
        'allowed', v_count <= p_limit,
        'limit', p_limit,
        'remaining', GREATEST(p_limit - v_count, 0),
        'reset_at', v_expires_at,
        'retry_after_seconds', GREATEST(CEIL(EXTRACT(EPOCH FROM (v_expires_at - v_now)))::INTEGER, 0)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;
