// <!-- AGENT: BACKEND -->
import 'server-only';

import { createServiceClient } from '@/lib/supabase/server';
import type { TenantRole } from '@/lib/tenant-context';
import {
  PEOPLE_PHOTO_MAX_INPUT_BYTES,
  isTenantScopedPeoplePhotoPath,
  legacyPeoplePhotoPathFromUrl,
  processPeoplePhotoBuffer,
} from '@/lib/people/photo-processing.mjs';

export {
  PEOPLE_PHOTO_MAX_HEIGHT,
  PEOPLE_PHOTO_MAX_INPUT_BYTES,
  PEOPLE_PHOTO_MAX_PIXELS,
  PEOPLE_PHOTO_MAX_WIDTH,
  PEOPLE_PHOTO_OUTPUT_MAX_DIMENSION,
  generatePeoplePhotoPath,
  isTenantScopedPeoplePhotoPath,
  legacyPeoplePhotoPathFromUrl,
  processPeoplePhotoBuffer,
} from '@/lib/people/photo-processing.mjs';

export const PEOPLE_PHOTOS_BUCKET = 'people-photos';
export const PEOPLE_PHOTO_SIGNED_URL_TTL_SECONDS = 10 * 60;

export type PhotoPersonReference = {
  id: string;
  church_id?: string | null;
  photo_path?: string | null;
  photo_url?: string | null;
};

export type SignedPhotoResult = {
  personId: string;
  signedUrl: string | null;
  expiresIn: number;
};

const ADMIN_PHOTO_ROLES: TenantRole[] = [
  'owner',
  'admin',
  'pastoral',
  'staff',
  'viewer',
];

export function canTenantRoleViewPeoplePhotos(role: TenantRole): boolean {
  return ADMIN_PHOTO_ROLES.includes(role);
}

export function resolvePeoplePhotoPath(
  person: PhotoPersonReference,
  churchId: string
): string | null {
  if (
    person.photo_path &&
    isTenantScopedPeoplePhotoPath(person.photo_path, churchId, person.id)
  ) {
    return person.photo_path;
  }

  const legacyPath = legacyPeoplePhotoPathFromUrl(person.photo_url);
  if (
    legacyPath &&
    isTenantScopedPeoplePhotoPath(legacyPath, churchId, person.id)
  ) {
    return legacyPath;
  }

  return null;
}

export async function createPeoplePhotoSignedUrl(
  person: PhotoPersonReference,
  churchId: string
): Promise<SignedPhotoResult> {
  const path = resolvePeoplePhotoPath(person, churchId);
  if (!path) {
    return {
      personId: person.id,
      signedUrl: null,
      expiresIn: PEOPLE_PHOTO_SIGNED_URL_TTL_SECONDS,
    };
  }

  const { data, error } = await createServiceClient()
    .storage
    .from(PEOPLE_PHOTOS_BUCKET)
    .createSignedUrl(path, PEOPLE_PHOTO_SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    return {
      personId: person.id,
      signedUrl: null,
      expiresIn: PEOPLE_PHOTO_SIGNED_URL_TTL_SECONDS,
    };
  }

  return {
    personId: person.id,
    signedUrl: data.signedUrl,
    expiresIn: PEOPLE_PHOTO_SIGNED_URL_TTL_SECONDS,
  };
}

export async function addSignedPhotoUrls<T extends PhotoPersonReference>(
  people: T[],
  churchId: string
): Promise<Array<T & { photo_signed_url: string | null }>> {
  const signed = await Promise.all(
    people.map((person) => createPeoplePhotoSignedUrl(person, churchId))
  );
  const signedByPersonId = new Map(
    signed.map((item) => [item.personId, item.signedUrl])
  );

  return people.map((person) => ({
    ...person,
    photo_signed_url: signedByPersonId.get(person.id) ?? null,
  }));
}

export async function processPeoplePhotoUpload(
  file: File
): ReturnType<typeof processPeoplePhotoBuffer> {
  if (file.size > PEOPLE_PHOTO_MAX_INPUT_BYTES) {
    return { error: 'Image must be 5MB or smaller', status: 413 };
  }

  const input = Buffer.from(await file.arrayBuffer());
  if (input.length > PEOPLE_PHOTO_MAX_INPUT_BYTES) {
    return { error: 'Image must be 5MB or smaller', status: 413 };
  }

  return processPeoplePhotoBuffer(input);
}

export function isFileLike(value: FormDataEntryValue | null): value is File {
  return value instanceof File;
}
