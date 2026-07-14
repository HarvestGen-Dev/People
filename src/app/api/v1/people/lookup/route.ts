// <!-- AGENT: BACKEND -->
import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/server';
import {
  lookupOrCreatePerson,
  PersonIdentityConflictError,
} from '@/lib/people/lookup-or-create';
import { displayIdFor } from '@/lib/display-ids';

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

    if (
      source &&
      source !== 'shepherd' &&
      source !== 'drip_brew'
    ) {
      return NextResponse.json(
        { error: 'source must be shepherd or drip_brew' },
        { status: 400 }
      );
    }

    const { person, found } = await lookupOrCreatePerson({
      church_id: auth.apiKey!.church_id,
      email,
      phone,
      first_name: first_name || 'Unknown',
      last_name: last_name || 'Unknown',
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
      .select('tag:tags(id, display_id, name, color)')
      .eq('person_id', person.id)
      .eq('church_id', auth.apiKey!.church_id);

    const tags = (personTags || [])
      .flatMap((pt) => {
        const tag = Array.isArray(pt.tag) ? pt.tag[0] : pt.tag;
        return tag ? [{ ...tag, id: displayIdFor(tag) }] : [];
      })
      .filter(Boolean);

    const personSummary = {
      id: displayIdFor(person),
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

  } catch (error: unknown) {
    if (error instanceof PersonIdentityConflictError) {
      return NextResponse.json(
        { error: error.message, code: 'identity_conflict' },
        { status: 409 }
      );
    }

    console.error('Error in POST /people/lookup:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Invalid request body',
      },
      { status: 400 }
    );
  }
}
