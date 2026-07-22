'use client';

// <!-- AGENT: FRONTEND -->
import { useRef, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type FormState = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  campus: string;
};

const emptyForm: FormState = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  campus: '',
};

export function PublicConnectForm({ slug, title }: { slug: string; title: string }) {
  const idempotencyKey = useRef(crypto.randomUUID());
  const [values, setValues] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (field: keyof FormState, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/public/connect-forms/${slug}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey.current,
        },
        body: JSON.stringify({
          first_name: values.first_name,
          last_name: values.last_name,
          email: values.email || null,
          phone: values.phone || null,
          campus: values.campus || null,
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(result?.error || 'Unable to submit your details. Please try again.');
      }
      setIsSubmitted(true);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : 'Unable to submit your details. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="py-10 text-center" role="status" aria-live="polite">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
        <h3 className="mt-4 text-xl font-bold text-slate-950">Thanks for connecting</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Your details were submitted to the team for {title}.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="connect-first-name" className="mb-1 block text-sm font-medium">
            First name <span aria-hidden="true">*</span>
          </label>
          <Input
            id="connect-first-name"
            required
            autoComplete="given-name"
            value={values.first_name}
            onChange={(event) => update('first_name', event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="connect-last-name" className="mb-1 block text-sm font-medium">
            Last name <span aria-hidden="true">*</span>
          </label>
          <Input
            id="connect-last-name"
            required
            autoComplete="family-name"
            value={values.last_name}
            onChange={(event) => update('last_name', event.target.value)}
          />
        </div>
      </div>
      <div>
        <label htmlFor="connect-email" className="mb-1 block text-sm font-medium">Email</label>
        <Input
          id="connect-email"
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={(event) => update('email', event.target.value)}
        />
      </div>
      <div>
        <label htmlFor="connect-phone" className="mb-1 block text-sm font-medium">Phone</label>
        <Input
          id="connect-phone"
          type="tel"
          autoComplete="tel"
          value={values.phone}
          onChange={(event) => update('phone', event.target.value)}
        />
      </div>
      <div>
        <label htmlFor="connect-campus" className="mb-1 block text-sm font-medium">Campus</label>
        <Input
          id="connect-campus"
          value={values.campus}
          onChange={(event) => update('campus', event.target.value)}
        />
      </div>
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <Button
        type="submit"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
        className="h-11 w-full rounded-xl bg-emerald-700 font-bold hover:bg-emerald-800"
      >
        {isSubmitting && <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />}
        {isSubmitting ? 'Submitting details' : 'Submit details'}
      </Button>
    </form>
  );
}
