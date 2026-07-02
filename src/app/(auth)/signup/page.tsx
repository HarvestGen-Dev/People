// <!-- AGENT: FRONTEND -->
import { getValidInvitation } from '@/lib/auth/invitations';
import { SignupForm } from './SignupForm';
import { SelfSignupForm } from './SelfSignupForm';

interface SignupPageProps {
  searchParams: Promise<{ invite?: string | string[] }>;
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = await searchParams;
  const invitationToken =
    typeof params.invite === 'string' ? params.invite : '';
  const invitation = await getValidInvitation(invitationToken);

  if (!invitation) return <SelfSignupForm />;

  return (
    <SignupForm
      churchName={invitation.churchName}
      email={invitation.email}
      invitationToken={invitationToken}
    />
  );
}
