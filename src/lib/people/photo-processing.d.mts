export const PEOPLE_PHOTO_MAX_INPUT_BYTES: number;
export const PEOPLE_PHOTO_MAX_WIDTH: number;
export const PEOPLE_PHOTO_MAX_HEIGHT: number;
export const PEOPLE_PHOTO_MAX_PIXELS: number;
export const PEOPLE_PHOTO_OUTPUT_MAX_DIMENSION: number;

export type ProcessedPeoplePhoto = {
  buffer: Buffer;
  contentType: 'image/webp';
  extension: 'webp';
  width: number;
  height: number;
};

export function isTenantScopedPeoplePhotoPath(
  path: string,
  churchId: string,
  personId?: string
): boolean;

export function legacyPeoplePhotoPathFromUrl(
  value: string | null | undefined
): string | null;

export function generatePeoplePhotoPath(
  churchId: string,
  personId: string
): string;

export function processPeoplePhotoBuffer(input: Buffer): Promise<
  | { photo: ProcessedPeoplePhoto }
  | { error: string; status: 400 | 413 }
>;
