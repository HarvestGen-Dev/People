// <!-- AGENT: BACKEND -->
// Legacy slug-only endpoint. Resolves only when the slug is unique across churches.
import { NextResponse } from 'next/server';
import { handleConnectFormSubmit } from '@/lib/connectFormSubmit';
import { resolveLegacyConnectForm } from '@/lib/connectFormResolver';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const form = await resolveLegacyConnectForm(slug);
  if (!form) {
    return NextResponse.json({ error: 'Connect form not found or inactive' }, { status: 404 });
  }
  return handleConnectFormSubmit(request, form.churchId, form.slug);
}
