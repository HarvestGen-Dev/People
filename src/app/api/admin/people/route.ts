import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the current church_id from the user's slug
    const churchSlug = user.user_metadata?.church_slug || 'harvestgen';
    const { data: church } = await supabase
      .from('churches')
      .select('id')
      .eq('slug', churchSlug)
      .single();

    if (!church) {
      return NextResponse.json({ error: 'Church not found' }, { status: 404 });
    }

    const church_id = church.id;
    const body = await request.json();
    const { person, tags, customFields, household_name } = body;

    let household_id = person.household_id;

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
    }

    // 4. Insert custom fields
    if (customFields && customFields.length > 0) {
      const fieldInserts = customFields.map((field: any) => ({
        person_id,
        field_definition_id: field.field_definition_id,
        value: field.value ? String(field.value) : null
      }));
      const { error: fieldError } = await supabase.from('person_field_values').insert(fieldInserts);
      if (fieldError) throw fieldError;
    }

    return NextResponse.json({ data: { id: person_id } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
