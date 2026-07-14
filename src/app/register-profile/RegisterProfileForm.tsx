'use client';

// <!-- AGENT: FRONTEND -->
import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { registerProfileAction } from './actions';

export function RegisterProfileForm({ userEmail }: { userEmail: string }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    const formData = new FormData(event.currentTarget);
    try {
      const result = await registerProfileAction(formData);
      if (result?.error) {
        setError(result.error);
        setIsLoading(false);
      } else if (result?.redirectTo) {
        window.location.href = result.redirectTo;
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md rounded-3xl border-slate-200/80 bg-white shadow-[0_24px_70px_-38px_rgba(15,23,42,0.45)]">
      <CardHeader className="space-y-2 px-7 pt-8 sm:px-9">
        <div className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
          Profile creation
        </div>
        <CardTitle className="text-3xl font-bold tracking-[-0.035em]">
          Register your details
        </CardTitle>
        <CardDescription>
          Create a profile to connect with your church. You are registering with <span className="font-semibold text-slate-800">{userEmail}</span>.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-7 pb-8 sm:px-9">
        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="churchCode">Church code</Label>
            <Input
              id="churchCode"
              name="churchCode"
              type="text"
              required
              placeholder="e.g. harvestgen"
              className="h-11 rounded-xl"
            />
            <p className="text-xs text-slate-500">
              Ask your church administrator for their church code if you do not know it.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First name</Label>
              <Input
                id="firstName"
                name="firstName"
                type="text"
                required
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last name</Label>
              <Input
                id="lastName"
                name="lastName"
                type="text"
                required
                className="h-11 rounded-xl"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone number (optional)</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              placeholder="+60123456789"
              className="h-11 rounded-xl"
            />
          </div>
          
          {error && <p className="text-center text-sm font-medium text-destructive">{error}</p>}
          
          <Button
            type="submit"
            disabled={isLoading}
            className="h-11 w-full rounded-xl bg-emerald-700 font-bold hover:bg-emerald-800"
          >
            {isLoading ? 'Registering...' : 'Register Profile'}
          </Button>

          <div className="text-center">
            <Link href="/claim-pending" className="text-sm font-semibold text-emerald-700 hover:underline">
              Cancel and return
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
