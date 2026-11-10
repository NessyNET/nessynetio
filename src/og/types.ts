// Link-preview card input (design 3.5.5, 8.2). Types only; task 028 implements builders and renderer.

export interface OgCardInput {
  readonly kind: 'home' | 'category' | 'project' | 'bookmarks' | 'default';
  readonly title: string;
  /** Plain text. */
  readonly subtitle: string;
  readonly categoryLabel?: string;
  /** A palette accent token; `src/lib/palette.ts` (004) owns the allow-list. */
  readonly accent?: string;
  readonly status?: 'active' | 'retired';
  readonly version?: string;
  readonly screenshot?: { readonly file: string; readonly alt: string };
}
