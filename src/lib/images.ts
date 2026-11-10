// Screenshot lookup (design 3.5.4): the model carries content-relative paths (`projects/<category>/<slug>/<file>`),
// this module maps them to the images `astro:assets` optimises. The content dir comes from the `@content` alias.
import type { ImageMetadata } from 'astro';

const images = import.meta.glob<ImageMetadata>('@content/projects/**/*.{png,jpg,jpeg,webp}', { eager: true, import: 'default' });

/**
 * Glob keys are root-relative with a leading slash when the content dir is inside the repo and `../`-relative when it
 * is outside, so no prefix is assumed: the entry is the one whose key ends with `/` + the content-relative path.
 */
export function findImage<T>(entries: Readonly<Record<string, T>>, file: string): T {
  const suffix = `/${file}`;
  const key = Object.keys(entries).find((candidate) => candidate.endsWith(suffix));
  if (key === undefined) {
    throw new Error(`screenshot "${file}" not found among the content images (the validator should have reported it)`);
  }
  return entries[key] as T;
}

export const resolveScreenshot = (file: string): ImageMetadata => findImage(images, file);
