'use client';

import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setIsSuccess(false);

    try {
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
        },
      });

      if (signInError) {
        setError(signInError.message);
      } else {
        setIsSuccess(true);
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md border-slate-800 bg-white shadow-xl">
      <CardHeader className="space-y-2 text-center">
        <CardTitle className="text-2xl font-bold tracking-tight text-slate-900">Sign in to People</CardTitle>
        <CardDescription className="text-slate-500">
          Enter your church email and we'll send you a magic link.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isSuccess ? (
          <div className="rounded-md bg-teal-50 p-4 text-sm text-teal-800 text-center">
            Check your email — a sign-in link is on its way.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="email"
                placeholder="m.scott@harvestgen.org"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full"
              />
            </div>
            {error && <div className="text-sm text-red-500 text-center">{error}</div>}
            <Button type="submit" className="w-full" disabled={isLoading || !email}>
              {isLoading ? 'Sending...' : 'Send magic link'}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
