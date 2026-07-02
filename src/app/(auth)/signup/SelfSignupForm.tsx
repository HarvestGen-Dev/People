'use client';

// <!-- AGENT: FRONTEND -->
import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { selfSignUpAction } from './actions';

export function SelfSignupForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    const result = await selfSignUpAction(email, password);
    setIsLoading(false);

    if ('error' in result) {
      setError(result.error);
      return;
    }

    if (result.redirectTo) {
      window.location.href = result.redirectTo;
      return;
    }

    setMessage(
      'Check your email to verify your account. Your imported church profile will be linked after verification.'
    );
  };

  return (
    <Card className="w-full max-w-md rounded-3xl border-slate-200/80 bg-white shadow-[0_24px_70px_-38px_rgba(15,23,42,0.45)]">
      <CardHeader className="space-y-2 px-7 pt-8 sm:px-9">
        <div className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
          Profile access
        </div>
        <CardTitle className="text-3xl font-bold tracking-[-0.035em]">
          Create your account
        </CardTitle>
        <CardDescription>
          Use the same email your church has on your imported profile.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-7 pb-8 sm:px-9">
        {message ? (
          <div className="space-y-5 text-center">
            <p className="rounded-2xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">
              {message}
            </p>
            <Link href="/login" className="text-sm font-semibold text-emerald-700">
              Return to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="self-email">Email</Label>
              <Input
                id="self-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="self-password">Password</Label>
              <Input
                id="self-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="self-confirm-password">Confirm password</Label>
              <Input
                id="self-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="h-11 rounded-xl"
              />
            </div>
            {error && <p className="text-center text-sm font-medium text-destructive">{error}</p>}
            <Button
              type="submit"
              disabled={isLoading}
              className="h-11 w-full rounded-xl bg-emerald-700 font-bold hover:bg-emerald-800"
            >
              {isLoading ? 'Creating account…' : 'Create account'}
            </Button>
            <p className="text-center text-xs leading-5 text-slate-500">
              Staff and church owners should use their private invitation link.
            </p>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
