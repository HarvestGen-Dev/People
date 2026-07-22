'use client';

// <!-- AGENT: FRONTEND -->
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Event } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Upload, CheckCircle2, Loader2, ArrowLeft, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface RegistrationFormProps {
  event: Event;
  spotsRemaining: number | null;
}

const regSchema = z.object({
  first_name: z.string().min(1, 'Required'),
  last_name: z.string().min(1, 'Required'),
  email: z.string().email('Invalid email'),
  phone: z.string().min(1, 'Required'),
  additional_guest_count: z.number().int().min(0).max(20),
  paid_checkbox: z.boolean(),
});

type RegData = z.infer<typeof regSchema>;

export function RegistrationForm({ event, spotsRemaining }: RegistrationFormProps) {
  const isFree = event.price === 0;
  
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreviewUrl, setProofPreviewUrl] = useState<string | null>(null);
  const [referenceNumber, setReferenceNumber] = useState<string>('');

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<RegData>({
    resolver: zodResolver(regSchema),
    defaultValues: { additional_guest_count: 0, paid_checkbox: isFree },
  });

  const additionalGuestCount = watch('additional_guest_count');
  const watchPaid = watch('paid_checkbox');
  const totalAttending = 1 + additionalGuestCount;
  const amountDue = totalAttending * event.price;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size must be less than 5MB');
        return;
      }
      setProofFile(file);
      setProofPreviewUrl(URL.createObjectURL(file));
    }
  };

  const uploadProof = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('eventId', event.id);
    
    const res = await fetch(`/api/public/events/${event.id}/upload-proof`, {
      method: 'POST',
      body: formData,
    });
    
    if (!res.ok) {
      throw new Error('Failed to upload payment proof');
    }
    const { data } = await res.json();
    return data.path;
  };

  const submitRegistration = async (data: RegData) => {
    setIsSubmitting(true);
    try {
      let proofUrl = null;
      if (!isFree) {
        if (!proofFile) {
          toast.error('Please upload your payment proof');
          setIsSubmitting(false);
          return;
        }
        proofUrl = await uploadProof(proofFile);
      }

      const payload = {
        ...data,
        payment_proof_url: proofUrl,
      };

      const res = await fetch(`/api/public/events/${event.id}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const responseData = await res.json();
      
      if (!res.ok) {
        throw new Error(responseData.error || 'Failed to register');
      }

      setReferenceNumber(responseData.data.reference);
      setStep(3); // Success screen
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to register');
    } finally {
      setIsSubmitting(false);
    }
  };

  const onStep1Next = (data: RegData) => {
    if (isFree) {
      submitRegistration(data);
    } else {
      setStep(2);
    }
  };

  if (step === 3) {
    return (
      <div className="py-8 text-center animate-in zoom-in-95 duration-500">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        </div>
        <h3 className="mb-2 text-xl font-bold text-slate-950">Registration submitted</h3>
        <p className="mb-6 text-sm leading-6 text-slate-600">
          {isFree 
            ? `We've received your registration for ${event.name}. You will receive a confirmation email shortly.`
            : `We've received your registration for ${event.name}. Our team will verify your payment shortly — you'll get a confirmation email once approved.`}
        </p>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-sm text-slate-500">
          Ref: {referenceNumber}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      {!isFree && (
        <div className="mb-6 flex items-center gap-2">
          {[
            ['1', 'Details'],
            ['2', 'Payment'],
          ].map(([number, label], index) => (
            <div key={number} className="flex flex-1 items-center gap-2">
              <div className={`grid h-7 w-7 place-items-center rounded-full text-[10px] font-bold ${step >= Number(number) ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-400'}`}>
                {number}
              </div>
              <span className={`text-xs font-semibold ${step >= Number(number) ? 'text-slate-700' : 'text-slate-400'}`}>
                {label}
              </span>
              {index === 0 && <div className="ml-auto h-px flex-1 bg-slate-200" />}
            </div>
          ))}
        </div>
      )}
      <form onSubmit={handleSubmit(step === 1 ? onStep1Next : (data) => submitRegistration(data))} className="space-y-4 [&_[data-slot=input]]:h-11 [&_[data-slot=input]]:rounded-xl">
        
        {step === 1 && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="registration-first-name" className="text-sm font-medium mb-1 block">First Name</label>
                <Input
                  id="registration-first-name"
                  autoComplete="given-name"
                  aria-invalid={!!errors.first_name}
                  aria-describedby={errors.first_name ? 'registration-first-name-error' : undefined}
                  {...register('first_name')}
                  className="rounded-xl"
                />
                {errors.first_name && <p id="registration-first-name-error" role="alert" className="text-xs text-red-500 mt-1">{errors.first_name.message}</p>}
              </div>
              <div>
                <label htmlFor="registration-last-name" className="text-sm font-medium mb-1 block">Last Name</label>
                <Input
                  id="registration-last-name"
                  autoComplete="family-name"
                  aria-invalid={!!errors.last_name}
                  aria-describedby={errors.last_name ? 'registration-last-name-error' : undefined}
                  {...register('last_name')}
                  className="rounded-xl"
                />
                {errors.last_name && <p id="registration-last-name-error" role="alert" className="text-xs text-red-500 mt-1">{errors.last_name.message}</p>}
              </div>
            </div>
            
            <div>
              <label htmlFor="registration-email" className="text-sm font-medium mb-1 block">Email</label>
              <Input
                id="registration-email"
                type="email"
                autoComplete="email"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'registration-email-error' : undefined}
                {...register('email')}
                className="rounded-xl"
              />
              {errors.email && <p id="registration-email-error" role="alert" className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
            </div>
            
            <div>
              <label htmlFor="registration-phone" className="text-sm font-medium mb-1 block">Phone</label>
              <Input
                id="registration-phone"
                type="tel"
                autoComplete="tel"
                aria-invalid={!!errors.phone}
                aria-describedby={errors.phone ? 'registration-phone-error' : undefined}
                {...register('phone')}
                className="rounded-xl"
              />
              {errors.phone && <p id="registration-phone-error" role="alert" className="text-xs text-red-500 mt-1">{errors.phone.message}</p>}
            </div>

            <div>
              <label htmlFor="registration-guests" className="text-sm font-medium mb-1 block">Additional guests</label>
              <Input 
                id="registration-guests"
                type="number" 
                min="0" 
                max={spotsRemaining !== null ? Math.max(spotsRemaining - 1, 0) : 20} 
                {...register('additional_guest_count', { valueAsNumber: true })} 
                aria-invalid={!!errors.additional_guest_count}
                aria-describedby="registration-guests-help"
                className="rounded-xl" 
              />
              <p id="registration-guests-help" className="mt-1 text-xs text-slate-500">{totalAttending} total attending including you.</p>
              {errors.additional_guest_count && <p role="alert" className="text-xs text-red-500 mt-1">{errors.additional_guest_count.message}</p>}
            </div>

            {!isFree && (
              <div className="mt-5 flex items-center justify-between rounded-xl bg-slate-50 p-4 font-medium">
                <span className="text-sm text-slate-500">Total amount</span>
                <span className="text-xl font-bold text-slate-950">RM {amountDue.toFixed(2)}</span>
              </div>
            )}

            <Button type="submit" aria-busy={isSubmitting} className="mt-4 h-11 w-full rounded-xl bg-emerald-700 text-base font-bold hover:bg-emerald-800" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
              {isFree ? 'Register' : 'Continue to Payment'}
            </Button>
          </>
        )}

        {step === 2 && !isFree && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <button 
              type="button" 
              onClick={() => setStep(1)} 
              className="flex items-center text-sm text-slate-500 hover:text-slate-900 mb-2"
            >
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </button>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center">
              <p className="text-sm text-amber-800 font-medium mb-1">Please pay</p>
              <p className="text-2xl font-bold text-amber-900">RM {amountDue.toFixed(2)}</p>
            </div>

            {event.payment_qr_url ? (
              <div className="text-center">
                <img src={event.payment_qr_url} alt="Payment QR" className="mx-auto max-w-[220px] rounded-2xl border border-slate-200 shadow-sm" />
              </div>
            ) : event.payment_link ? (
              <Button type="button" variant="outline" className="w-full rounded-xl h-11" onClick={() => window.open(event.payment_link!, '_blank')}>
                Open Payment Link <ExternalLink className="h-4 w-4 ml-2" />
              </Button>
            ) : null}

            {event.payment_instructions && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                {event.payment_instructions}
              </div>
            )}

            <div className="border-t border-border pt-4">
              <label htmlFor="registration-payment-proof" className="text-sm font-medium mb-2 block">Upload Payment Proof</label>
              <div className="group relative aspect-video w-full overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 transition-colors hover:bg-slate-100">
                {proofPreviewUrl ? (
                  <>
                    <img src={proofPreviewUrl} alt="Proof" className="w-full h-full object-contain" />
                    <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                      <span className="text-white font-medium text-sm">Replace</span>
                      <input id="registration-payment-proof" type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                    </label>
                  </>
                ) : (
                  <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer text-slate-500 hover:text-slate-700">
                    <Upload className="h-8 w-8 mb-2 opacity-70" />
                    <span className="text-sm font-medium">Upload Screenshot</span>
                    <input id="registration-payment-proof" type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                  </label>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Checkbox 
                id="paid" 
                checked={watchPaid} 
                onCheckedChange={(checked: boolean) => setValue('paid_checkbox', checked)} 
              />
              <label htmlFor="paid" className="text-sm font-medium leading-none cursor-pointer">
                I confirm I have made this payment
              </label>
            </div>

            <Button
              type="submit" 
              aria-busy={isSubmitting}
              className="h-11 w-full rounded-xl bg-emerald-700 text-base font-bold hover:bg-emerald-800"
              disabled={!proofFile || !watchPaid || isSubmitting}
            >
              {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
              Submit Registration
            </Button>
          </div>
        )}

      </form>
    </div>
  );
}
