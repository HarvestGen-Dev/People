// <!-- AGENT: FRONTEND -->
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { RegisterProfileForm } from './RegisterProfileForm';

export const metadata = {
  title: 'Register Profile | HarvestGen People',
};

export default async function RegisterProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f5f7f3] p-6">
      <RegisterProfileForm userEmail={user.email || ''} />
    </main>
  );
}
