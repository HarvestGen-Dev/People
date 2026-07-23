// <!-- AGENT: BACKEND -->
import crypto from 'node:crypto';
import sharp from 'sharp';

export const PEOPLE_PHOTO_MAX_INPUT_BYTES = 5 * 1024 * 1024;
export const PEOPLE_PHOTO_MAX_WIDTH = 4096;
export const PEOPLE_PHOTO_MAX_HEIGHT = 4096;
export const PEOPLE_PHOTO_MAX_PIXELS = 16_000_000;
export const PEOPLE_PHOTO_OUTPUT_MAX_DIMENSION = 1024;

export function isTenantScopedPeoplePhotoPath(path, churchId, personId) {
  if (path.includes('..') || path.includes('\\')) return false;
  const escapedChurchId = churchId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedPersonId = personId?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = escapedPersonId
    ? `^${escapedChurchId}/${escapedPersonId}/[A-Za-z0-9._-]+$`
    : `^${escapedChurchId}/[0-9a-f-]{36}/[A-Za-z0-9._-]+$`;

  return new RegExp(pattern).test(path);
}

export function legacyPeoplePhotoPathFromUrl(value) {
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

export function generatePeoplePhotoPath(churchId, personId) {
  return `${churchId}/${personId}/${crypto.randomUUID()}.webp`;
}

export async function processPeoplePhotoBuffer(input) {
  if (input.length > PEOPLE_PHOTO_MAX_INPUT_BYTES) {
    return { error: 'Image must be 5MB or smaller', status: 413 };
  }

  let image = sharp(input, {
    failOn: 'warning',
    limitInputPixels: PEOPLE_PHOTO_MAX_PIXELS,
  });

  let metadata;
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
