// <!-- AGENT: BACKEND -->
import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import {
  adminApiError,
  requireTenantContext,
} from '@/lib/tenant-context';
import { recordAuditLog } from '@/lib/audit-log';
import { applyDisplayOrDatabaseIdFilter } from '@/lib/display-ids';
import {
  PEOPLE_PHOTOS_BUCKET,
  canTenantRoleViewPeoplePhotos,
  createPeoplePhotoSignedUrl,
  generatePeoplePhotoPath,
  isFileLike,
  processPeoplePhotoUpload,
  resolvePeoplePhotoPath,
} from '@/lib/people/photos';

export const runtime = 'nodejs';

type PersonPhotoRow = {
  id: string;
  display_id: string;
  first_name: string;
  last_name: string;
  status: 'active' | 'visitor' | 'inactive' | 'child';
  photo_path: string | null;
  photo_url: string | null;
};

async function resolvePerson(churchId: string, id: string) {
  const supabase = createServiceClient();
  const query = supabase
    .from('people')
    .select('id, display_id, first_name, last_name, status, photo_path, photo_url')
    .eq('church_id', churchId);

  const { data, error } = await applyDisplayOrDatabaseIdFilter(query, id)
    .maybeSingle();

  if (error) throw error;
  return data as PersonPhotoRow | null;
}

async function removeStorageObject(path: string | null) {
  if (!path) return;

  const { error } = await createServiceClient()
    .storage
    .from(PEOPLE_PHOTOS_BUCKET)
    .remove([path]);

  if (error) {
    console.error('[people-photo] failed to remove old object', {
      path,
      message: error.message,
    });
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { churchId, role } = await requireTenantContext();
    if (!canTenantRoleViewPeoplePhotos(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const person = await resolvePerson(churchId, id);
    if (!person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }

    const signed = await createPeoplePhotoSignedUrl(person, churchId);
    return NextResponse.json(
      { data: signed },
      {
        headers: {
          'Cache-Control': 'private, no-store',
        },
      }
    );
  } catch (error: unknown) {
    return adminApiError(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { churchId, user } = await requireTenantContext({ requireManager: true });
    const supabase = await createClient();
    const serviceClient = createServiceClient();
    const { id } = await params;
    const person = await resolvePerson(churchId, id);
    if (!person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }

    const formData = await request.formData();
    const rawFile = formData.get('file');
    if (!isFileLike(rawFile)) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    const processed = await processPeoplePhotoUpload(rawFile);
    if ('error' in processed) {
      return NextResponse.json(
        { error: processed.error },
        { status: processed.status }
      );
    }

    const nextPath = generatePeoplePhotoPath(churchId, person.id);
    const previousPath = resolvePeoplePhotoPath(person, churchId);
    const uploadResult = await serviceClient.storage
      .from(PEOPLE_PHOTOS_BUCKET)
      .upload(nextPath, processed.photo.buffer, {
        contentType: processed.photo.contentType,
        upsert: false,
      });

    if (uploadResult.error) {
      return NextResponse.json({ error: 'Photo could not be uploaded' }, { status: 500 });
    }

    const { error: updateError } = await supabase
      .from('people')
      .update({
        photo_path: nextPath,
        photo_url: null,
      })
      .eq('id', person.id)
      .eq('church_id', churchId);

    if (updateError) {
      await removeStorageObject(nextPath);
      throw updateError;
    }

    if (previousPath && previousPath !== nextPath) {
      await removeStorageObject(previousPath);
    }

    await recordAuditLog({
      churchId,
      actor: user,
      action: previousPath ? 'person.photo_replaced' : 'person.photo_uploaded',
      resourceType: 'person',
      resourceDisplayId: person.display_id,
      metadata: {
        person_id: person.id,
        object_path: nextPath,
        status: person.status,
      },
      request,
    });

    const signed = await createPeoplePhotoSignedUrl(
      { id: person.id, photo_path: nextPath, photo_url: null },
      churchId
    );

    return NextResponse.json(
      { data: { ...signed, photo_path: nextPath } },
      {
        headers: {
          'Cache-Control': 'private, no-store',
        },
      }
    );
  } catch (error: unknown) {
    return adminApiError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { churchId, user } = await requireTenantContext({ requireManager: true });
    const supabase = await createClient();
    const { id } = await params;
    const person = await resolvePerson(churchId, id);
    if (!person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }

    const previousPath = resolvePeoplePhotoPath(person, churchId);
    const { error: updateError } = await supabase
      .from('people')
      .update({
        photo_path: null,
        photo_url: null,
      })
      .eq('id', person.id)
      .eq('church_id', churchId);

    if (updateError) throw updateError;
    await removeStorageObject(previousPath);

    await recordAuditLog({
      churchId,
      actor: user,
      action: 'person.photo_removed',
      resourceType: 'person',
      resourceDisplayId: person.display_id,
      metadata: {
        person_id: person.id,
        object_path: previousPath,
        status: person.status,
      },
      request,
    });

    return NextResponse.json({ data: { removed: true } });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}
