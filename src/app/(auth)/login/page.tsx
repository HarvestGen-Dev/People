'use client';

import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { loginWithPasswordAction } from './actions';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loginMethod, setLoginMethod] = useState<'magic_link' | 'password'>('password');

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      if (loginMethod === 'magic_link') {
        const { error: signInError } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
          }
        });

        if (signInError) {
          setError(signInError.message);
        } else {
          setSuccess(true);
        }
      } else {
        const res = await loginWithPasswordAction(email, password);

        if (res.error) {
          setError(res.error);
        } else {
          // Redirect to dashboard on successful password login using full page load
          // to ensure cookies are sent to the server properly
          window.location.href = '/dashboard';
        }
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md border-slate-200/80 bg-white shadow-[0_24px_70px_-38px_rgba(15,23,42,0.45)] rounded-3xl">
      <CardHeader className="space-y-2 px-7 pt-8 text-left sm:px-9">
        <div className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Welcome back</div>
        <CardTitle className="text-3xl font-bold tracking-[-0.035em] text-slate-950">Sign in to People</CardTitle>
        <CardDescription className="text-muted-foreground text-base">
          {loginMethod === 'magic_link' 
            ? "Enter your church email and we'll send you a magic link."
            : "Enter your church email and password to sign in."}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-7 pb-8 sm:px-9">
        {success ? (
          <div className="text-center py-6 space-y-4">
            <div className="text-emerald-600 bg-emerald-100 rounded-full h-12 w-12 flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-lg font-medium text-foreground">Check your email</p>
            <p className="text-muted-foreground">A sign-in link is on its way to {email}.</p>
            <Button variant="outline" onClick={() => setSuccess(false)} className="mt-4 rounded-xl">
              Back to sign in
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground font-medium">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m.scott@harvestgen.org"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-lg"
                />
              </div>

              {loginMethod === 'password' && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                  <Label htmlFor="password" className="text-foreground font-medium">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full rounded-lg"
                  />
                </div>
              )}
            </div>

            {error && <div className="text-sm font-medium text-destructive text-center">{error}</div>}
            
            <Button type="submit" className="w-full rounded-xl h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm transition-all" disabled={isLoading || !email || (loginMethod === 'password' && !password)}>
              {isLoading ? 'Signing in...' : loginMethod === 'magic_link' ? 'Send magic link' : 'Sign in'}
            </Button>

            <div className="text-center pt-2 space-y-3">
              <Button
                type="button"
                variant="link"
                className="text-sm text-muted-foreground hover:text-foreground p-0 h-auto"
                onClick={() => {
                  setLoginMethod(prev => prev === 'magic_link' ? 'password' : 'magic_link');
                  setError(null);
                }}
              >
                {loginMethod === 'magic_link' ? 'Sign in with password instead' : 'Sign in with magic link instead'}
              </Button>
              <div className="text-sm text-muted-foreground mt-4">
                Don&apos;t have an account?{' '}
                <Link href="/signup" className="font-semibold text-primary hover:underline">
                  Sign up
                </Link>
              </div>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
