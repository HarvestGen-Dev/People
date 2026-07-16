// <!-- AGENT: BACKEND -->
import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { readJsonObject, validationErrorResponse } from '@/lib/validation';
import crypto from 'crypto';

const connectFormSubmissionSchema = z.object({
  first_name: z.string().trim().min(1).max(100),
  last_name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255).optional().nullable(),
  phone: z.string().trim().max(50).optional().nullable(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional().nullable(),
  birthdate: z.string().date().optional().nullable(),
  campus: z.string().trim().max(100).optional().nullable(),
  idempotency_key: z.string().trim().min(8).max(160).optional(),
}).strict();

type ConnectFormRpcResult =
  | { success: true; person_id: string; found: boolean; idempotency_key: string }
  | { success: false; code: 'form_not_found' | 'rate_limited' | 'identity_conflict'; reset_at?: string; message?: string };

function clientIp(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0]?.trim() || 'unknown';

  return (
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    'unknown'
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const supabase = createServiceClient();
    const { slug } = await params;

    const body = await readJsonObject(request);
    if (body instanceof NextResponse) return body;
    const parsed = connectFormSubmissionSchema.safeParse(body);
    if (!parsed.success) return validationErrorResponse(parsed.error);
    const submission = parsed.data;

    const idempotencyKey =
      request.headers.get('idempotency-key')?.trim() ||
      submission.idempotency_key ||
      crypto.randomUUID();
    const rateLimitSubject = `${clientIp(request)}:${slug}`;

    const { data, error } = await supabase.rpc('submit_connect_form', {
      p_slug: slug,
      p_idempotency_key: idempotencyKey,
      p_rate_limit_subject: rateLimitSubject,
      p_first_name: submission.first_name,
      p_last_name: submission.last_name,
      p_email: submission.email?.toLowerCase() ?? null,
      p_phone: submission.phone ?? null,
      p_gender: submission.gender ?? null,
      p_birthdate: submission.birthdate ?? null,
      p_campus: submission.campus ?? null,
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

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('Connect form error:', error);
    return NextResponse.json(
      { error: 'An error occurred submitting the form' },
      { status: 500 }
    );
  }
}
