import { createServiceClient } from '@/lib/supabase/server';
import { lookupOrCreatePerson } from '@/lib/people/lookup-or-create';
import { sendEventConfirmationEmail } from '@/lib/email/send-confirmation';

export async function approveRegistration(
  registrationId: string,
  churchId: string,
  reviewedBy: string | null  // null when auto-approved (free events)
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceClient();

  const { data: registration } = await supabase
    .from('event_registrations')
    .select('*, event:events(*)')
    .eq('id', registrationId)
    .eq('church_id', churchId)
    .single();

  if (!registration) return { success: false, error: 'Registration not found' };

  // 1. Match-or-create person
  const { person } = await lookupOrCreatePerson({
    church_id: registration.church_id,
    email: registration.email,
    phone: registration.phone,
    first_name: registration.first_name,
    last_name: registration.last_name,
  });

  // 2. Update registration
  await supabase
    .from('event_registrations')
    .update({
      status: 'approved',
      person_id: person.id,
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', registrationId)
    .eq('church_id', churchId);

  // 3. Log person_events
  await supabase.from('person_events').insert({
    church_id: churchId,
    person_id: person.id,
    source: 'people', // Note: constraint check violation fix - using 'people' source
    event_type: 'event_registered',
    metadata: {
      event_id: registration.event_id,
      event_name: registration.event.name,
      amount_paid: registration.amount_due,
    },
  });

  // 4. Send confirmation email (fire and forget, but await the send result for logging)
  const emailResult = await sendEventConfirmationEmail(registration, person);
  if (emailResult.success) {
    await supabase
      .from('event_registrations')
      .update({ confirmation_email_sent_at: new Date().toISOString() })
      .eq('id', registrationId)
      .eq('church_id', churchId);
  }

  return { success: true };
}
