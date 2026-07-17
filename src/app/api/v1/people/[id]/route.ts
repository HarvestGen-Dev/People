import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { adminApiError } from '@/lib/tenant-context';
import { assertTenantRecords } from '@/lib/tenant-references';
import { dispatchWebhook } from '@/lib/webhooks';
import { triggerWorkflowsForTags } from '@/lib/workflows/trigger-tags';
import {
  applyDisplayOrDatabaseIdFilter,
  displayIdFor,
  resolveScopedRecordIds,
} from '@/lib/display-ids';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await validateApiKey(request, 'people:read');
  if ('error' in auth && auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const supabase = createServiceClient();
    const churchId = auth.apiKey!.church_id;
    const { id } = await params;

    const personQuery = supabase
      .from('people')
      .select(`
        *,
        household:households!people_church_household_fk(id, name, address),
        person_tags!person_tags_church_person_fk(tag:tags!person_tags_church_tag_fk(id, display_id, name, color)),
        person_field_values!person_field_values_church_person_fk(value, field:field_definitions!person_field_values_church_field_definition_fk(slug))
      `)
      .eq('church_id', churchId);

    const { data: person, error } = await applyDisplayOrDatabaseIdFilter(personQuery, id)
      .single();

    if (error || !person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }

    const tags = (person.person_tags || [])
      .map((personTag: { tag: { id: string; display_id?: string | null } }) =>
        personTag.tag
          ? { ...personTag.tag, id: displayIdFor(personTag.tag) }
          : null
      )
      .filter(Boolean);
    const custom_fields: Record<string, string> = {};
    
    (person.person_field_values || []).forEach((fieldValue: {
      field?: { slug?: string };
      value: string;
    }) => {
      if (fieldValue.field?.slug) {
        custom_fields[fieldValue.field.slug] = fieldValue.value;
      }
    });

    return NextResponse.json({
      data: {
        id: displayIdFor(person),
        first_name: person.first_name,
        last_name: person.last_name,
        email: person.email,
        phone: person.phone,
        status: person.status,
        campus: person.campus,
        gender: person.gender,
        birthdate: person.birthdate,
        photo_url: null,
        household: person.household,
        tags,
        custom_fields,
        created_at: person.created_at,
        updated_at: person.updated_at,
      }
    });

  } catch (error: unknown) {
    return adminApiError(error);
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

    const existingQuery = supabase
      .from('people')
      .select('id, display_id')
      .eq('church_id', churchId);

    const { data: existing } = await applyDisplayOrDatabaseIdFilter(existingQuery, id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }

    const personId = existing.id;

    if (body.email) {
      const { data: existingEmail } = await supabase
        .from('people')
        .select('id, display_id')
        .eq('church_id', churchId)
        .eq('email', body.email)
        .neq('id', personId)
        .single();
      
      if (existingEmail) {
        return NextResponse.json({
          error: 'A person with this email already exists',
          data: { existing_id: displayIdFor(existingEmail) }
        }, { status: 409 });
      }
    }

    const updates: Record<string, unknown> = {};
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
        .eq('id', personId)
        .eq('church_id', churchId);

      if (updateError) throw updateError;
    }

    if (body.tag_ids && Array.isArray(body.tag_ids)) {
      const tagIds = await resolveScopedRecordIds(supabase, 'tags', body.tag_ids, churchId);
      await assertTenantRecords('tags', tagIds, churchId, 'tags');
      await supabase
        .from('person_tags')
        .delete()
        .eq('person_id', personId)
        .eq('church_id', churchId);
      if (tagIds.length > 0) {
        const tagInserts = tagIds.map((tagId: string) => ({
          church_id: churchId,
          person_id: personId,
          tag_id: tagId,
        }));
        await supabase.from('person_tags').insert(tagInserts);

        // Trigger workflow automations async
        triggerWorkflowsForTags(churchId, personId, tagIds).catch((err) => {
          console.error('Failed to trigger tag workflows:', err);
        });
      }
    }

    // Log the update event
    await supabase.from('person_events').insert({
      church_id: churchId,
      person_id: personId,
      source: 'people',
      event_type: 'api_update',
      metadata: { fields_updated: Object.keys(body) }
    });

    // Await webhook to prevent termination
    await dispatchWebhook(churchId, 'person.updated', { id: displayIdFor(existing), updates: body });

    return NextResponse.json({ data: { id: displayIdFor(existing), updated: true } });

  } catch (error: unknown) {
    return adminApiError(error);
  }
}
