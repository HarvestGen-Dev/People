DO $$
  DECLARE
    target_user_id UUID;
  BEGIN
    SELECT id INTO target_user_id
    FROM auth.users
    WHERE LOWER(email) = LOWER('developer@harvestgen.org');

    IF target_user_id IS NULL THEN
      RAISE EXCEPTION 'No Supabase Auth user found for developer@harvestgen.org';
    END IF;

    INSERT INTO public.platform_admins (user_id)
    VALUES (target_user_id)
    ON CONFLICT (user_id) DO NOTHING;
  END $$;