-- HG shared platform: reconcile app sign-up hooks with the shared Auth instance.
--
-- In their own projects, HG Claims and Shepherd each provisioned an app user on every
-- auth.users insert. In the shared project every People sign-up would also create a
-- Claims profile and a Shepherd user (which grants Shepherd access), so both
-- triggers are removed here. The trigger functions are kept so they can be re-wired
-- to fire on grants in core.app_access instead (HC-3, DMD-15). People owns account
-- creation from now on (KAN-34, KAN-43).

DROP TRIGGER IF EXISTS provision_profile ON auth.users;      -- claims_private.provision_profile()
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;   -- lms.handle_new_user()
