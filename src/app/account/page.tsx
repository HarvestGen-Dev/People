// <!-- AGENT: BACKEND -->
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { resolveAuthenticatedHome } from '@/lib/platform-auth';

export default async function AccountRouterPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');
  redirect(await resolveAuthenticatedHome(user.id));
}
