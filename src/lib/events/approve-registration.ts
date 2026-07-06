import { createServiceClient } from '@/lib/supabase/server';
import { sendEventConfirmationEmail } from '@/lib/email/send-confirmation';

export async function approveRegistration(
  registrationId: string,
  churchId: string,
  reviewedBy: string | null
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceClient();

  // 1. Transactional resolution and approval via RPC
  const { data: rpcResult, error: rpcError } = await supabase.rpc('approve_event_registration', {
    p_church_id: churchId,
    p_registration_id: registrationId,
    p_reviewed_by: reviewedBy
  });

  if (rpcError) {
    console.error('RPC approval error:', rpcError.message);
    return { success: false, error: 'Failed to approve registration' };
  }

  // The RPC returns a JSON object with success/error
  const result = rpcResult as unknown as { success: boolean; error?: string; already_approved?: boolean };
  if (!result.success) {
    return { success: false, error: result.error || 'Approval failed' };
  }

  // 2. Fetch the registration to process emails
  const { data: registration, error: fetchError } = await supabase
    .from('event_registrations')
    .select('*, event:events(*)')
    .eq('id', registrationId)
    .single();

  if (fetchError || !registration) {
    console.error('Fetch registration error:', fetchError?.message);
    return { success: false, error: 'Failed to fetch registration for email dispatch' };
  }

  if (registration.confirmation_email_sent_at) {
    return { success: true };
  }

  // 2.5 Automation: Add person to target workflow if defined
  if (registration.event?.target_workflow_id && registration.person_id) {
    // Check if they are already in the workflow (to prevent duplicates if re-registered or bug)
    const { count: existingCardCount } = await supabase
      .from('workflow_cards')
      .select('*', { count: 'exact', head: true })
      .eq('workflow_id', registration.event.target_workflow_id)
      .eq('person_id', registration.person_id);

    if (existingCardCount === 0) {
      // Find the first step of this workflow
      const { data: steps } = await supabase
        .from('workflow_steps')
        .select('id, default_days_to_complete')
        .eq('workflow_id', registration.event.target_workflow_id)
        .order('order_index', { ascending: true })
        .limit(1);

      if (steps && steps.length > 0) {
        const firstStep = steps[0];
        
        let dueDate = null;
        if (firstStep.default_days_to_complete) {
          const d = new Date();
          d.setDate(d.getDate() + firstStep.default_days_to_complete);
          dueDate = d.toISOString().split('T')[0];
        }

        await supabase.from('workflow_cards').insert({
          church_id: churchId,
          workflow_id: registration.event.target_workflow_id,
          current_step_id: firstStep.id,
          person_id: registration.person_id,
          due_date: dueDate,
          notes: `Added automatically via event registration: ${registration.event.name}`,
        });
      }
    }
  }

  // 3. Atomic Outbox Claim for at-least-once email delivery
  // Prevent concurrent workers from sending duplicates.
  // Note: SMTP delivery is not transactional with the database. If SMTP accepts the 
  // message but the subsequent timestamp update fails/crashes, it will retry and send a duplicate.
  // This guarantees at-least-once delivery.
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  
  const { data: claim, error: claimError } = await supabase
    .from('event_registrations')
    .update({ confirmation_email_claimed_at: new Date().toISOString() })
    .eq('id', registrationId)
    .is('confirmation_email_sent_at', null)
    .or(`confirmation_email_claimed_at.is.null,confirmation_email_claimed_at.lt.${fiveMinutesAgo}`)
    .select('id')
    .maybeSingle();

  if (claimError) {
    console.error('Email claim error:', claimError.message);
    return { success: false, error: 'Database error while claiming email outbox' };
  }

  if (!claim) {
    // Another worker claimed it, or it was already sent
    return { success: true };
  }

  // 4. Dispatch Email
  const emailResult = await sendEventConfirmationEmail(registration);

  if (emailResult.success) {
    // Mark as sent
    const { error: sentError } = await supabase
      .from('event_registrations')
      .update({ confirmation_email_sent_at: new Date().toISOString() })
      .eq('id', registrationId);
      
    if (sentError) {
      // It was sent but not marked. It will be sent again (at-least-once).
      console.error('Failed to mark email as sent:', sentError.message);
      return { success: false, error: 'Failed to record email sent status' };
    }
  } else {
    // Release claim on failure so it can be retried immediately
    const { error: releaseError } = await supabase
      .from('event_registrations')
      .update({ confirmation_email_claimed_at: null })
      .eq('id', registrationId);
      
    if (releaseError) {
      console.error('Failed to release email claim:', releaseError.message);
      return { success: false, error: 'Failed to release email outbox claim' };
    }
    return { success: false, error: 'Failed to dispatch email via SMTP' };
  }

  return { success: true };
}
