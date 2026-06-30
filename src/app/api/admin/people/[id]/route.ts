import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { id } = await params;

    // Rely on RLS policies and cascading deletes for clean removal
    // Depending on schema, you may need to delete related records first if ON DELETE CASCADE is missing
    const { error } = await supabase
      .from('people')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { id } = await params;
    const body = await request.json();
    
    const { person, tags, customFields } = body;

    // 1. Update people table
    if (person && Object.keys(person).length > 0) {
      const { error: personError } = await supabase
        .from('people')
        .update(person)
        .eq('id', id);
        
      if (personError) throw personError;
    }

    // 2. Sync person_tags (Delete all, then insert new)
    if (tags !== undefined) {
      // First delete existing tags
      await supabase.from('person_tags').delete().eq('person_id', id);
      
      // Then insert new tags if any
      if (tags.length > 0) {
        const tagInserts = tags.map((tagId: string) => ({
          person_id: id,
          tag_id: tagId
        }));
        const { error: tagsError } = await supabase.from('person_tags').insert(tagInserts);
        if (tagsError) throw tagsError;
      }
    }

    // 3. Upsert person_field_values
    if (customFields && customFields.length > 0) {
      const fieldInserts = customFields.map((field: any) => ({
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
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
