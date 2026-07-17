-- 039_private_people_photos.sql
-- <!-- AGENT: ARCHITECT -->
-- Rationale: people photos are private CRM data. New uploads must store a
-- tenant/person-scoped object path in people.photo_path and be accessed only
-- through server-authorized short-lived signed URLs. Existing photo_url values
-- are left in place for inventory and staged migration; this migration does not
-- rewrite or delete legacy photo references.

ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS photo_path TEXT;

COMMENT ON COLUMN public.people.photo_url IS
  'Legacy photo reference. May contain public Supabase URLs, external URLs, or older path values. Do not write new people photos here.';

COMMENT ON COLUMN public.people.photo_path IS
  'Private Supabase Storage object path in the people-photos bucket, formatted as {church_id}/{person_id}/{generated_filename}. Signed URLs are generated server-side and never stored.';

ALTER TABLE public.people
  DROP CONSTRAINT IF EXISTS people_photo_path_format;

ALTER TABLE public.people
  ADD CONSTRAINT people_photo_path_format
  CHECK (
    photo_path IS NULL
    OR photo_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9._-]+$'
  ) NOT VALID;

ALTER TABLE public.people
  VALIDATE CONSTRAINT people_photo_path_format;

UPDATE storage.buckets
SET
  public = FALSE,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/webp']
WHERE id = 'people-photos';

DROP POLICY IF EXISTS "Public View Access for People Photos" ON storage.objects;
DROP POLICY IF EXISTS tenant_image_insert_managers ON storage.objects;
DROP POLICY IF EXISTS tenant_image_update_managers ON storage.objects;
DROP POLICY IF EXISTS tenant_image_delete_managers ON storage.objects;

CREATE POLICY tenant_public_image_insert_managers
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id IN ('event-covers', 'payment-qr')
    AND EXISTS (
      SELECT 1
      FROM public.church_memberships AS membership
      WHERE membership.user_id = (SELECT auth.uid())
        AND membership.role IN ('owner', 'admin')
        AND membership.church_id::TEXT = (storage.foldername(name))[1]
    )
  );

CREATE POLICY tenant_public_image_update_managers
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id IN ('event-covers', 'payment-qr')
    AND EXISTS (
      SELECT 1
      FROM public.church_memberships AS membership
      WHERE membership.user_id = (SELECT auth.uid())
        AND membership.role IN ('owner', 'admin')
        AND membership.church_id::TEXT = (storage.foldername(name))[1]
    )
  )
  WITH CHECK (
    bucket_id IN ('event-covers', 'payment-qr')
    AND EXISTS (
      SELECT 1
      FROM public.church_memberships AS membership
      WHERE membership.user_id = (SELECT auth.uid())
        AND membership.role IN ('owner', 'admin')
        AND membership.church_id::TEXT = (storage.foldername(name))[1]
    )
  );

CREATE POLICY tenant_public_image_delete_managers
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id IN ('event-covers', 'payment-qr')
    AND EXISTS (
      SELECT 1
      FROM public.church_memberships AS membership
      WHERE membership.user_id = (SELECT auth.uid())
        AND membership.role IN ('owner', 'admin')
        AND membership.church_id::TEXT = (storage.foldername(name))[1]
    )
  );

CREATE OR REPLACE VIEW public.people_photo_reference_inventory AS
SELECT
  church.id AS church_id,
  church.display_id AS church_display_id,
  church.name AS church_name,
  category,
  COUNT(*)::INTEGER AS people_count
FROM public.people AS person
JOIN public.churches AS church
  ON church.id = person.church_id
CROSS JOIN LATERAL (
  SELECT CASE
    WHEN person.photo_path IS NOT NULL THEN 'private_photo_path'
    WHEN person.photo_url IS NULL OR btrim(person.photo_url) = '' THEN 'empty'
    WHEN person.photo_url LIKE '%/storage/v1/object/public/people-photos/%' THEN 'legacy_public_people_photos_url'
    WHEN person.photo_url ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[^/]+$' THEN 'legacy_storage_path'
    WHEN person.photo_url ~ '^https?://' THEN 'external_url'
    ELSE 'malformed_or_unknown'
  END AS category
) AS classified
GROUP BY church.id, church.display_id, church.name, category;

COMMENT ON VIEW public.people_photo_reference_inventory IS
  'Operational count-only inventory for staged private-photo migration. Does not expose raw photo URLs or object paths.';

REVOKE ALL ON public.people_photo_reference_inventory FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.people_photo_reference_inventory TO service_role;

-- Rollback plan:
-- 1. Code rollback can continue reading legacy people.photo_url because this
--    migration does not remove or rewrite it.
-- 2. If emergency public access is explicitly accepted, set
--    storage.buckets.public = TRUE for people-photos and recreate the legacy
--    public SELECT policy. Do not do this unless privacy impact is accepted.
-- 3. Keep people.photo_path values; they are additive and can be ignored by old
--    code until a controlled forward fix is deployed.
