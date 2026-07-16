// <!-- AGENT: BACKEND -->
import { NextResponse } from 'next/server';
import { z } from 'zod';

export async function readJsonObject(request: Request): Promise<Record<string, unknown> | NextResponse> {
  try {
    const value = await request.json();
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return NextResponse.json({ error: 'Request body must be a JSON object' }, { status: 400 });
    }
    return value as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 });
  }
}

export function validationErrorResponse(error: z.ZodError): NextResponse {
  const issue = error.issues[0];
  const path = issue?.path.length ? `${issue.path.join('.')}: ` : '';
  return NextResponse.json(
    { error: `${path}${issue?.message || 'Invalid request body'}` },
    { status: 400 }
  );
}
