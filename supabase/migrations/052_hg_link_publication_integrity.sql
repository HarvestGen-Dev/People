-- 052_hg_link_publication_integrity.sql
-- <!-- AGENT: ARCHITECT -->
-- Publish only the exact draft validated by the server; publish and restore
-- reject visible links to missing/inactive forms before changing the live page.
-- Deploy this migration with the updated publish route (third RPC argument).
-- Rollback: restore hg_link_publish(UUID, UUID) and hg_link_restore(UUID, UUID,
-- UUID) from 051, including their REVOKE/GRANT statements, then drop
-- hg_link_publish(UUID, UUID, JSONB) and deploy the previous publish route.
-- No page content or revision history is changed by migration or rollback.

DROP FUNCTION public.hg_link_publish(UUID, UUID);

CREATE FUNCTION public.hg_link_publish(
  p_church_id UUID,
  p_user_id UUID,
  p_expected_content JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  draft public.hg_link_revisions%ROWTYPE;
  next_version INTEGER;
  missing_slugs TEXT[];
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('hg_link:' || p_church_id::TEXT, 0));

  SELECT * INTO draft
  FROM public.hg_link_revisions
  WHERE church_id = p_church_id AND status = 'draft'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'no_draft');
  END IF;

  IF draft.content IS DISTINCT FROM p_expected_content THEN
    RETURN jsonb_build_object('success', false, 'code', 'draft_changed');
  END IF;

  SELECT array_agg(slug ORDER BY slug) INTO missing_slugs
  FROM (
    SELECT DISTINCT card #>> '{destination,formSlug}' AS slug
    FROM jsonb_array_elements(draft.content -> 'cards') AS card
    WHERE COALESCE(card ->> 'visible', 'true') = 'true'
      AND card #>> '{destination,type}' = 'form'
      AND NOT EXISTS (
        SELECT 1 FROM public.connect_forms AS form
        WHERE form.church_id = p_church_id
          AND form.slug = card #>> '{destination,formSlug}'
          AND form.is_active = true
      )
  ) AS missing;

  IF cardinality(missing_slugs) > 0 THEN
    RETURN jsonb_build_object('success', false, 'code', 'form_not_found', 'missing_slugs', missing_slugs);
  END IF;

  SELECT COALESCE(MAX(version), 0) + 1 INTO next_version
  FROM public.hg_link_revisions WHERE church_id = p_church_id;

  UPDATE public.hg_link_revisions
  SET status = 'archived'
  WHERE church_id = p_church_id AND status = 'published';

  UPDATE public.hg_link_revisions
  SET status = 'published', version = next_version, published_at = NOW(), created_by = p_user_id
  WHERE id = draft.id;

  RETURN jsonb_build_object('success', true, 'revision_id', draft.id, 'version', next_version);
END;
$$;

CREATE OR REPLACE FUNCTION public.hg_link_restore(
  p_church_id UUID,
  p_revision_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  source public.hg_link_revisions%ROWTYPE;
  next_version INTEGER;
  new_id UUID;
  missing_slugs TEXT[];
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('hg_link:' || p_church_id::TEXT, 0));

  SELECT * INTO source
  FROM public.hg_link_revisions
  WHERE id = p_revision_id AND church_id = p_church_id AND status IN ('published', 'archived');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'revision_not_found');
  END IF;

  SELECT array_agg(slug ORDER BY slug) INTO missing_slugs
  FROM (
    SELECT DISTINCT card #>> '{destination,formSlug}' AS slug
    FROM jsonb_array_elements(source.content -> 'cards') AS card
    WHERE COALESCE(card ->> 'visible', 'true') = 'true'
      AND card #>> '{destination,type}' = 'form'
      AND NOT EXISTS (
        SELECT 1 FROM public.connect_forms AS form
        WHERE form.church_id = p_church_id
          AND form.slug = card #>> '{destination,formSlug}'
          AND form.is_active = true
      )
  ) AS missing;

  IF cardinality(missing_slugs) > 0 THEN
    RETURN jsonb_build_object('success', false, 'code', 'form_not_found', 'missing_slugs', missing_slugs);
  END IF;

  SELECT COALESCE(MAX(version), 0) + 1 INTO next_version
  FROM public.hg_link_revisions WHERE church_id = p_church_id;

  UPDATE public.hg_link_revisions
  SET status = 'archived'
  WHERE church_id = p_church_id AND status = 'published';

  INSERT INTO public.hg_link_revisions (church_id, status, version, content, created_by, published_at)
  VALUES (p_church_id, 'published', next_version, source.content, p_user_id, NOW())
  RETURNING id INTO new_id;

  RETURN jsonb_build_object('success', true, 'revision_id', new_id, 'version', next_version, 'restored_from', source.version);
END;
$$;

REVOKE ALL ON FUNCTION public.hg_link_publish(UUID, UUID, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hg_link_restore(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hg_link_publish(UUID, UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.hg_link_restore(UUID, UUID, UUID) TO service_role;
