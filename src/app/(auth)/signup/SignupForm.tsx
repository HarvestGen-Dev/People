'use client';

// <!-- AGENT: FRONTEND -->
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { signUpAction } from './actions';

interface SignupFormProps {
  churchName: string;
  email: string;
  invitationToken: string;
}

export function SignupForm({
  churchName,
  email,
  invitationToken,
}: SignupFormProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    try {
      const result = await signUpAction(invitationToken, password);

      if ('error' in result) {
        setError(result.error);
      } else {
        setSuccess('Account created. You can now sign in.');
        setTimeout(() => router.push('/login'), 1500);
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md border-border bg-card shadow-xl rounded-2xl">
      <CardHeader className="space-y-2 text-center">
        <CardTitle className="text-3xl font-bold tracking-tight text-foreground">
          Join {churchName}
        </CardTitle>
        <CardDescription className="text-muted-foreground text-base">
          Create your People account using this invitation.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-foreground font-medium">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              readOnly
              className="w-full rounded-lg bg-muted"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-foreground font-medium">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full rounded-lg"
            />
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="confirmPassword"
              className="text-foreground font-medium"
            >
              Confirm password
            </Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full rounded-lg"
            />
          </div>

          {error && (
            <div className="text-sm font-medium text-destructive text-center">
              {error}
            </div>
          )}
          {success && (
            <div className="text-sm font-medium text-primary text-center">
              {success}
            </div>
          )}

          <Button
            type="submit"
            className="w-full rounded-xl h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm"
            disabled={
              isLoading || password.length < 8 || !confirmPassword
            }
          >
            {isLoading ? 'Creating account...' : 'Create account'}
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link
              href="/login"
              className="font-semibold text-primary hover:underline"
            >
              Sign in
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
