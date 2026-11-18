// <!-- AGENT: BACKEND -->
import 'server-only';
import nodemailer from 'nodemailer';
import { escapeHtml } from '@/lib/email/html';
import { createServiceClient } from '@/lib/supabase/server';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.BREVO_SMTP_USER || '',
    pass: process.env.BREVO_SMTP_KEY || '',
  },
});

/**
 * Tell staff a form was submitted. Deliberately contains no personal or pastoral
 * details: only the form title and a link to the secure, sign-in-protected record.
 */
export async function notifyStaffOfSubmission(input: {
  churchId: string;
  formTitle: string;
  notifyEmail: string;
  idempotencyKey: string;
}): Promise<{ sent: boolean; error?: string }> {
  if (!process.env.BREVO_SMTP_USER || !process.env.BREVO_SMTP_KEY) {
    return { sent: false, error: 'Brevo SMTP is not configured' };
  }

  const supabase = createServiceClient();
  const { data: submission } = await supabase
    .from('connect_form_submissions')
    .select('id')
    .eq('church_id', input.churchId)
    .eq('idempotency_key', input.idempotencyKey)
    .maybeSingle();
  if (!submission) return { sent: false, error: 'Submission not found' };

  const base = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
  const link = `${base}/settings/hg-link/submissions/${submission.id}`;

  await transporter.sendMail({
    from: '"HarvestGen People" <noreply@harvestgen.org>',
    to: input.notifyEmail,
    subject: `New HG Link submission: ${input.formTitle}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#0f172a">
        <p>A new response was submitted to <strong>${escapeHtml(input.formTitle)}</strong>.</p>
        <p>Sign in to People to review it and follow up:</p>
        <p><a href="${escapeHtml(link)}">${escapeHtml(link)}</a></p>
      </div>`,
  });
  return { sent: true };
}
