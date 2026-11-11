// Screenshot modal (ux 5.5). Thumbnails are real links to the large image, so without this script they open it in
// the tab. With it, a click opens the page's one native <dialog>: the browser traps focus, closes on Esc and returns
// focus to the opener. The large image is only given a `src` while the dialog is open.
import { shotCounter } from '../lib/strings.ts';

/** Index `delta` steps from `index` among `count` screenshots, wrapping at both ends. */
export const stepIndex = (index: number, count: number, delta: number): number => (((index + delta) % count) + count) % count;

function attach(doc: Document): void {
  const box = doc.querySelector<HTMLDialogElement>('dialog[data-shotbox]');
  const links = [...doc.querySelectorAll<HTMLAnchorElement>('a[data-shot]')];
  if (box === null || links.length === 0 || typeof box.showModal !== 'function') return;
  const img = box.querySelector('img');
  const caption = box.querySelector('[data-shot-caption]');
  const counter = box.querySelector('[data-shot-count]');
  const nav = box.querySelector<HTMLElement>('[data-shot-nav]');
  if (img === null || caption === null || counter === null || nav === null) return;
  const single = links.length < 2;

  let index = 0;
  let opener: HTMLElement | null = null;

  const show = (next: number): void => {
    index = next;
    const link = links[index] as HTMLAnchorElement;
    const alt = link.querySelector('img')?.alt ?? '';
    img.src = link.href;
    img.alt = alt;
    caption.textContent = alt;
    counter.textContent = shotCounter(index + 1, links.length);
  };

  nav.hidden = single;
  counter.toggleAttribute('hidden', single);
  links.forEach((link, i) => {
    link.setAttribute('aria-haspopup', 'dialog');
    link.addEventListener('click', (event) => {
      // Let modified clicks (new tab, download) keep their normal meaning.
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      opener = link;
      show(i);
      box.showModal();
    });
  });

  const step = (delta: number): void => show(stepIndex(index, links.length, delta));
  box.querySelector('[data-shot-prev]')?.addEventListener('click', () => step(-1));
  box.querySelector('[data-shot-next]')?.addEventListener('click', () => step(1));
  box.querySelector('[data-shot-close]')?.addEventListener('click', () => box.close());
  box.addEventListener('keydown', (event) => {
    if (single) return;
    if (event.key === 'ArrowLeft') step(-1);
    else if (event.key === 'ArrowRight') step(1);
  });
  // The dialog box is edge to edge with its content, so a click whose target is the dialog itself hit the backdrop.
  box.addEventListener('click', (event) => {
    if (event.target === box) box.close();
  });
  box.addEventListener('close', () => {
    img.removeAttribute('src');
    opener?.focus();
    opener = null;
  });
}

if (typeof document !== 'undefined') attach(document);
