import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import {
  adminApiError,
  requireTenantContext,
} from '@/lib/tenant-context';
import { recordAuditLog } from '@/lib/audit-log';

export async function GET() {
  try {
    const { churchId } = await requireTenantContext();
    const supabase = await createClient();

    const { data: events, error } = await supabase
      .from('events')
      .select('*')
      .eq('church_id', churchId)
      .order('start_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ data: events });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { churchId, user } = await requireTenantContext({
      requireManager: true,
    });
    const supabase = await createClient();

    const body = await request.json();
    let slug = body.slug;

    // Validate slug uniqueness
    const checkUniqueSlug = async (testSlug: string): Promise<string> => {
      const { data } = await supabase.from('events').select('id').eq('church_id', churchId).eq('slug', testSlug).maybeSingle();
      if (!data) return testSlug;
      // If taken, append '-2' or increment
      const match = testSlug.match(/-(\d+)$/);
      if (match) {
        const nextNum = parseInt(match[1]) + 1;
        return checkUniqueSlug(testSlug.replace(/-\d+$/, `-${nextNum}`));
      }
      return checkUniqueSlug(`${testSlug}-2`);
    };

    slug = await checkUniqueSlug(slug);

    const eventPayload = {
      ...body,
      church_id: churchId,
      slug,
      created_by: user.email
    };

    const { data, error } = await supabase
      .from('events')
      .insert(eventPayload)
      .select()
      .single();

    if (error) throw error;

    await recordAuditLog({
      churchId,
      actor: user,
      action: 'event.created',
      resourceType: 'event',
      resourceDisplayId: data.display_id,
      metadata: {
        name: data.name,
        status: data.status,
        slug: data.slug,
      },
      request,
    });

    return NextResponse.json({ data });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}
