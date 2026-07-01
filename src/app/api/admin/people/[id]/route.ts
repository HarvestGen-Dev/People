import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import {
  adminApiError,
  requireTenantContext,
} from '@/lib/tenant-context';
import { assertTenantRecords } from '@/lib/tenant-references';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { churchId } = await requireTenantContext({ requireManager: true });
    const supabase = await createClient();
    
    const { id } = await params;

    // Rely on RLS policies and cascading deletes for clean removal
    // Depending on schema, you may need to delete related records first if ON DELETE CASCADE is missing
    const { error } = await supabase
      .from('people')
      .delete()
      .eq('id', id)
      .eq('church_id', churchId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { churchId } = await requireTenantContext({ requireManager: true });
    const supabase = await createClient();
    
    const { id } = await params;
    const body = await request.json();
    
    const { person, tags, customFields } = body;

    await assertTenantRecords('people', [id], churchId, 'people');
    await Promise.all([
      assertTenantRecords(
        'households',
        person?.household_id ? [person.household_id] : [],
        churchId,
        'households'
      ),
      assertTenantRecords(
        'tags',
        Array.isArray(tags) ? tags : [],
        churchId,
        'tags'
      ),
      assertTenantRecords(
        'field_definitions',
        Array.isArray(customFields)
          ? customFields.map(
              (field: { field_definition_id?: unknown }) =>
                field.field_definition_id
            )
          : [],
        churchId,
        'custom fields'
      ),
    ]);

    // 1. Update people table
    if (person && Object.keys(person).length > 0) {
      delete person.church_id;
      delete person.id;
      const { error: personError } = await supabase
        .from('people')
        .update(person)
        .eq('id', id)
        .eq('church_id', churchId);
        
      if (personError) throw personError;
    }

    // 2. Sync person_tags (Delete all, then insert new)
    if (tags !== undefined) {
      // First delete existing tags
      await supabase
        .from('person_tags')
        .delete()
        .eq('person_id', id)
        .eq('church_id', churchId);
      
      // Then insert new tags if any
      if (tags.length > 0) {
        const tagInserts = tags.map((tagId: string) => ({
          church_id: churchId,
          person_id: id,
          tag_id: tagId
        }));
        const { error: tagsError } = await supabase.from('person_tags').insert(tagInserts);
        if (tagsError) throw tagsError;
      }
    }

    // 3. Upsert person_field_values
    if (customFields && customFields.length > 0) {
      const fieldInserts = customFields.map((field: {
        field_definition_id: string;
        value: unknown;
      }) => ({
        church_id: churchId,
        person_id: id,
        field_definition_id: field.field_definition_id,
        value: field.value ? String(field.value) : null
      }));
      
      const { error: fieldError } = await supabase
        .from('person_field_values')
        .upsert(fieldInserts, { onConflict: 'person_id,field_definition_id' });
        
      if (fieldError) throw fieldError;
    }

    return NextResponse.json({ data: { id } });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}
