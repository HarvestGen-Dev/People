import { copyFile, mkdir } from 'node:fs/promises';
import { assets } from './assets.mjs';

const output = new URL('./dist/', import.meta.url);
await mkdir(output, { recursive: true });
await Promise.all([...assets.keys()].map((name) =>
  copyFile(new URL('./public/' + name, import.meta.url), new URL(name, output))
));
