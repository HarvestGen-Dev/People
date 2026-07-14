// <!-- AGENT: BACKEND -->
import nodemailer from 'nodemailer';
import { Event, EventRegistration } from '@/lib/types';
import { format } from 'date-fns';

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

function escapeHtml(value: string | number) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeEmailSubject(value: string) {
  return value.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function buildConfirmationEmailHtml(registration: RegistrationWithEvent) {
  const event = registration.event;
  const dateStr = format(new Date(event.start_at), 'EEEE, MMMM d, yyyy h:mm a');
  const eventName = escapeHtml(event.name);
  const firstName = escapeHtml(registration.first_name);
  const location = event.location ? escapeHtml(event.location) : null;
  const guests = escapeHtml(registration.guests);
  
  return `
    <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto; color: #333;">
      <h2 style="color: #0f766e;">Harvest Generation Church</h2>
      <h1>You're confirmed for ${eventName}!</h1>
      <p>Hi ${firstName},</p>
      <p>We've successfully processed your registration and you're all set.</p>
      
      <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0;">Event Details</h3>
        <p><strong>When:</strong> ${dateStr}</p>
        ${location ? `<p><strong>Where:</strong> ${location}</p>` : ''}
        <p><strong>Guests:</strong> ${guests}</p>
      </div>
      
      <p>See you there!</p>
      <p style="color: #64748b; font-size: 14px; margin-top: 40px;">
        If you have any questions, reply to this email or contact us.
      </p>
    </div>
  `;
}

export async function sendEventConfirmationEmail(
  registration: RegistrationWithEvent
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!process.env.BREVO_SMTP_USER || !process.env.BREVO_SMTP_KEY) {
      console.error('BREVO_SMTP_USER or BREVO_SMTP_KEY not set.');
      return { success: false, error: 'SMTP credentials missing' };
    }

    await transporter.sendMail({
      from: '"Harvest Generation Church" <noreply@harvestgen.org>',
      to: registration.email,
      subject: sanitizeEmailSubject(
        `You're confirmed for ${registration.event.name}!`
      ),
      html: buildConfirmationEmailHtml(registration),
    });
    return { success: true };
  } catch (err) {
    console.error('Failed to send confirmation email', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
