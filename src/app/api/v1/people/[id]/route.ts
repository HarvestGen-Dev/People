import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await validateApiKey(request, 'people:read');
  if ('error' in auth && auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const supabase = createServiceClient();
    const churchId = auth.apiKey!.church_id;
    const { id } = await params;

    const { data: person, error } = await supabase
      .from('people')
      .select(`
        *,
        household:households(id, name, address),
        person_tags(tag:tags(id, name, color)),
        person_field_values(value, field:field_definitions(slug))
      `)
      .eq('church_id', churchId)
      .eq('id', id)
      .single();

    if (error || !person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }

    const tags = (person.person_tags || []).map((pt: any) => pt.tag).filter(Boolean);
    const custom_fields: Record<string, string> = {};
    
    (person.person_field_values || []).forEach((pfv: any) => {
      if (pfv.field?.slug) {
        custom_fields[pfv.field.slug] = pfv.value;
      }
    });

    return NextResponse.json({
      data: {
        id: person.id,
        first_name: person.first_name,
        last_name: person.last_name,
        email: person.email,
        phone: person.phone,
        status: person.status,
        campus: person.campus,
        gender: person.gender,
        birthdate: person.birthdate,
        photo_url: person.photo_url,
        household: person.household,
        tags,
        custom_fields,
        created_at: person.created_at,
        updated_at: person.updated_at,
      }
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await validateApiKey(request, 'people:write');
  if ('error' in auth && auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const supabase = createServiceClient();
    const churchId = auth.apiKey!.church_id;
    const { id } = await params;
    const body = await request.json();

    // Verify person exists
    const { data: existing } = await supabase
      .from('people')
      .select('id')
      .eq('id', id)
      .eq('church_id', churchId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }

    if (body.email) {
      const { data: existingEmail } = await supabase
        .from('people')
        .select('id')
        .eq('church_id', churchId)
        .eq('email', body.email)
        .neq('id', id)
        .single();
      
      if (existingEmail) {
        return NextResponse.json({ 
          error: 'A person with this email already exists', 
          data: { existing_id: existingEmail.id } 
        }, { status: 409 });
      }
    }

    const updates: any = {};
    if (body.first_name !== undefined) updates.first_name = body.first_name;
    if (body.last_name !== undefined) updates.last_name = body.last_name;
    if (body.email !== undefined) updates.email = body.email;
    if (body.phone !== undefined) updates.phone = body.phone;
    if (body.status !== undefined) updates.status = body.status;
    if (body.campus !== undefined) updates.campus = body.campus;
    if (body.gender !== undefined) updates.gender = body.gender;
    if (body.birthdate !== undefined) updates.birthdate = body.birthdate;

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from('people')
        .update(updates)
        .eq('id', id)
        .eq('church_id', churchId);
      
      if (updateError) throw updateError;
    }

    if (body.tag_ids && Array.isArray(body.tag_ids)) {
      await supabase.from('person_tags').delete().eq('person_id', id);
      if (body.tag_ids.length > 0) {
        const tagInserts = body.tag_ids.map((tagId: string) => ({
          person_id: id,
          tag_id: tagId,
        }));
        await supabase.from('person_tags').insert(tagInserts);
      }
    }

    // Log the update event
    await supabase.from('person_events').insert({
      church_id: churchId,
      person_id: id,
      source: 'people',
      event_type: 'api_update',
      metadata: { fields_updated: Object.keys(body) }
    });

    // Fire webhook asynchronously
    import('@/lib/webhooks').then(m => m.dispatchWebhook(churchId, 'person.updated', { id, updates: body }));

    return NextResponse.json({ data: { id, updated: true } });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
