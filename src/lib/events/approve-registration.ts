import { createServiceClient } from '@/lib/supabase/server';
import { sendEventConfirmationEmail } from '@/lib/email/send-confirmation';
import { recordOperationalIncident, resolveOperationalIncidents } from '@/lib/observability/incidents';
import { logOperationalEvent, OPERATIONAL_EVENTS } from '@/lib/observability/logger';

export async function approveRegistration(
  registrationId: string,
  churchId: string,
  reviewedBy: string | null,
  requestId?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceClient();

  // 1. Transactional resolution and approval via RPC
  const { data: rpcResult, error: rpcError } = await supabase.rpc('approve_event_registration', {
    p_church_id: churchId,
    p_registration_id: registrationId,
    p_reviewed_by: reviewedBy
  });

  if (rpcError) {
    logOperationalEvent({
      event: OPERATIONAL_EVENTS.registrationApprovalFailed,
      severity: 'error',
      outcome: 'transaction_failed',
      churchId,
      resourceType: 'event_registration',
      resourceId: registrationId,
      requestId,
      errorCode: 'approval_transaction_failed',
      retryable: true,
    }, rpcError);
    await recordOperationalIncident({
      churchId,
      event: OPERATIONAL_EVENTS.registrationApprovalFailed,
      severity: 'error',
      resourceType: 'event_registration',
      resourceId: registrationId,
      requestId,
      errorCode: 'approval_transaction_failed',
      retryable: true,
      error: rpcError,
    });
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
    .select('*, event:events!event_registrations_church_event_fk(*)')
    .eq('id', registrationId)
    .eq('church_id', churchId)
    .single();

  if (fetchError || !registration) {
    const error = fetchError ?? new Error('registration_fetch_empty');
    logOperationalEvent({
      event: OPERATIONAL_EVENTS.registrationApprovalFailed,
      severity: 'error',
      outcome: 'post_approval_load_failed',
      churchId,
      resourceType: 'event_registration',
      resourceId: registrationId,
      requestId,
      errorCode: 'approval_followup_load_failed',
      retryable: true,
    }, error);
    await recordOperationalIncident({
      churchId,
      event: OPERATIONAL_EVENTS.registrationApprovalFailed,
      severity: 'error',
      resourceType: 'event_registration',
      resourceId: registrationId,
      requestId,
      errorCode: 'approval_followup_load_failed',
      retryable: true,
      error,
    });
    return { success: false, error: 'Failed to fetch registration for email dispatch' };
  }

  if (registration.confirmation_email_sent_at) {
    await resolveOperationalIncidents({
      churchId,
      event: OPERATIONAL_EVENTS.registrationApprovalFailed,
      resourceId: registrationId,
    });
    return { success: true };
  }

  // 2.5 Automation: Add person to target workflow if defined
  if (registration.event?.target_workflow_id && registration.person_id) {
    // Check if they are already in the workflow (to prevent duplicates if re-registered or bug)
    const { count: existingCardCount, error: existingCardError } = await supabase
      .from('workflow_cards')
      .select('*', { count: 'exact', head: true })
      .eq('church_id', churchId)
      .eq('workflow_id', registration.event.target_workflow_id)
      .eq('person_id', registration.person_id);

    if (existingCardError) {
      logOperationalEvent({
        event: OPERATIONAL_EVENTS.registrationApprovalFailed,
        severity: 'error',
        outcome: 'workflow_card_check_failed',
        churchId,
        resourceType: 'event_registration',
        resourceId: registrationId,
        requestId,
        errorCode: 'approval_workflow_check_failed',
        retryable: true,
      }, existingCardError);
      await recordOperationalIncident({
        churchId,
        event: OPERATIONAL_EVENTS.registrationApprovalFailed,
        severity: 'error',
        resourceType: 'event_registration',
        resourceId: registrationId,
        requestId,
        errorCode: 'approval_workflow_check_failed',
        retryable: true,
        error: existingCardError,
      });
      return { success: false, error: 'Failed to process registration workflow' };
    }

    if (existingCardCount === 0) {
      // Find the first step of this workflow
      const { data: firstStep, error: stepError } = await supabase
        .from('workflow_steps')
        .select('id, default_days_to_complete')
        .eq('church_id', churchId)
        .eq('workflow_id', registration.event.target_workflow_id)
        .order('position', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (stepError || !firstStep) {
        const error = stepError ?? new Error('workflow_first_step_missing');
        logOperationalEvent({
          event: OPERATIONAL_EVENTS.registrationApprovalFailed,
          severity: 'error',
          outcome: 'workflow_step_load_failed',
          churchId,
          resourceType: 'event_registration',
          resourceId: registrationId,
          requestId,
          errorCode: 'approval_workflow_step_failed',
          retryable: true,
        }, error);
        await recordOperationalIncident({
          churchId,
          event: OPERATIONAL_EVENTS.registrationApprovalFailed,
          severity: 'error',
          resourceType: 'event_registration',
          resourceId: registrationId,
          requestId,
          errorCode: 'approval_workflow_step_failed',
          retryable: true,
          error,
        });
        return { success: false, error: 'Failed to process registration workflow' };
      }
        
      let dueDate = null;
      if (firstStep.default_days_to_complete) {
        const d = new Date();
        d.setDate(d.getDate() + firstStep.default_days_to_complete);
        dueDate = d.toISOString().split('T')[0];
      }

      const { error: cardInsertError } = await supabase.from('workflow_cards').insert({
        church_id: churchId,
        workflow_id: registration.event.target_workflow_id,
        current_step_id: firstStep.id,
        person_id: registration.person_id,
        due_date: dueDate,
        notes: `Added automatically via event registration: ${registration.event.name}`,
      });
      if (cardInsertError) {
        logOperationalEvent({
          event: OPERATIONAL_EVENTS.registrationApprovalFailed,
          severity: 'error',
          outcome: 'workflow_card_insert_failed',
          churchId,
          resourceType: 'event_registration',
          resourceId: registrationId,
          requestId,
          errorCode: 'approval_workflow_insert_failed',
          retryable: true,
        }, cardInsertError);
        await recordOperationalIncident({
          churchId,
          event: OPERATIONAL_EVENTS.registrationApprovalFailed,
          severity: 'error',
          resourceType: 'event_registration',
          resourceId: registrationId,
          requestId,
          errorCode: 'approval_workflow_insert_failed',
          retryable: true,
          error: cardInsertError,
        });
        return { success: false, error: 'Failed to process registration workflow' };
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
    .eq('church_id', churchId)
    .is('confirmation_email_sent_at', null)
    .or(`confirmation_email_claimed_at.is.null,confirmation_email_claimed_at.lt.${fiveMinutesAgo}`)
    .select('id')
    .maybeSingle();

  if (claimError) {
    logOperationalEvent({
      event: OPERATIONAL_EVENTS.emailSendFailed,
      severity: 'error',
      outcome: 'claim_failed',
      churchId,
      resourceType: 'event_registration',
      resourceId: registrationId,
      requestId,
      errorCode: 'email_claim_failed',
      retryable: true,
    }, claimError);
    await recordOperationalIncident({
      churchId,
      event: OPERATIONAL_EVENTS.emailSendFailed,
      severity: 'error',
      resourceType: 'event_registration',
      resourceId: registrationId,
      requestId,
      errorCode: 'email_claim_failed',
      retryable: true,
      error: claimError,
    });
    return { success: false, error: 'Database error while claiming email outbox' };
  }

  if (!claim) {
    // Another worker claimed it, or it was already sent
    await resolveOperationalIncidents({
      churchId,
      event: OPERATIONAL_EVENTS.registrationApprovalFailed,
      resourceId: registrationId,
    });
    return { success: true };
  }

  // 4. Dispatch Email
  const emailResult = await sendEventConfirmationEmail(registration, { churchId, requestId });

  if (emailResult.success) {
    // Mark as sent
    const { error: sentError } = await supabase
      .from('event_registrations')
      .update({ confirmation_email_sent_at: new Date().toISOString() })
      .eq('id', registrationId)
      .eq('church_id', churchId);
      
    if (sentError) {
      // It was sent but not marked. It will be sent again (at-least-once).
      logOperationalEvent({
        event: OPERATIONAL_EVENTS.emailSendFailed,
        severity: 'critical',
        outcome: 'delivery_not_recorded',
        churchId,
        resourceType: 'event_registration',
        resourceId: registrationId,
        requestId,
        errorCode: 'email_delivery_not_recorded',
        retryable: true,
      }, sentError);
      await recordOperationalIncident({
        churchId,
        event: OPERATIONAL_EVENTS.emailSendFailed,
        severity: 'critical',
        resourceType: 'event_registration',
        resourceId: registrationId,
        requestId,
        errorCode: 'email_delivery_not_recorded',
        retryable: true,
        error: sentError,
      });
      return { success: false, error: 'Failed to record email sent status' };
    }
    await resolveOperationalIncidents({
      churchId,
      event: OPERATIONAL_EVENTS.emailSendFailed,
      resourceId: registrationId,
    });
  } else {
    // Release claim on failure so it can be retried immediately
    const { error: releaseError } = await supabase
      .from('event_registrations')
      .update({ confirmation_email_claimed_at: null })
      .eq('id', registrationId)
      .eq('church_id', churchId);
      
    if (releaseError) {
      logOperationalEvent({
        event: OPERATIONAL_EVENTS.emailSendFailed,
        severity: 'critical',
        outcome: 'claim_release_failed',
        churchId,
        resourceType: 'event_registration',
        resourceId: registrationId,
        requestId,
        errorCode: 'email_claim_release_failed',
        retryable: true,
      }, releaseError);
      await recordOperationalIncident({
        churchId,
        event: OPERATIONAL_EVENTS.emailSendFailed,
        severity: 'critical',
        resourceType: 'event_registration',
        resourceId: registrationId,
        requestId,
        errorCode: 'email_claim_release_failed',
        retryable: true,
        error: releaseError,
      });
      return { success: false, error: 'Failed to release email outbox claim' };
    }
    await recordOperationalIncident({
      churchId,
      event: OPERATIONAL_EVENTS.emailSendFailed,
      severity: emailResult.errorCode === 'smtp_configuration_missing' ? 'critical' : 'error',
      resourceType: 'event_registration',
      resourceId: registrationId,
      requestId,
      errorCode: emailResult.errorCode ?? 'smtp_send_failed',
      retryable: emailResult.errorCode !== 'smtp_configuration_missing',
      error: Object.assign(new Error('Confirmation email dispatch failed.'), {
        code: emailResult.errorCode ?? 'smtp_send_failed',
      }),
    });
    return { success: false, error: 'Failed to dispatch email via SMTP' };
  }

  await resolveOperationalIncidents({
    churchId,
    event: OPERATIONAL_EVENTS.registrationApprovalFailed,
    resourceId: registrationId,
  });
  return { success: true };
}
