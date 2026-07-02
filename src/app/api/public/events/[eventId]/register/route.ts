// <!-- AGENT: BACKEND -->
import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { approveRegistration } from '@/lib/events/approve-registration';

// Simple in-memory rate limit Map (Reset on deploy/cold start)
// For real production, use Upstash Redis or Supabase-backed table
const rateLimitMap = new Map<string, { count: number; timestamp: number }>();

export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  try {
    const { eventId } = await params;
    
    // IP-based Rate Limiting (5 per hour)
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitKey = `${ip}-${eventId}`;
    const now = Date.now();
    const rateLimitData = rateLimitMap.get(rateLimitKey);
    
    if (rateLimitData) {
      if (now - rateLimitData.timestamp < 3600000) {
        if (rateLimitData.count >= 5) {
          return NextResponse.json({ error: 'Too many registrations. Please try again later.' }, { status: 429 });
        }
        rateLimitMap.set(rateLimitKey, { count: rateLimitData.count + 1, timestamp: rateLimitData.timestamp });
      } else {
        rateLimitMap.set(rateLimitKey, { count: 1, timestamp: now });
      }
    } else {
      rateLimitMap.set(rateLimitKey, { count: 1, timestamp: now });
    }

    const supabase = createServiceClient();
    const body = await request.json();

    const { data: event } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (!event || event.status !== 'published') {
      return NextResponse.json({ error: 'Event not found or not published' }, { status: 404 });
    }

    if (!body.first_name || !body.last_name || !body.email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (event.capacity) {
      const { count: approvedCount } = await supabase
        .from('event_registrations')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', event.id)
        .eq('status', 'approved');

      if ((approvedCount || 0) >= event.capacity) {
        return NextResponse.json({ error: 'This event is full' }, { status: 409 });
      }
    }

    if (event.price > 0) {
      const expectedProofPrefix = `${event.church_id}/${event.id}/`;
      if (
        typeof body.payment_proof_url !== 'string' ||
        !body.payment_proof_url.startsWith(expectedProofPrefix)
      ) {
        return NextResponse.json(
          { error: 'A valid payment proof is required for this event' },
          { status: 400 }
        );
      }
    }

    const isFree = event.price === 0;
    const initialStatus = isFree ? 'approved' : 'pending_review';

    const { data: registration, error: insertError } = await supabase
      .from('event_registrations')
      .insert({
        church_id: event.church_id,
        event_id: event.id,
        first_name: body.first_name,
        last_name: body.last_name,
        email: body.email,
        phone: body.phone,
        guests: body.guests || 1,
        amount_due: body.amount_due || 0,
        payment_proof_url: body.payment_proof_url || null,
        paid_checkbox: body.paid_checkbox || false,
        status: initialStatus,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    const responseStatus = initialStatus;

    if (isFree) {
      // Run auto-approve pipeline inline
      await approveRegistration(registration.id, event.church_id, null);
    }

    const reference = `REG-${registration.id.substring(0, 6).toUpperCase()}`;

    return NextResponse.json({
      data: {
        registration_id: registration.id,
        status: responseStatus,
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
// <!-- AGENT: BACKEND -->
