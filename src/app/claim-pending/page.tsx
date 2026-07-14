// <!-- AGENT: FRONTEND -->
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { resolveAuthenticatedHome } from '@/lib/platform-auth';
import { SignOutButton } from '@/components/auth/SignOutButton';

export default async function ClaimPendingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data } = await supabase.rpc('claim_person_profile');
  const result = Array.isArray(data) ? data[0] : data;
  if (result?.claim_status === 'claimed') redirect('/portal');

  const isNoMatch = result?.claim_status === 'no_match' || !result;

  const copy =
    result?.claim_status === 'approval_required'
      ? {
          title: 'Approval requested',
          body: 'Your verified email matched a profile that requires church administrator approval.',
        }
      : result?.claim_status === 'already_claimed'
        ? {
            title: 'Profile already linked',
            body: 'This church profile is already connected to another account. Contact your church administrator.',
          }
        : {
            title: 'No imported profile found',
            body: 'We could not find an imported profile associated with this email address. You can register your own account using a church code.',
          };

  const home = await resolveAuthenticatedHome(user.id);
  if (home !== '/claim-pending') redirect(home);

  return (
    <main className="grid min-h-screen place-items-center bg-[#f5f7f3] p-6">
      <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
          Account verification
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
          {copy.title}
        </h1>
        <p className="mt-4 leading-7 text-slate-600">{copy.body}</p>
        <p className="mt-3 text-sm font-semibold text-slate-900">{user.email}</p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {isNoMatch && (
            <Link
              href="/register-profile"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-700 px-6 text-sm font-bold text-white transition-colors hover:bg-emerald-800"
            >
              Register your account
            </Link>
          )}
          <SignOutButton
            className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 px-6 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Return to sign in
          </SignOutButton>
        </div>
      </section>
    </main>
  );
}
