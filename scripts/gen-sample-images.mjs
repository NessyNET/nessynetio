// `node scripts/gen-sample-images.mjs`: writes the placeholder screenshots of the sample content (design 3.5.6, task 013).
// One 1280x720 PNG per screenshot, named NN.sample.png, palette-coloured by category and labelled "sample screenshot".
// Deterministic: same input, same bytes (no timestamps or metadata; fixed compression).
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { PALETTE } from '../src/lib/palette-data.ts';

const CONTENT_PROJECTS = new URL('../content/projects/', import.meta.url);
const WIDTH = 1280;
const HEIGHT = 720;

/** Category -> palette accent (matches content/categories.toml). */
const ACCENT = { ffxiv: 'blue', minecraft: 'orange', linux: 'yellow', other: 'purple' };

/** Projects that have screenshots in the r8 mocks, and how many. */
export const SHOTS = [
  { category: 'ffxiv', slug: 'loch-lantern', count: 3 },
  { category: 'ffxiv', slug: 'gorse-gearplanner', count: 1 },
  { category: 'ffxiv', slug: 'peat-fishing-log', count: 3 },
  { category: 'ffxiv', slug: 'kelpie-chat-tabs', count: 2 },
  { category: 'minecraft', slug: 'peatmoss', count: 3 },
  { category: 'minecraft', slug: 'highland-pack', count: 2 },
  { category: 'linux', slug: 'lochctl', count: 2 },
  { category: 'other', slug: 'ripple-bot', count: 2 },
];

const escapeXml = (text) => text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** @param {{ category: string, slug: string }} project @param {number} index 1-based */
export function renderSvg({ category, slug }, index) {
  const { base, accent } = PALETTE;
  const colour = accent[ACCENT[category]];
  const mono = 'DejaVu Sans Mono, JetBrains Mono, monospace';
  const label = (y, size, fill, text) =>
    `<text x="${WIDTH / 2}" y="${y}" text-anchor="middle" font-family="${mono}" font-size="${size}" fill="${fill}">${escapeXml(text)}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${base.bg_light}"/><stop offset="1" stop-color="${base.bg_dark}"/></linearGradient></defs>
<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#g)"/>
<rect x="24" y="24" width="${WIDTH - 48}" height="${HEIGHT - 48}" rx="8" fill="none" stroke="${base.border}" stroke-width="2" stroke-dasharray="12 8"/>
<rect x="24" y="24" width="${WIDTH - 48}" height="8" rx="4" fill="${colour}"/>
${label(330, 56, base.fg_bright, 'sample screenshot')}
${label(400, 30, colour, `${category}/${slug}`)}
${label(450, 24, base.muted, `image ${String(index).padStart(2, '0')}`)}
</svg>`;
}

/** @param {{ category: string, slug: string }} project @param {number} index 1-based */
export async function renderPng(project, index) {
  return sharp(Buffer.from(renderSvg(project, index))).png({ compressionLevel: 9 }).toBuffer();
}

async function main() {
  let written = 0;
  for (const project of SHOTS) {
    const dir = fileURLToPath(new URL(`${project.category}/${project.slug}/`, CONTENT_PROJECTS));
    await mkdir(dir, { recursive: true });
    for (let i = 1; i <= project.count; i++) {
      await writeFile(join(dir, `${String(i).padStart(2, '0')}.sample.png`), await renderPng(project, i));
      written++;
    }
  }
  console.log(`wrote ${written} sample images under ${fileURLToPath(CONTENT_PROJECTS)}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
