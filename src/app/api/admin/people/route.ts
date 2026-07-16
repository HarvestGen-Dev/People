import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import {
  adminApiError,
  requireTenantContext,
} from '@/lib/tenant-context';
import { recordAuditLog } from '@/lib/audit-log';
import { assertTenantRecords } from '@/lib/tenant-references';
import { triggerWorkflowsForTags } from '@/lib/workflows/trigger-tags';
import { z } from 'zod';
import { readJsonObject, validationErrorResponse } from '@/lib/validation';

const nullableText = (max: number) =>
  z.string().trim().max(max).nullable().optional();

const adminPersonCreateSchema = z.object({
  person: z.object({
    first_name: z.string().trim().min(1).max(100),
    last_name: z.string().trim().min(1).max(100),
    email: z.string().trim().email().max(255).nullable().optional(),
    phone: nullableText(50),
    gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).nullable().optional(),
    birthdate: z.string().date().nullable().optional(),
    marital_status: z.enum(['single', 'married', 'divorced', 'widowed']).nullable().optional(),
    anniversary: z.string().date().nullable().optional(),
    status: z.enum(['active', 'visitor', 'inactive', 'child']).optional(),
    campus: nullableText(100),
    household_id: z.string().uuid().nullable().optional(),
    allow_self_claim: z.boolean().optional(),
  }).strict(),
  tags: z.array(z.string().uuid()).max(100).optional(),
  customFields: z.array(
    z.object({
      field_definition_id: z.string().uuid(),
      value: z.union([z.string().max(5000), z.number(), z.boolean(), z.null()]).optional(),
    }).strict()
  ).max(100).optional(),
  household_name: z.string().trim().max(200).optional(),
}).strict();

export async function POST(request: Request) {
  try {
    const { churchId: church_id, user } = await requireTenantContext({
      requireManager: true,
    });
    const supabase = await createClient();
    const body = await readJsonObject(request);
    if (body instanceof NextResponse) return body;
    const parsed = adminPersonCreateSchema.safeParse(body);
    if (!parsed.success) return validationErrorResponse(parsed.error);
    const { person, tags, customFields, household_name } = parsed.data;

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
      const fieldInserts = customFields.map((field) => ({
        church_id,
        person_id,
        field_definition_id: field.field_definition_id,
        value: field.value ? String(field.value) : null
      }));
      const { error: fieldError } = await supabase.from('person_field_values').insert(fieldInserts);
      if (fieldError) throw fieldError;
    }

    await recordAuditLog({
      churchId: church_id,
      actor: user,
      action: 'person.created',
      resourceType: 'person',
      resourceDisplayId: newPerson.display_id,
      metadata: {
        name: `${newPerson.first_name} ${newPerson.last_name}`,
        status: newPerson.status,
        tags_count: Array.isArray(tags) ? tags.length : 0,
        custom_fields_count: Array.isArray(customFields) ? customFields.length : 0,
      },
      request,
    });

    return NextResponse.json({
      data: { id: person_id, display_id: newPerson.display_id },
    });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}
