// <!-- AGENT: BACKEND -->
import 'server-only';

import { createHash } from 'node:crypto';
import { createServiceClient } from '@/lib/supabase/server';

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  reset_at: string;
};

export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const [firstIp] = forwardedFor.split(',');
    if (firstIp?.trim()) return firstIp.trim();
  }

  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}

export function publicRateLimitKey(scope: string, request: Request) {
  const ipHash = createHash('sha256')
    .update(getClientIp(request))
    .digest('hex')
    .slice(0, 32);

  return `public:${scope}:${ipHash}`;
}

export async function checkRateLimit({
  key,
  limit,
  windowSeconds,
}: {
  key: string;
  limit: number;
  windowSeconds: number;
}) {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc('check_rate_limit', {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    console.error('Rate limit check failed:', error.message);
    return {
      allowed: false,
      remaining: 0,
      reset_at: new Date(Date.now() + windowSeconds * 1000).toISOString(),
    };
  }

  return data as RateLimitResult;
}
