// <!-- AGENT: BACKEND -->
// Tenant-scoped endpoint: /api/public/connect-forms/<church-slug>/<form-slug>/submit
import { NextResponse } from 'next/server';
import { handleConnectFormSubmit } from '@/lib/connectFormSubmit';
import { resolveConnectForm } from '@/lib/connectFormResolver';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string; formSlug: string }> }
) {
  const { slug: churchSlug, formSlug } = await params;
  const form = await resolveConnectForm(churchSlug, formSlug);
  if (!form) {
    return NextResponse.json({ error: 'Connect form not found or inactive' }, { status: 404 });
  }
  return handleConnectFormSubmit(request, form.churchId, form.slug);
}
