// <!-- AGENT: FRONTEND -->
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getValidInvitation } from '@/lib/auth/invitations';
import { SignupForm } from './SignupForm';

interface SignupPageProps {
  searchParams: Promise<{ invite?: string | string[] }>;
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = await searchParams;
  const invitationToken =
    typeof params.invite === 'string' ? params.invite : '';
  const invitation = await getValidInvitation(invitationToken);

  if (!invitation) {
    return (
      <Card className="w-full max-w-md rounded-3xl border-slate-200/80 bg-white shadow-[0_24px_70px_-38px_rgba(15,23,42,0.45)]">
        <CardHeader className="px-7 pt-8 text-center sm:px-9">
          <CardTitle className="text-3xl font-bold tracking-[-0.035em]">
            Invitation required
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 px-7 pb-8 text-center sm:px-9">
          <p className="text-muted-foreground">
            Ask your church administrator for a valid People invitation link.
          </p>
          <Link
            href="/login"
            className="text-sm font-semibold text-primary hover:underline"
          >
            Return to sign in
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <SignupForm
      churchName={invitation.churchName}
      email={invitation.email}
      invitationToken={invitationToken}
    />
  );
}
