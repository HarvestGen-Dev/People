// <!-- AGENT: BACKEND -->
import 'server-only';

import nodemailer from 'nodemailer';
import { escapeHtml } from '@/lib/email/html';

const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.BREVO_SMTP_USER || '',
    pass: process.env.BREVO_SMTP_KEY || '',
  },
});

export async function sendChurchInvitationEmail(input: {
  email: string;
  churchName: string;
  inviteUrl: string;
  expiresAt: string;
}): Promise<{ sent: boolean; error?: string }> {
  if (!process.env.BREVO_SMTP_USER || !process.env.BREVO_SMTP_KEY) {
    return { sent: false, error: 'Brevo SMTP is not configured' };
  }

  try {
    await transporter.sendMail({
      from: '"HarvestGen People" <noreply@harvestgen.org>',
      to: input.email,
      subject: `You are invited to ${input.churchName}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#0f172a">
          <h1>Join ${escapeHtml(input.churchName)}</h1>
          <p>An administrator invited you to access HarvestGen People.</p>
          <p>
            <a href="${escapeHtml(input.inviteUrl)}"
               style="display:inline-block;padding:12px 18px;border-radius:10px;background:#047857;color:white;text-decoration:none;font-weight:700">
              Accept invitation
            </a>
          </p>
          <p style="color:#64748b;font-size:13px">
            This single-use invitation expires ${escapeHtml(
              new Date(input.expiresAt).toLocaleString('en-MY')
            )}.
          </p>
        </div>
      `,
    });
    return { sent: true };
  } catch (error: unknown) {
    return {
      sent: false,
      error: error instanceof Error ? error.message : 'Unable to send invitation',
    };
  }
}
