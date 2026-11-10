// Keyboard focus must never rest under the fixed status line (ux 8.5). `scroll-padding-bottom` covers
// scrollIntoView and Tab in most browsers; this nudge covers the rest. Pointer focus is left alone.

const THRESHOLD = 12;

interface Edges {
  top: number;
  bottom: number;
}

/** Pixels to scroll down so the element's bottom edge sits `threshold` above the status line; 0 when it already does. */
export function nudgeDistance(el: Edges, statusTop: number, threshold: number = THRESHOLD): number {
  return Math.max(0, el.bottom - (statusTop - threshold));
}

function attach(doc: Document, win: Window): void {
  const statusLine = doc.querySelector('footer.statusline');
  if (statusLine === null) return;
  doc.addEventListener('focusin', (event) => {
    const target = event.target;
    if (!(target instanceof Element) || statusLine.contains(target)) return;
    if (!target.matches(':focus-visible')) return;
    // Measure on the next frame: the browser's own scroll-into-view for the focus has settled by then.
    win.requestAnimationFrame(() => {
      if (doc.activeElement !== target) return;
      const distance = nudgeDistance(target.getBoundingClientRect(), statusLine.getBoundingClientRect().top);
      // Instant, not smooth: a keyboard user tabbing quickly should never wait on an animation (reduced motion too).
      if (distance > 0) win.scrollBy({ top: distance, behavior: 'instant' });
    });
  });
}

if (typeof document !== 'undefined') attach(document, window);
