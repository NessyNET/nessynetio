// Interim link-preview card (design 3.5.5, ADR 009): the only design-specific file of the OG pipeline. Pure function
// from card input (plus the optional screenshot bytes) to a 1200x630 PNG; palette tokens only, JetBrains Mono.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';
import sharp from 'sharp';
import { type PaletteToken, paletteHex } from '../lib/palette.ts';
import { OG_RETIRED, OG_SITE_NAME, versionLabel } from '../lib/strings.ts';
import { OG_HEIGHT, OG_WIDTH } from './inputs.ts';
import type { OgCardInput } from './types.ts';

const FONT = 'JetBrains Mono';
// Relative to the project root, not `import.meta.url`: the build bundles this module into `dist/.prerender/`.
const loadFont = (file: string): Buffer => readFileSync(join(process.cwd(), 'src/og/fonts', file));
let fonts: { name: string; data: Buffer; weight: 400 | 700; style: 'normal' }[] | undefined;
const getFonts = () =>
  (fonts ??= [
    { name: FONT, data: loadFont('JetBrainsMono-Regular.ttf'), weight: 400, style: 'normal' },
    { name: FONT, data: loadFont('JetBrainsMono-Bold.ttf'), weight: 700, style: 'normal' },
  ]);

/** Legibility floors at the size chat clients show the card (Freya 028 re-check). */
const SUMMARY_SIZE = 38;
const META_SIZE = 32;
const SHOT_WIDTH = 400;
const SHOT_HEIGHT = 250;
const PAD = 64;
const INNER_WIDTH = OG_WIDTH - 2 * PAD;
const FOOTER_HEIGHT = 44;
const SHOT_GAP = 48;
const SHOT_BORDER = 2;

const TITLE_SIZES = [64, 56, 48, 40] as const;
const MONO_ADVANCE = 0.6; // JetBrains Mono: advance width as a fraction of the font size

/** Largest title size that keeps the title within two lines of a column `width` wide (Satori ignores line clamps here). */
const titleSize = (title: string, width: number): number =>
  TITLE_SIZES.find((size) => Math.ceil(title.length / Math.floor(width / (size * MONO_ADVANCE))) <= 2) ?? TITLE_SIZES[TITLE_SIZES.length - 1]!;

type Node = { type: string; props: Record<string, unknown> };
const el = (type: string, style: Record<string, unknown>, children?: unknown, extra: Record<string, unknown> = {}): Node => ({
  type,
  props: { style: { display: 'flex', ...style }, ...(children === undefined ? {} : { children }), ...extra },
});
const text = (style: Record<string, unknown>, value: string): Node => el('div', style, value);

const isToken = (value: string | undefined): value is PaletteToken => {
  try {
    return value !== undefined && /^#[0-9a-f]{6}$/i.test(paletteHex(value as PaletteToken));
  } catch {
    return false;
  }
};

function layout(input: OgCardInput, shotUri: string | undefined): Node {
  const accent = paletteHex(isToken(input.accent) ? input.accent : 'primary');
  const accented = [input.categoryLabel, input.version === undefined ? undefined : versionLabel(input.version)]
    .filter((part): part is string => part !== undefined)
    .join('  ');
  const meta = [
    accented === '' ? null : text({ color: accent }, accented),
    input.status === 'retired' ? text({ color: paletteHex('muted') }, OG_RETIRED) : null,
  ].filter((node) => node !== null);
  const bodyWidth = shotUri === undefined ? INNER_WIDTH : INNER_WIDTH - SHOT_WIDTH - 2 * SHOT_BORDER - SHOT_GAP;
  const body = el('div', { flexDirection: 'column', width: bodyWidth }, [
    meta.length === 0 ? null : el('div', { fontSize: META_SIZE, gap: 24, marginBottom: 16 }, meta),
    el('div', { width: 120, height: 8, backgroundColor: accent, marginBottom: 20 }),
    text({ fontSize: titleSize(input.title, bodyWidth), fontWeight: 700, color: paletteHex('fg_bright'), lineClamp: 2, lineHeight: 1.1 }, input.title),
    text({ fontSize: SUMMARY_SIZE, color: paletteHex('fg'), marginTop: 20, lineClamp: 4, lineHeight: 1.3 }, input.subtitle),
  ]);
  const shot =
    shotUri === undefined
      ? null
      : el('div', { marginLeft: SHOT_GAP, border: `${SHOT_BORDER}px solid ${paletteHex('border')}`, alignSelf: 'center' }, [
          el('img', { display: 'flex' }, undefined, { src: shotUri, width: SHOT_WIDTH, height: SHOT_HEIGHT }),
        ]);
  return el(
    'div',
    { width: OG_WIDTH, height: OG_HEIGHT, flexDirection: 'column', backgroundColor: paletteHex('bg_dark'), padding: PAD, boxSizing: 'border-box', fontFamily: FONT },
    [
      el('div', { width: INNER_WIDTH, height: OG_HEIGHT - 2 * PAD - FOOTER_HEIGHT, overflow: 'hidden' }, [body, shot]),
      text({ fontSize: 30, fontWeight: 700, color: paletteHex('primary'), height: FOOTER_HEIGHT, alignItems: 'flex-end' }, OG_SITE_NAME),
    ],
  );
}

/** Renders the card as a 1200x630 PNG. Without a screenshot the text uses the full width. */
export async function renderCard(input: OgCardInput, screenshot?: Uint8Array): Promise<Uint8Array> {
  const shotUri =
    screenshot === undefined
      ? undefined
      : `data:image/png;base64,${(await sharp(screenshot).resize(SHOT_WIDTH, SHOT_HEIGHT, { fit: 'cover' }).png().toBuffer()).toString('base64')}`;
  const svg = await satori(layout(input, shotUri) as never, { width: OG_WIDTH, height: OG_HEIGHT, fonts: getFonts() });
  return new Resvg(svg, { fitTo: { mode: 'width', value: OG_WIDTH } }).render().asPng();
}
