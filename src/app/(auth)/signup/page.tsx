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
      <Card className="w-full max-w-md border-border bg-card shadow-xl rounded-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold tracking-tight">
            Invitation required
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 text-center">
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
