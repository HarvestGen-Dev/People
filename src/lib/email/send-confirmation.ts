// <!-- AGENT: BACKEND -->
import nodemailer from 'nodemailer';
import { Event, EventRegistration } from '@/lib/types';
import { format } from 'date-fns';
import { escapeHtml } from '@/lib/email/html';
import { logOperationalEvent, OPERATIONAL_EVENTS } from '@/lib/observability/logger';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.BREVO_SMTP_USER || '',
    pass: process.env.BREVO_SMTP_KEY || '',
  },
});

type RegistrationWithEvent = EventRegistration & { event: Event };

function buildConfirmationEmailHtml(registration: RegistrationWithEvent) {
  const event = registration.event;
  const dateStr = format(new Date(event.start_at), 'EEEE, MMMM d, yyyy h:mm a');
  const eventName = escapeHtml(event.name);
  const firstName = escapeHtml(registration.first_name);
  const location = event.location ? escapeHtml(event.location) : null;
  
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <h2 style="color: #0f766e;">Harvest Generation Church</h2>
      <h1>You're confirmed for ${eventName}!</h1>
      <p>Hi ${firstName},</p>
      <p>We've successfully processed your registration and you're all set.</p>
      
      <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0;">Event Details</h3>
        <p><strong>When:</strong> ${dateStr}</p>
        ${location ? `<p><strong>Where:</strong> ${location}</p>` : ''}
        <p><strong>Total attending:</strong> ${registration.guests + 1}</p>
        <p><strong>Additional guests:</strong> ${registration.guests}</p>
      </div>
      
      <p>See you there!</p>
      <p style="color: #64748b; font-size: 14px; margin-top: 40px;">
        If you have any questions, reply to this email or contact us.
      </p>
    </div>
  `;
}

export async function sendEventConfirmationEmail(
  registration: RegistrationWithEvent,
  context?: { churchId: string; requestId?: string }
): Promise<{ success: boolean; errorCode?: string }> {
  try {
    if (!process.env.BREVO_SMTP_USER || !process.env.BREVO_SMTP_KEY) {
      logOperationalEvent({
        event: OPERATIONAL_EVENTS.emailSendFailed,
        severity: 'critical',
        outcome: 'configuration_missing',
        churchId: context?.churchId,
        resourceType: 'event_registration',
        resourceId: registration.id,
        requestId: context?.requestId,
        errorCode: 'smtp_configuration_missing',
        retryable: false,
      });
      return { success: false, errorCode: 'smtp_configuration_missing' };
    }

    await transporter.sendMail({
      from: '"Harvest Generation Church" <noreply@harvestgen.org>',
      to: registration.email,
      subject: `You're confirmed for ${registration.event.name}!`,
      html: buildConfirmationEmailHtml(registration),
    });
    logOperationalEvent({
      event: OPERATIONAL_EVENTS.emailSendCompleted,
      severity: 'info',
      outcome: 'delivered_to_smtp',
      churchId: context?.churchId,
      resourceType: 'event_registration',
      resourceId: registration.id,
      requestId: context?.requestId,
    });
    return { success: true };
  } catch (err) {
    logOperationalEvent({
      event: OPERATIONAL_EVENTS.emailSendFailed,
      severity: 'error',
      outcome: 'smtp_rejected',
      churchId: context?.churchId,
      resourceType: 'event_registration',
      resourceId: registration.id,
      requestId: context?.requestId,
      errorCode: 'smtp_send_failed',
      retryable: true,
    }, err);
    return { success: false, errorCode: 'smtp_send_failed' };
  }
}
