// <!-- AGENT: BACKEND -->
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { adminApiError } from '@/lib/tenant-context';
import { requirePlatformAdmin } from '@/lib/platform-auth';

export async function GET() {
  try {
    await requirePlatformAdmin();
    const serviceClient = createServiceClient();
    const { data, error } = await serviceClient
      .from('churches')
      .select('id, name, slug, created_at, church_memberships(id, role)')
      .order('name');

    if (error) throw error;
    return NextResponse.json({ data: data || [] });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requirePlatformAdmin();
    const body = (await request.json()) as { name?: string; slug?: string };
    const name = body.name?.trim();
    const slug = body.slug?.trim().toLowerCase();

    if (!name || !slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return NextResponse.json(
        { error: 'A name and lowercase URL-safe slug are required' },
        { status: 400 }
      );
    }

    const serviceClient = createServiceClient();
    const { data: church, error } = await serviceClient
      .from('churches')
      .insert({ name, slug })
      .select('id, name, slug, created_at')
      .single();

    if (error) throw error;

    await serviceClient.from('platform_audit_log').insert({
      actor_id: user.id,
      church_id: church.id,
      action: 'church.created',
      target_type: 'church',
      target_id: church.id,
      metadata: { name, slug },
    });

    return NextResponse.json({ data: church }, { status: 201 });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}
