// <!-- AGENT: FRONTEND -->
import { getValidInvitation } from '@/lib/auth/invitations';
import { SignupForm } from './SignupForm';
import { SelfSignupForm } from './SelfSignupForm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

interface SignupPageProps {
  searchParams: Promise<{ invite?: string | string[] }>;
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = await searchParams;
  const invitationToken =
    typeof params.invite === 'string' ? params.invite : '';
  const invitation = await getValidInvitation(invitationToken);

  if (invitationToken && !invitation) {
    return (
      <Card className="w-full max-w-md rounded-3xl border-slate-200/80 bg-white shadow-[0_24px_70px_-38px_rgba(15,23,42,0.45)]">
        <CardHeader className="space-y-2 px-7 pt-8 text-center sm:px-9">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <AlertCircle className="h-6 w-6 text-red-600" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-[-0.035em]">
            Invalid Invitation
          </CardTitle>
          <CardDescription className="text-base">
            This invitation link is invalid or has expired.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-7 pb-8 text-center sm:px-9">
          <p className="text-sm text-slate-500">
            Please ask your system administrator or the person who invited you to send a new invitation link.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!invitation) return <SelfSignupForm />;

  return (
    <SignupForm
      churchName={invitation.churchName}
      email={invitation.email}
      invitationToken={invitationToken}
    />
  );
}
