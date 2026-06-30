import nodemailer from 'nodemailer';
import { EventRegistration, EventWithStats, PersonWithRelations } from '@/lib/types';
import { format } from 'date-fns';

const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.BREVO_SMTP_USER || '',
    pass: process.env.BREVO_SMTP_KEY || '',
  },
});

function buildConfirmationEmailHtml(registration: any) {
  const event = registration.event;
  const dateStr = format(new Date(event.start_at), 'EEEE, MMMM d, yyyy h:mm a');
  
  return `
    <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto; color: #333;">
      <h2 style="color: #0f766e;">Harvest Generation Church</h2>
      <h1>You're confirmed for ${event.name}!</h1>
      <p>Hi ${registration.first_name},</p>
      <p>We've successfully processed your registration and you're all set.</p>
      
      <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0;">Event Details</h3>
        <p><strong>When:</strong> ${dateStr}</p>
        ${event.location ? `<p><strong>Where:</strong> ${event.location}</p>` : ''}
        <p><strong>Guests:</strong> ${registration.guests}</p>
      </div>
      
      <p>See you there!</p>
      <p style="color: #64748b; font-size: 14px; margin-top: 40px;">
        If you have any questions, reply to this email or contact us.
      </p>
    </div>
  `;
}

export async function sendEventConfirmationEmail(
  registration: any,
  person: any
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!process.env.BREVO_SMTP_USER || !process.env.BREVO_SMTP_KEY) {
      console.warn('BREVO_SMTP_USER or BREVO_SMTP_KEY not set. Skipping email send.');
      return { success: true };
    }

    await transporter.sendMail({
      from: '"Harvest Generation Church" <noreply@harvestgen.org>',
      to: registration.email,
      subject: `You're confirmed for ${registration.event.name}!`,
      html: buildConfirmationEmailHtml(registration),
    });
    return { success: true };
  } catch (err) {
    console.error('Failed to send confirmation email', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
