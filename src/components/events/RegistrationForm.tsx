'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Event } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Upload, CheckCircle2, Loader2, ArrowLeft } from 'lucide-react';
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
  guests: z.number().min(1),
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
    defaultValues: { guests: 1, paid_checkbox: isFree },
  });

  const watchGuests = watch('guests');
  const watchPaid = watch('paid_checkbox');
  const amountDue = watchGuests * event.price;

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
    // Generate a temporary unique ID for the file before we have a registration ID
    // In production, you might create the registration first, then upload, then update.
    // For simplicity: upload to a generic path, send URL in payload.
    const formData = new FormData();
    formData.append('file', file);
    formData.append('eventId', event.id);
    
    // We will upload directly to public upload endpoint
    const res = await fetch(`/api/public/events/${event.id}/upload-proof`, {
      method: 'POST',
      body: formData,
    });
    
    if (!res.ok) {
      throw new Error('Failed to upload payment proof');
    }
    const { data } = await res.json();
    return data.url;
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
        amount_due: amountDue,
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
    } catch (error: any) {
      toast.error(error.message);
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
      <div className="text-center py-6 animate-in zoom-in-95 duration-500">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">Registration submitted!</h3>
        <p className="text-slate-600 mb-6">
          {isFree 
            ? `We've received your registration for ${event.name}. You will receive a confirmation email shortly.`
            : `We've received your registration for ${event.name}. Our team will verify your payment shortly — you'll get a confirmation email once approved.`}
        </p>
        <div className="bg-slate-50 p-3 rounded-lg border border-border text-sm font-mono text-slate-500">
          Ref: {referenceNumber}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <form onSubmit={handleSubmit(step === 1 ? onStep1Next : (data) => submitRegistration(data))} className="space-y-4">
        
        {step === 1 && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">First Name</label>
                <Input {...register('first_name')} className="rounded-xl" />
                {errors.first_name && <p className="text-xs text-red-500 mt-1">{errors.first_name.message}</p>}
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Last Name</label>
                <Input {...register('last_name')} className="rounded-xl" />
                {errors.last_name && <p className="text-xs text-red-500 mt-1">{errors.last_name.message}</p>}
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-1 block">Email</label>
              <Input type="email" {...register('email')} className="rounded-xl" />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
            </div>
            
            <div>
              <label className="text-sm font-medium mb-1 block">Phone</label>
              <Input type="tel" {...register('phone')} className="rounded-xl" />
              {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone.message}</p>}
            </div>

            {/* Always allow selecting guests, but max out at spotsRemaining if applicable */}
            <div>
              <label className="text-sm font-medium mb-1 block">Number of Guests</label>
              <Input 
                type="number" 
                min="1" 
                max={spotsRemaining !== null ? spotsRemaining : undefined} 
                {...register('guests', { valueAsNumber: true })} 
                className="rounded-xl" 
              />
              {errors.guests && <p className="text-xs text-red-500 mt-1">{errors.guests.message}</p>}
            </div>

            {!isFree && (
              <div className="py-2 flex justify-between items-center font-medium border-t border-border mt-4">
                <span>Total Amount:</span>
                <span className="text-lg">RM {amountDue.toFixed(2)}</span>
              </div>
            )}

            <Button type="submit" className="w-full rounded-xl mt-4 h-11 text-base font-semibold" disabled={isSubmitting}>
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

            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-center">
              <p className="text-sm text-amber-800 font-medium mb-1">Please pay</p>
              <p className="text-2xl font-bold text-amber-900">RM {amountDue.toFixed(2)}</p>
            </div>

            {event.payment_qr_url ? (
              <div className="text-center">
                <img src={event.payment_qr_url} alt="Payment QR" className="max-w-[200px] mx-auto rounded-lg shadow-sm border border-slate-200" />
              </div>
            ) : event.payment_link ? (
              <Button type="button" variant="outline" className="w-full rounded-xl h-11" onClick={() => window.open(event.payment_link!, '_blank')}>
                Open Payment Link <ExternalLink className="h-4 w-4 ml-2" />
              </Button>
            ) : null}

            {event.payment_instructions && (
              <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
                {event.payment_instructions}
              </div>
            )}

            <div className="border-t border-border pt-4">
              <label className="text-sm font-medium mb-2 block">Upload Payment Proof</label>
              <div className="relative group w-full aspect-video border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors overflow-hidden">
                {proofPreviewUrl ? (
                  <>
                    <img src={proofPreviewUrl} alt="Proof" className="w-full h-full object-contain" />
                    <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                      <span className="text-white font-medium text-sm">Replace</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                    </label>
                  </>
                ) : (
                  <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer text-slate-500 hover:text-slate-700">
                    <Upload className="h-8 w-8 mb-2 opacity-70" />
                    <span className="text-sm font-medium">Upload Screenshot</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
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
              className="w-full rounded-xl h-11 text-base font-semibold" 
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

// Ensure you import ExternalLink if using payment link
import { ExternalLink } from 'lucide-react';
