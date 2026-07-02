'use client';

// <!-- AGENT: FRONTEND -->
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<
    'male' | 'female' | 'other' | 'prefer_not_to_say' | ''
  >('');
  const [birthdate, setBirthdate] = useState('');
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
      const result = await signUpAction(invitationToken, password, {
        firstName,
        lastName,
        phone,
        gender: gender || undefined,
        birthdate,
      });

      if ('error' in result) {
        setError(result.error);
      } else if (result.redirectTo) {
        window.location.href = result.redirectTo;
      } else {
        setSuccess('Check your email to verify the account and accept the invitation.');
        setTimeout(() => router.push('/login'), 2500);
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-xl rounded-3xl border-slate-200/80 bg-white shadow-[0_24px_70px_-38px_rgba(15,23,42,0.45)]">
      <CardHeader className="space-y-2 px-7 pt-8 text-left sm:px-9">
        <div className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
          You&apos;re invited
        </div>
        <CardTitle className="text-3xl font-bold tracking-[-0.035em] text-slate-950">
          Join {churchName}
        </CardTitle>
        <CardDescription className="text-muted-foreground text-base">
          Create your account and tell us a little about yourself.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-7 pb-8 sm:px-9">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName" className="text-foreground font-medium">
                First name
              </Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                required
                maxLength={100}
                autoComplete="given-name"
                className="h-11 w-full rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName" className="text-foreground font-medium">
                Last name
              </Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                required
                maxLength={100}
                autoComplete="family-name"
                className="h-11 w-full rounded-xl"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email" className="text-foreground font-medium">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              readOnly
              className="h-11 w-full rounded-xl bg-slate-50"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-foreground font-medium">
                Phone <span className="font-normal text-slate-400">(optional)</span>
              </Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                maxLength={50}
                autoComplete="tel"
                className="h-11 w-full rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="birthdate" className="text-foreground font-medium">
                Birthdate <span className="font-normal text-slate-400">(optional)</span>
              </Label>
              <Input
                id="birthdate"
                type="date"
                value={birthdate}
                onChange={(event) => setBirthdate(event.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                autoComplete="bday"
                className="h-11 w-full rounded-xl"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="gender" className="text-foreground font-medium">
              Gender <span className="font-normal text-slate-400">(optional)</span>
            </Label>
            <Select
              value={gender}
              onValueChange={(value) =>
                setGender(
                  value as
                    | 'male'
                    | 'female'
                    | 'other'
                    | 'prefer_not_to_say'
                )
              }
            >
              <SelectTrigger id="gender" className="h-11 w-full rounded-xl">
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
                <SelectItem value="prefer_not_to_say">
                  Prefer not to say
                </SelectItem>
              </SelectContent>
            </Select>
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
              className="h-11 w-full rounded-xl"
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
              className="h-11 w-full rounded-xl"
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
            className="h-11 w-full rounded-xl bg-emerald-700 font-bold text-white shadow-sm hover:bg-emerald-800"
            disabled={
              isLoading ||
              !firstName.trim() ||
              !lastName.trim() ||
              password.length < 8 ||
              !confirmPassword
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
