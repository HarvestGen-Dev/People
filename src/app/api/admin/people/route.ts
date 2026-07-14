import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import {
  adminApiError,
  requireTenantContext,
} from '@/lib/tenant-context';
import { assertTenantRecords } from '@/lib/tenant-references';
import { triggerWorkflowsForTags } from '@/lib/workflows/trigger-tags';

export async function POST(request: Request) {
  try {
    const { churchId: church_id } = await requireTenantContext({
      requireManager: true,
    });
    const supabase = await createClient();
    const body = await request.json();
    const { person, tags, customFields, household_name } = body;

    let household_id = person.household_id;

    await Promise.all([
      assertTenantRecords(
        'households',
        household_id ? [household_id] : [],
        church_id,
        'households'
      ),
      assertTenantRecords(
        'tags',
        Array.isArray(tags) ? tags : [],
        church_id,
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
        church_id,
        'custom fields'
      ),
    ]);

    // 1. If household_name is provided, create the household first
    if (household_name && !household_id) {
      const { data: household, error: householdError } = await supabase
        .from('households')
        .insert({ name: household_name, church_id })
        .select()
        .single();
        
      if (householdError) throw householdError;
      household_id = household.id;
    }

    // 2. Insert into people
    const personToInsert = { ...person, church_id, household_id };
    const { data: newPerson, error: personError } = await supabase
      .from('people')
      .insert(personToInsert)
      .select()
      .single();

    if (personError) throw personError;
    const person_id = newPerson.id;

    // 3. Insert tags
    if (tags && tags.length > 0) {
      const tagInserts = tags.map((tag_id: string) => ({
        person_id,
        tag_id,
        church_id
      }));
      const { error: tagsError } = await supabase.from('person_tags').insert(tagInserts);
      if (tagsError) throw tagsError;

      // Trigger workflow automations async
      triggerWorkflowsForTags(church_id, person_id, tags).catch((err) => {
        console.error('Failed to trigger tag workflows:', err);
      });
    }

    // 4. Insert custom fields
    if (customFields && customFields.length > 0) {
      const fieldInserts = customFields.map((field: {
        field_definition_id: string;
        value: unknown;
      }) => ({
        church_id,
        person_id,
        field_definition_id: field.field_definition_id,
        value: field.value ? String(field.value) : null
      }));
      const { error: fieldError } = await supabase.from('person_field_values').insert(fieldInserts);
      if (fieldError) throw fieldError;
    }

    return NextResponse.json({
      data: { id: person_id, display_id: newPerson.display_id },
    });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}
