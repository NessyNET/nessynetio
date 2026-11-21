// Palette allow-lists and hex lookup (ADR 013). Values come from the generated palette-data.ts.
import { PALETTE } from './palette-data.ts';

export const CATEGORY_ACCENTS = ['blue', 'orange', 'yellow', 'purple', 'cyan', 'teal', 'pink'] as const;
export const TAGLINE_COLOURS = ['green', 'yellow', 'cyan', 'teal', 'blue', 'purple', 'pink', 'orange'] as const;
export const TAGLINE_AUTO_CYCLE = ['green', 'yellow', 'cyan', 'pink', 'purple'] as const;

export type CategoryAccent = (typeof CATEGORY_ACCENTS)[number];
export type TaglineColour = (typeof TAGLINE_COLOURS)[number];
export type PaletteToken = keyof typeof PALETTE.base | keyof typeof PALETTE.accent;

export const isCategoryAccent = (value: unknown): value is CategoryAccent =>
  (CATEGORY_ACCENTS as readonly unknown[]).includes(value);
export const isTaglineColour = (value: unknown): value is TaglineColour =>
  (TAGLINE_COLOURS as readonly unknown[]).includes(value);

/** Hex value of a base or accent token, for the OG card. */
export const paletteHex = (token: PaletteToken): string =>
  token in PALETTE.accent ? PALETTE.accent[token as keyof typeof PALETTE.accent] : PALETTE.base[token as keyof typeof PALETTE.base];
