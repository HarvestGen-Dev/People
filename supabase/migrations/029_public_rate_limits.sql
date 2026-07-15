-- <!-- AGENT: ARCHITECT -->
-- Distributed fixed-window rate limits for public endpoints. Counters live in
-- Postgres so limits are shared across Vercel/serverless instances.
-- Rollback plan:
-- 1. DROP FUNCTION public.consume_public_rate_limit(TEXT, TEXT, INTEGER, INTEGER);
-- 2. DROP TABLE public.public_rate_limits;

CREATE TABLE IF NOT EXISTS public.public_rate_limits (
  bucket TEXT NOT NULL,
  subject TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  window_seconds INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (bucket, subject)
);

CREATE INDEX IF NOT EXISTS public_rate_limits_updated_idx
  ON public.public_rate_limits(updated_at);

ALTER TABLE public.public_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.consume_public_rate_limit(
  p_bucket TEXT,
  p_subject TEXT,
  p_limit INTEGER,
  p_window_seconds INTEGER
)
RETURNS TABLE (
  allowed BOOLEAN,
  remaining INTEGER,
  reset_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  current_row public.public_rate_limits%ROWTYPE;
  now_at TIMESTAMPTZ := NOW();
BEGIN
  IF p_bucket IS NULL OR btrim(p_bucket) = '' THEN
    RAISE EXCEPTION 'rate_limit_bucket_required';
  END IF;

  IF p_subject IS NULL OR btrim(p_subject) = '' THEN
    RAISE EXCEPTION 'rate_limit_subject_required';
  END IF;

  IF p_limit < 1 OR p_window_seconds < 1 THEN
    RAISE EXCEPTION 'rate_limit_invalid_config';
  END IF;

  INSERT INTO public.public_rate_limits (
    bucket,
    subject,
    window_start,
    window_seconds,
    count,
    updated_at
  )
  VALUES (
    p_bucket,
    p_subject,
    now_at,
    p_window_seconds,
    0,
    now_at
  )
  ON CONFLICT (bucket, subject) DO NOTHING;

  SELECT *
  INTO current_row
  FROM public.public_rate_limits
  WHERE bucket = p_bucket
    AND subject = p_subject
  FOR UPDATE;

  IF current_row.window_start + make_interval(secs => current_row.window_seconds) <= now_at THEN
    UPDATE public.public_rate_limits
    SET
      window_start = now_at,
      window_seconds = p_window_seconds,
      count = 1,
      updated_at = now_at
    WHERE bucket = p_bucket
      AND subject = p_subject;

    RETURN QUERY SELECT
      TRUE,
      GREATEST(p_limit - 1, 0),
      now_at + make_interval(secs => p_window_seconds);
    RETURN;
  END IF;

  IF current_row.count >= p_limit THEN
    RETURN QUERY SELECT
      FALSE,
      0,
      current_row.window_start + make_interval(secs => current_row.window_seconds);
    RETURN;
  END IF;

  UPDATE public.public_rate_limits
  SET
    count = count + 1,
    window_seconds = p_window_seconds,
    updated_at = now_at
  WHERE bucket = p_bucket
    AND subject = p_subject;

  RETURN QUERY SELECT
    TRUE,
    GREATEST(p_limit - current_row.count - 1, 0),
    current_row.window_start + make_interval(secs => current_row.window_seconds);
END;
$$;

REVOKE ALL ON TABLE public.public_rate_limits FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_public_rate_limit(TEXT, TEXT, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_public_rate_limit(TEXT, TEXT, INTEGER, INTEGER)
  TO service_role;
