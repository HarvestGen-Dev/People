// <!-- AGENT: BACKEND -->
import 'server-only';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

type PublicRateLimitOptions = {
  bucket: string;
  scope: string;
  limit: number;
  windowSeconds: number;
  error: string;
};

type RateLimitRpcResult = {
  allowed: boolean;
  remaining: number;
  reset_at: string;
};

function clientIp(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0]?.trim() || 'unknown';

  return (
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    'unknown'
  );
}

function rateLimitResponse(message: string, resetAt: string) {
  const resetDate = new Date(resetAt);
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((resetDate.getTime() - Date.now()) / 1000)
  );

  return NextResponse.json(
    { error: message },
    {
      status: 429,
      headers: {
        'Retry-After': retryAfterSeconds.toString(),
        'X-RateLimit-Reset': resetAt,
      },
    }
  );
}

export async function enforcePublicRateLimit(
  request: Request,
  options: PublicRateLimitOptions
): Promise<NextResponse | null> {
  const supabase = createServiceClient();
  const subject = `${clientIp(request)}:${options.scope}`;

  const { data, error } = await supabase
    .rpc('consume_public_rate_limit', {
      p_bucket: options.bucket,
      p_subject: subject,
      p_limit: options.limit,
      p_window_seconds: options.windowSeconds,
    })
    .single();

  if (error) {
    console.error('Public rate limit error:', error);
    return null;
  }

  const result = data as RateLimitRpcResult;
  if (result.allowed) return null;

  return rateLimitResponse(options.error, result.reset_at);
}
