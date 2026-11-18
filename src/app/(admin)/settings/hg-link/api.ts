// <!-- AGENT: FRONTEND -->
// Tiny client helper for the HG Link admin routes. Mutations go through Route Handlers only.
export async function sendJson<T = unknown>(method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = (await response.json().catch(() => null)) as { data?: T; error?: string } | null;
  if (!response.ok) throw new Error(result?.error || 'Something went wrong. Please try again.');
  return result?.data as T;
}
