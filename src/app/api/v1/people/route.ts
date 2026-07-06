import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { adminApiError } from '@/lib/tenant-context';
import { assertTenantRecords } from '@/lib/tenant-references';
import { dispatchWebhook } from '@/lib/webhooks';

export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request, 'people:read');
  if ('error' in auth && auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const supabase = createServiceClient();
    const churchId = auth.apiKey!.church_id;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const status = searchParams.get('status');
    const tag_id = searchParams.get('tag_id');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const per_page = Math.min(parseInt(searchParams.get('per_page') || '20', 10), 100);

    const from = (page - 1) * per_page;
    const to = from + per_page - 1;

    let query = supabase
      .from('people')
      .select('*, person_tags(tag:tags(id, name, color))', { count: 'exact' })
      .eq('church_id', churchId)
      .order('last_name')
      .order('first_name');

    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (tag_id) {
      // Need a join on person_tags if we filter by tag_id. 
      // In Supabase REST we might have to use inner join:
      // person_tags!inner(tag_id)
      query = supabase
        .from('people')
        .select('*, person_tags!inner(tag_id, tag:tags(id, name, color))', { count: 'exact' })
        .eq('church_id', churchId)
        .eq('person_tags.tag_id', tag_id)
        .order('last_name')
        .order('first_name');
      
      if (search) {
        query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`);
      }
      if (status) {
        query = query.eq('status', status);
      }
    }

    const { data, count, error } = await query.range(from, to);

    if (error) throw error;

    const people = (data || []).map(p => ({
      id: p.id,
      first_name: p.first_name,
      last_name: p.last_name,
      email: p.email,
      phone: p.phone,
      status: p.status,
      campus: p.campus,
      photo_url: p.photo_url,
      tags: (p.person_tags || [])
        .map((personTag: { tag: unknown }) => personTag.tag)
        .filter(Boolean),
      created_at: p.created_at,
      updated_at: p.updated_at,
    }));

    return NextResponse.json({
      data: {
        people,
        meta: {
          total: count || 0,
          page,
          per_page,
          total_pages: Math.ceil((count || 0) / per_page)
        }
      }
    });

  } catch (error: unknown) {
    return adminApiError(error);
  }
}

export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request, 'people:write');
  if ('error' in auth && auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const supabase = createServiceClient();
    const churchId = auth.apiKey!.church_id;
    const body = await request.json();

    if (!body.first_name || !body.last_name) {
      return NextResponse.json({ error: 'first_name and last_name are required' }, { status: 400 });
    }

    const tagIds = Array.isArray(body.tag_ids) ? body.tag_ids : [];
    await assertTenantRecords('tags', tagIds, churchId, 'tags');

    if (body.email) {
      const { data: existing } = await supabase
        .from('people')
        .select('id')
        .eq('church_id', churchId)
        .eq('email', body.email)
        .single();
      
      if (existing) {
        return NextResponse.json({ 
          error: 'A person with this email already exists', 
          data: { existing_id: existing.id } 
        }, { status: 409 });
      }
    }

    const { data: person, error } = await supabase
      .from('people')
      .insert({
        church_id: churchId,
        first_name: body.first_name,
        last_name: body.last_name,
        email: body.email || null,
        phone: body.phone || null,
        status: body.status || 'visitor',
        campus: body.campus || 'Bandar Sunway',
        gender: body.gender || null,
        birthdate: body.birthdate || null,
      })
      .select('id')
      .single();

    if (error) throw error;

    if (tagIds.length > 0) {
      const tagInserts = tagIds.map((tagId: string) => ({
        church_id: churchId,
        person_id: person.id,
        tag_id: tagId,
      }));
      await supabase.from('person_tags').insert(tagInserts);
    }

    // Await webhook to prevent termination
    await dispatchWebhook(churchId, 'person.created', { id: person.id, first_name: body.first_name, last_name: body.last_name, email: body.email });

    return NextResponse.json({ data: { id: person.id } }, { status: 201 });

  } catch (error: unknown) {
    return adminApiError(error);
  }
}
