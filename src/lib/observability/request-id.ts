// <!-- AGENT: BACKEND -->
import { randomUUID } from 'node:crypto';

const SAFE_REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

export function getOperationalRequestId(request: Request): string {
  const incoming = request.headers.get('x-request-id');
  return incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
}
