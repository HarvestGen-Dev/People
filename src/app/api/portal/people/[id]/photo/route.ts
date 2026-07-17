// <!-- AGENT: BACKEND -->
import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { createPeoplePhotoSignedUrl } from '@/lib/people/photos';

type PortalPhotoPerson = {
  id: string;
  church_id: string;
  photo_path: string | null;
  photo_url: string | null;
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionClient = await createClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const serviceClient = createServiceClient();
    const { data: link, error } = await serviceClient
      .from('person_user_links')
      .select('people!person_user_links_church_person_fk(id, church_id, photo_path, photo_url)')
      .eq('user_id', user.id)
      .eq('person_id', id)
      .maybeSingle();

    if (error) throw error;
    if (!link?.people) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }

    const person = (Array.isArray(link.people)
      ? link.people[0]
      : link.people) as PortalPhotoPerson | undefined;

    if (!person) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }

    const signed = await createPeoplePhotoSignedUrl(person, person.church_id);
    return NextResponse.json(
      { data: signed },
      {
        headers: {
          'Cache-Control': 'private, no-store',
        },
      }
    );
  } catch {
    return NextResponse.json({ error: 'Unable to load photo' }, { status: 500 });
  }
}
