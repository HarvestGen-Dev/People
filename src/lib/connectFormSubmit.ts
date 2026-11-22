// <!-- AGENT: BACKEND -->
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { after, NextResponse } from 'next/server';
import { z } from 'zod';
import { readJsonObject, validationErrorResponse } from '@/lib/validation';
import crypto from 'crypto';
import { resolveConnectFormById } from '@/lib/connectFormResolver';
import { resolveFormOptions } from '@/lib/hg-link/formOptions';
import { validateSubmission } from '@/lib/hg-link/formSchema';
import { notifyStaffOfSubmission } from '@/lib/email/send-submission-notice';

// Legacy fixed-field submissions (forms without a stored definition).
const legacySubmissionSchema = z.object({
  first_name: z.string().trim().min(1).max(100),
  last_name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255).optional().nullable(),
  phone: z.string().trim().max(50).optional().nullable(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional().nullable(),
  birthdate: z.string().date().optional().nullable(),
  campus: z.string().trim().max(100).optional().nullable(),
  idempotency_key: z.string().trim().min(8).max(160).optional(),
}).strict();

// Definition-driven submissions: { values: { <field id>: answer }, idempotency_key? }
const dynamicEnvelopeSchema = z.object({
  values: z.record(z.string().max(60), z.unknown()),
  idempotency_key: z.string().trim().min(8).max(160).optional(),
}).strict();

type Core = {
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  gender: string | null;
  birthdate: string | null;
  campus: string | null;
};

type ConnectFormRpcResult =
  | { success: true; person_id: string; found: boolean; idempotency_key: string }
  | { success: false; code: 'form_not_found' | 'rate_limited' | 'identity_conflict' | 'idempotency_conflict'; reset_at?: string; message?: string };

function clientIp(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0]?.trim() || 'unknown';

  return (
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    'unknown'
  );
}

function sha256(value: unknown) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

/** Same-origin guard for browser submissions (CSRF / cross-site automation). */
function isCrossSiteBrowserRequest(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false; // non-browser clients (curl, server-to-server) send no Origin
  try {
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

export async function handleConnectFormSubmit(
  request: Request,
  churchId: string,
  slug: string
): Promise<NextResponse> {
  try {
    if (isCrossSiteBrowserRequest(request)) {
      return NextResponse.json({ error: 'Cross-site submissions are not allowed' }, { status: 403 });
    }

    const supabase = createServiceClient();
    const form = await resolveConnectFormById(churchId, slug);
    if (!form) {
      return NextResponse.json({ error: 'Connect form not found or inactive' }, { status: 404 });
    }

    const body = await readJsonObject(request);
    if (body instanceof NextResponse) return body;

    let core: Core;
    let answers: Record<string, unknown> = {};
    let hashInput: unknown;
    let bodyKey: string | undefined;

    if (form.definition) {
      const envelope = dynamicEnvelopeSchema.safeParse(body);
      if (!envelope.success) return validationErrorResponse(envelope.error);
      const resolved = await resolveFormOptions(churchId, form.definition);
      const result = validateSubmission(form.definition, resolved, envelope.data.values);
      if (!result.ok) {
        return NextResponse.json(
          { error: 'Please correct the highlighted answers', fields: result.errors },
          { status: 400 }
        );
      }
      core = {
        first_name: result.data.core.first_name ?? '',
        last_name: result.data.core.last_name ?? '',
        email: result.data.core.email ?? null,
        phone: result.data.core.phone ?? null,
        gender: result.data.core.gender ?? null,
        birthdate: result.data.core.birthdate ?? null,
        campus: null,
      };
      answers = result.data.answers;
      hashInput = { core, answers, v: form.definitionVersion };
      bodyKey = envelope.data.idempotency_key;
    } else {
      const parsed = legacySubmissionSchema.safeParse(body);
      if (!parsed.success) return validationErrorResponse(parsed.error);
      const s = parsed.data;
      core = {
        first_name: s.first_name,
        last_name: s.last_name,
        email: s.email?.toLowerCase() ?? null,
        phone: s.phone ?? null,
        gender: s.gender ?? null,
        birthdate: s.birthdate ?? null,
        campus: s.campus ?? null,
      };
      hashInput = core;
      bodyKey = s.idempotency_key;
    }

    const idempotencyKey =
      request.headers.get('idempotency-key')?.trim() || bodyKey || crypto.randomUUID();
    // Rate-limit subject includes the church so one tenant's traffic cannot exhaust another's.
    const rateLimitSubject = `${clientIp(request)}:${churchId}:${slug}`;

    const { data, error } = await supabase.rpc('submit_connect_form', {
      p_church_id: churchId,
      p_slug: slug,
      p_idempotency_key: idempotencyKey,
      p_request_body_hash: sha256(hashInput),
      p_rate_limit_subject: rateLimitSubject,
      p_first_name: core.first_name,
      p_last_name: core.last_name,
      p_email: core.email,
      p_phone: core.phone,
      p_gender: core.gender,
      p_birthdate: core.birthdate,
      p_campus: core.campus,
      p_answers: answers,
      p_form_version: form.definition ? form.definitionVersion : null,
    });

    if (error) throw error;
    const result = data as ConnectFormRpcResult;

    if (!result.success) {
      if (result.code === 'form_not_found') {
        return NextResponse.json({ error: 'Connect form not found or inactive' }, { status: 404 });
      }
      if (result.code === 'identity_conflict') {
        return NextResponse.json(
          { error: 'This submission needs manual review before it can be matched.' },
          { status: 409 }
        );
      }
      if (result.code === 'idempotency_conflict') {
        return NextResponse.json(
          { error: 'Idempotency key was already used with a different submission.' },
          { status: 409 }
        );
      }
      if (result.code === 'rate_limited') {
        const resetAt = result.reset_at || new Date(Date.now() + 60 * 60 * 1000).toISOString();
        const retryAfterSeconds = Math.max(
          1,
          Math.ceil((new Date(resetAt).getTime() - Date.now()) / 1000)
        );
        return NextResponse.json(
          { error: 'Too many submissions. Please try again later.' },
          {
            status: 429,
            headers: {
              'Retry-After': retryAfterSeconds.toString(),
              'X-RateLimit-Reset': resetAt,
            },
          }
        );
      }
    }

    // Notification is best effort: a failure must never lose or fail the submission.
    if (result.success && form.notifyEmail) {
      const notice = {
        churchId,
        formTitle: form.title,
        notifyEmail: form.notifyEmail,
        idempotencyKey,
      };
      // after() keeps the work alive on serverless hosts once the response is sent.
      after(async () => {
        try {
          await notifyStaffOfSubmission(notice);
        } catch (notifyError: unknown) {
          console.error('HG Link notification failed:', notifyError instanceof Error ? notifyError.message : 'unknown');
        }
      });
    }

    // Public response never echoes answers; only the minimum needed by the client.
    return NextResponse.json(
      result.success
        ? { success: true, found: result.found, idempotency_key: result.idempotency_key, person_id: result.person_id }
        : result
    );
  } catch (error: unknown) {
    console.error('Connect form error:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json(
      { error: 'An error occurred submitting the form' },
      { status: 500 }
    );
  }
}
