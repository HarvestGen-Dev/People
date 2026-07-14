// <!-- AGENT: BACKEND -->
import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { approveRegistration } from '@/lib/events/approve-registration';
import {
  checkRateLimit,
  rateLimitExceededResponse,
} from '@/lib/rate-limit';

export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  try {
    const { eventId } = await params;

    const rateLimit = await checkRateLimit({
      request,
      scope: 'public-event-register',
      identifier: eventId,
      limit: 5,
      windowSeconds: 60 * 60,
    });

    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(rateLimit);
    }

    const supabase = createServiceClient();
    const body = await request.json();

    const { data: event } = await supabase
      .from('events')
      .select('church_id, price')
      .eq('id', eventId)
      .single();

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (
      !body.first_name || typeof body.first_name !== 'string' ||
      !body.last_name || typeof body.last_name !== 'string' ||
      !body.email || typeof body.email !== 'string'
    ) {
      return NextResponse.json({ error: 'Missing or invalid required fields' }, { status: 400 });
    }

    const firstName = body.first_name.trim();
    const lastName = body.last_name.trim();
    const email = body.email.trim();
    const phone = typeof body.phone === 'string' ? body.phone.trim() : null;

    if (!firstName || !lastName || !email) {
      return NextResponse.json({ error: 'Missing or invalid required fields after trimming' }, { status: 400 });
    }

    if (body.payment_proof_url !== undefined && body.payment_proof_url !== null && typeof body.payment_proof_url !== 'string') {
      return NextResponse.json({ error: 'Invalid payment proof format' }, { status: 400 });
    }

    if (firstName.length > 100 || lastName.length > 100 || email.length > 255 || (phone && phone.length > 50)) {
      return NextResponse.json({ error: 'Field length exceeds maximum limit' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    const guests = typeof body.guests === 'number' ? body.guests : 1;
    if (!Number.isInteger(guests) || guests < 1 || guests > 100) {
      return NextResponse.json({ error: 'Invalid guest count' }, { status: 400 });
    }

    const { data: registrationId, error: rpcError } = await supabase
      .rpc('register_for_event', {
        p_church_id: event.church_id,
        p_event_id: eventId,
        p_first_name: firstName,
        p_last_name: lastName,
        p_email: email,
        p_phone: phone,
        p_guests: guests,
        p_payment_proof_url: body.payment_proof_url || null,
        p_paid_checkbox: Boolean(body.paid_checkbox)
      });

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
      const approveRes = await approveRegistration(registrationId, event.church_id, null);
      if (!approveRes.success) {
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
      return NextResponse.json({ data: { registration_id: registrationId, status: 'approved', reference } });
    }

    return NextResponse.json({
      data: {
        registration_id: registrationId,
        status: 'pending_review',
        reference,
      }
    });

  } catch (error: unknown) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Unable to register for event',
      },
      { status: 500 }
    );
  }
}
