// <!-- AGENT: BACKEND -->
import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { approveRegistration } from '@/lib/events/approve-registration';
import { enforcePublicRateLimit } from '@/lib/public-rate-limit';
import { createRequestPerformanceTracker } from '@/lib/performance';
import { z } from 'zod';
import { readJsonObject, validationErrorResponse } from '@/lib/validation';

const MAX_ADDITIONAL_GUESTS = 20;

const registrationSchema = z
  .object({
    first_name: z.string().trim().min(1).max(100),
    last_name: z.string().trim().min(1).max(100),
    email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()),
    phone: z.string().trim().max(50).optional().nullable(),
    additional_guest_count: z.number().int().min(0).max(MAX_ADDITIONAL_GUESTS).optional(),
    guests: z.number().int().min(0).max(MAX_ADDITIONAL_GUESTS).optional(),
    payment_proof_url: z.string().trim().min(1).max(1024).optional().nullable(),
    paid_checkbox: z.boolean().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.additional_guest_count !== undefined &&
      value.guests !== undefined &&
      value.additional_guest_count !== value.guests
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['additional_guest_count'],
        message: 'additional_guest_count and guests must match when both are provided',
      });
    }
  })
  .transform((value) => ({
    ...value,
    additional_guest_count: value.additional_guest_count ?? value.guests ?? 0,
    phone: value.phone ? value.phone : null,
    payment_proof_url: value.payment_proof_url || null,
    paid_checkbox: value.paid_checkbox ?? false,
  }));

export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  try {
    const { eventId } = await params;

    const limited = await enforcePublicRateLimit(request, {
      bucket: 'public:event-register',
      scope: eventId,
      limit: 5,
      windowSeconds: 60 * 60,
      error: 'Too many registrations. Please try again later.',
    });
    if (limited) return limited;

    const supabase = createServiceClient();
    const perf = createRequestPerformanceTracker('public-registration-submit');
    const body = await readJsonObject(request);
    if (body instanceof NextResponse) return body;
    const parsed = registrationSchema.safeParse(body);
    if (!parsed.success) return validationErrorResponse(parsed.error);
    const registration = parsed.data;

    const { data: event } = await perf.track(
      'event.lookup',
      supabase
        .from('events')
        .select('church_id, price')
        .eq('id', eventId)
        .single()
    );

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const { data: registrationId, error: rpcError } = await perf.track(
      'registration.insert_rpc',
      supabase.rpc('register_for_event', {
        p_church_id: event.church_id,
        p_event_id: eventId,
        p_first_name: registration.first_name,
        p_last_name: registration.last_name,
        p_email: registration.email,
        p_phone: registration.phone,
        p_guests: registration.additional_guest_count,
        p_payment_proof_url: registration.payment_proof_url,
        p_paid_checkbox: registration.paid_checkbox
      })
    );

    if (rpcError) {
      if (rpcError.message.includes('event_not_published')) return NextResponse.json({ error: 'Event not published' }, { status: 404 });
      if (rpcError.message.includes('event_closed')) return NextResponse.json({ error: 'Registration for this event has closed' }, { status: 400 });
      if (rpcError.message.includes('event_full')) return NextResponse.json({ error: 'This event is full' }, { status: 409 });
      if (rpcError.message.includes('invalid_guest_count')) return NextResponse.json({ error: 'Invalid guest count' }, { status: 400 });
      if (rpcError.message.includes('invalid_payment_proof')) return NextResponse.json({ error: 'A valid payment proof is required for this event' }, { status: 400 });
      if (rpcError.message.includes('payment_proof_not_found')) return NextResponse.json({ error: 'Uploaded payment proof could not be verified' }, { status: 400 });
      if (rpcError.message.includes('proof_already_used')) return NextResponse.json({ error: 'This payment proof has already been used for another registration' }, { status: 409 });
      throw rpcError;
    }

    const isFree = event.price === 0;
    const reference = `REG-${registrationId.substring(0, 6).toUpperCase()}`;

    if (isFree && registrationId) {
      const approveRes = await perf.track(
        'registration.auto_approve',
        approveRegistration(registrationId, event.church_id, null)
      );
      if (!approveRes.success) {
        perf.log();
        // If auto-approve fails due to an identity conflict, we leave it pending_review.
        return NextResponse.json({ 
          data: { 
            registration_id: registrationId, 
            status: 'pending_review',
            reference,
            message: 'Registered but requires manual review due to identity conflict.'
          } 
        });
      }
      perf.log();
      return NextResponse.json({ data: { registration_id: registrationId, status: 'approved', reference } });
    }

    perf.log();
    return NextResponse.json({
      data: {
        registration_id: registrationId,
        status: 'pending_review',
        reference,
      }
    });

  } catch (error: unknown) {
    console.error('Registration error:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: 'Unable to register for event. Please try again later.' },
      { status: 500 }
    );
  }
}
