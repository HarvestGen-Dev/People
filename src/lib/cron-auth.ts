// <!-- AGENT: BACKEND -->
import { timingSafeEqual } from 'node:crypto';

export function isAuthorizedCronRequest(
  authorizationHeader: string | null,
  secret: string
): boolean {
  if (!authorizationHeader || !secret) return false;

  const provided = Buffer.from(authorizationHeader, 'utf8');
  const expected = Buffer.from(`Bearer ${secret}`, 'utf8');

  return provided.length === expected.length && timingSafeEqual(provided, expected);
}
