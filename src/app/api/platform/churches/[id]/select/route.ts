// <!-- AGENT: BACKEND -->
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { adminApiError } from '@/lib/tenant-context';
import { requirePlatformAdmin } from '@/lib/platform-auth';

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requirePlatformAdmin();
    const { id } = await context.params;
    const serviceClient = createServiceClient();
    const { data: church, error } = await serviceClient
      .from('churches')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!church) {
      return NextResponse.json({ error: 'Church not found' }, { status: 404 });
    }

    const cookieStore = await cookies();
    cookieStore.set('people_church_id', id, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });

    return NextResponse.json({ data: { church_id: id } });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}
