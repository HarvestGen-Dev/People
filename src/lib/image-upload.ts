// <!-- AGENT: BACKEND -->
const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export function validateImageUpload(file: FormDataEntryValue | null, maxBytes: number) {
  if (!(file instanceof File)) {
    return { error: 'No image provided' } as const;
  }

  const extension = IMAGE_EXTENSIONS[file.type];
  if (!extension) {
    return { error: 'Image must be a JPEG, PNG, or WebP file' } as const;
  }

  if (file.size > maxBytes) {
    return {
      error: `Image must be smaller than ${Math.round(maxBytes / 1024 / 1024)}MB`,
    } as const;
  }

  return { file, extension } as const;
}

