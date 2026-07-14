// <!-- AGENT: BACKEND -->
import 'server-only';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

type RateLimitOptions = {
  request: Request;
  scope: string;
  identifier: string;
  limit: number;
  windowSeconds: number;
};

type RateLimitRpcResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset_at: string;
  retry_after_seconds: number;
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: string;
  retryAfterSeconds: number;
  headers: HeadersInit;
};

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0]?.trim();
    if (firstIp) return firstIp;
  }

  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

async function sha256(value: string) {
  const data = new TextEncoder().encode(value);
  const buffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function checkRateLimit({
  request,
  scope,
  identifier,
  limit,
  windowSeconds,
}: RateLimitOptions): Promise<RateLimitResult> {
  const clientIp = getClientIp(request);
  const keyHash = await sha256(`${scope}:${identifier}:${clientIp}`);
  const supabase = createServiceClient();

  const { data, error } = await supabase.rpc('check_rate_limit', {
    p_key_hash: keyHash,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });

  if (error || !data) {
    throw new Error(error?.message || 'Unable to check rate limit');
  }

  const result = data as RateLimitRpcResult;
  const headers = {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': result.reset_at,
  };

  return {
    allowed: result.allowed,
    limit: result.limit,
    remaining: result.remaining,
    resetAt: result.reset_at,
    retryAfterSeconds: result.retry_after_seconds,
    headers,
  };
}

export function rateLimitExceededResponse(result: RateLimitResult) {
  return NextResponse.json(
    { error: 'Too many requests. Please try again later.' },
    {
      status: 429,
      headers: {
        ...result.headers,
        'Retry-After': String(result.retryAfterSeconds),
      },
    }
  );
}
