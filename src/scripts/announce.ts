// The one polite live region (ux 8.7, `#live` in Base.astro). Used by the category and copy scripts.

const LIVE_ID = 'live';

/**
 * Clear, then set on the next frame: assistive tech only re-reads a live region whose text changed,
 * so a repeated message (the same copy result twice) would otherwise stay silent.
 */
export function announce(message: string, doc: Document = document): void {
  const region = doc.getElementById(LIVE_ID);
  if (region === null) return;
  region.textContent = '';
  requestAnimationFrame(() => {
    region.textContent = message;
  });
}
