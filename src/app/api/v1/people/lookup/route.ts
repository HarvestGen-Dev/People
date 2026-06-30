import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { lookupOrCreatePerson } from '@/lib/people/lookup-or-create';

export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request, 'people:lookup');
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { email, phone, first_name, last_name, source } = body;

    if (!email && !phone) {
      return NextResponse.json({ error: 'Must provide email or phone for lookup' }, { status: 400 });
    }

    const { person, found } = await lookupOrCreatePerson({
      church_id: auth.apiKey!.church_id,
      email,
      phone,
      first_name: first_name || 'Unknown',
      last_name: last_name || 'Unknown',
      source: source || 'api'
    });

    const supabase = createServiceClient();
    
    // Log person_events
    if (source) {
      await supabase.from('person_events').insert({
        church_id: auth.apiKey!.church_id,
        person_id: person.id,
        source: source,
        event_type: 'lookup',
        metadata: { action: found ? "matched" : "created" }
      });
    }

    // Get tags to format the response
    const { data: personTags } = await supabase
      .from('person_tags')
      .select('tag:tags(id, name, color)')
      .eq('person_id', person.id);

    const tags = (personTags || []).map(pt => pt.tag).filter(Boolean);

    const personSummary = {
      id: person.id,
      first_name: person.first_name,
      last_name: person.last_name,
      email: person.email,
      phone: person.phone,
      status: person.status,
      campus: person.campus,
      photo_url: person.photo_url,
      tags,
      created_at: person.created_at,
      updated_at: person.updated_at,
    };

    return NextResponse.json({ 
      data: { 
        found,
        person: personSummary 
      } 
    });

  } catch (err: any) {
    console.error('Error in POST /people/lookup:', err);
    return NextResponse.json({ error: err.message || 'Invalid request body' }, { status: 400 });
  }
}
