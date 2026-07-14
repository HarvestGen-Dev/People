// <!-- AGENT: FRONTEND -->
import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { SignOutButton } from '@/components/auth/SignOutButton';

export default async function PortalPage() {
  const sessionClient = await createClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();
  if (!user) redirect('/login');

  await sessionClient.rpc('claim_person_profile');

  const serviceClient = createServiceClient();
  const { data: links } = await serviceClient
    .from('person_user_links')
    .select(`
      id,
      claimed_at,
      people(first_name, last_name, email, phone, status, campus),
      churches(name)
    `)
    .eq('user_id', user.id)
    .order('claimed_at', { ascending: true });

  if (!links?.length) redirect('/claim-pending');

  return (
    <main className="min-h-screen bg-[#f5f7f3] p-5 sm:p-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
              Member portal
            </div>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-950">
              Your profile
            </h1>
            <p className="mt-2 text-slate-500">
              This account can access only the church profile linked to your verified email.
            </p>
          </div>
          <SignOutButton className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 sm:shrink-0">
            Sign out
          </SignOutButton>
        </header>
        {links.map((link) => {
          const person = Array.isArray(link.people) ? link.people[0] : link.people;
          const church = Array.isArray(link.churches) ? link.churches[0] : link.churches;
          return (
            <section
              key={link.id}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
            >
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                {church?.name || 'Your church'}
              </div>
              <h2 className="mt-2 text-2xl font-bold text-slate-950">
                {person?.first_name} {person?.last_name}
              </h2>
              <dl className="mt-6 grid gap-5 sm:grid-cols-2">
                {[
                  ['Email', person?.email],
                  ['Phone', person?.phone],
                  ['Campus', person?.campus],
                  ['Status', person?.status],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl bg-slate-50 p-4">
                    <dt className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      {label}
                    </dt>
                    <dd className="mt-2 font-semibold capitalize text-slate-800">
                      {value || 'Not provided'}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          );
        })}
      </div>
    </main>
  );
}
