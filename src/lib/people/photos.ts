// <!-- AGENT: BACKEND -->
import 'server-only';

import crypto from 'crypto';
import sharp, { type Metadata } from 'sharp';
import { createServiceClient } from '@/lib/supabase/server';
import type { TenantRole } from '@/lib/tenant-context';

export const PEOPLE_PHOTOS_BUCKET = 'people-photos';
export const PEOPLE_PHOTO_SIGNED_URL_TTL_SECONDS = 10 * 60;
export const PEOPLE_PHOTO_MAX_INPUT_BYTES = 5 * 1024 * 1024;
export const PEOPLE_PHOTO_MAX_WIDTH = 4096;
export const PEOPLE_PHOTO_MAX_HEIGHT = 4096;
export const PEOPLE_PHOTO_MAX_PIXELS = 16_000_000;
export const PEOPLE_PHOTO_OUTPUT_MAX_DIMENSION = 1024;

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

type ProcessedPhoto = {
  buffer: Buffer;
  contentType: 'image/webp';
  extension: 'webp';
  width: number;
  height: number;
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

export function isTenantScopedPeoplePhotoPath(
  path: string,
  churchId: string,
  personId?: string
): boolean {
  if (path.includes('..') || path.includes('\\')) return false;
  const escapedChurchId = churchId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedPersonId = personId?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = escapedPersonId
    ? `^${escapedChurchId}/${escapedPersonId}/[A-Za-z0-9._-]+$`
    : `^${escapedChurchId}/[0-9a-f-]{36}/[A-Za-z0-9._-]+$`;

  return new RegExp(pattern).test(path);
}

export function legacyPeoplePhotoPathFromUrl(
  value: string | null | undefined
): string | null {
  if (!value) return null;

  if (!value.includes('/storage/v1/object/public/people-photos/')) {
    return null;
  }

  try {
    const url = new URL(value);
    const marker = '/storage/v1/object/public/people-photos/';
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex === -1) return null;
    return decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
  } catch {
    return null;
  }
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

export function generatePeoplePhotoPath(churchId: string, personId: string) {
  return `${churchId}/${personId}/${crypto.randomUUID()}.webp`;
}

export async function processPeoplePhotoUpload(file: File): Promise<
  | { photo: ProcessedPhoto }
  | { error: string; status: 400 | 413 }
> {
  if (file.size > PEOPLE_PHOTO_MAX_INPUT_BYTES) {
    return { error: 'Image must be 5MB or smaller', status: 413 };
  }

  const input = Buffer.from(await file.arrayBuffer());
  if (input.length > PEOPLE_PHOTO_MAX_INPUT_BYTES) {
    return { error: 'Image must be 5MB or smaller', status: 413 };
  }

  let image = sharp(input, {
    failOn: 'warning',
    limitInputPixels: PEOPLE_PHOTO_MAX_PIXELS,
  });

  let metadata: Metadata;
  try {
    metadata = await image.metadata();
  } catch {
    return { error: 'Image could not be decoded', status: 400 };
  }

  if (!metadata.width || !metadata.height || !metadata.format) {
    return { error: 'Image dimensions could not be determined', status: 400 };
  }

  if (!['jpeg', 'png', 'webp'].includes(metadata.format)) {
    return { error: 'Image must be a JPEG, PNG, or WebP file', status: 400 };
  }

  if ((metadata.pages ?? 1) > 1) {
    return { error: 'Animated or multi-page images are not supported', status: 400 };
  }

  if (
    metadata.width > PEOPLE_PHOTO_MAX_WIDTH ||
    metadata.height > PEOPLE_PHOTO_MAX_HEIGHT ||
    metadata.width * metadata.height > PEOPLE_PHOTO_MAX_PIXELS
  ) {
    return {
      error: 'Image dimensions are too large',
      status: 413,
    };
  }

  image = image
    .rotate()
    .resize({
      width: PEOPLE_PHOTO_OUTPUT_MAX_DIMENSION,
      height: PEOPLE_PHOTO_OUTPUT_MAX_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 82 });

  try {
    const { data, info } = await image.toBuffer({ resolveWithObject: true });
    return {
      photo: {
        buffer: data,
        contentType: 'image/webp',
        extension: 'webp',
        width: info.width,
        height: info.height,
      },
    };
  } catch {
    return { error: 'Image could not be processed', status: 400 };
  }
}

export function isFileLike(value: FormDataEntryValue | null): value is File {
  return value instanceof File;
}
