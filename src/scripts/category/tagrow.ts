// One-line tag row with a "+N more" panel (ux 7.6, 7.17): fits as many chips as the row allows, pins `all` and the
// active tag, and moves the rest into a disclosure panel. Chip clicks are handled by the category script (023);
// this module only places chips and runs the panel.
import { moreToggle, moreToggleName } from '../../lib/strings.ts';
import type { CategoryController } from '../category.ts';

export interface Fit {
  /** Indices (config order) that stay in the row. */
  row: number[];
  /** Indices (config order) that move behind the toggle. */
  panel: number[];
}

/**
 * Which chips stay in the row. `widths` include the gap after each chip; `available` is the row's content width plus
 * one gap, measured with the toggle shown; `toggleWidth` is the toggle plus its gap. Pinned chips always stay. When
 * everything fits without the toggle, nothing moves. With `pinnedOnly` (phone widths) only pinned chips stay.
 */
export function fitChips(widths: readonly number[], available: number, toggleWidth: number, pinned: ReadonlySet<number>, pinnedOnly = false): Fit {
  const keep = new Set(pinned);
  const total = widths.reduce((sum, w) => sum + w, 0);
  if (!pinnedOnly && total <= available + toggleWidth) {
    widths.forEach((_, i) => keep.add(i));
  } else if (!pinnedOnly) {
    let used = [...pinned].reduce((sum, i) => sum + (widths[i] ?? 0), 0);
    widths.forEach((w, i) => {
      if (keep.has(i) || used + w > available) return;
      keep.add(i);
      used += w;
    });
  }
  const indices = widths.map((_, i) => i);
  return { row: indices.filter((i) => keep.has(i)), panel: indices.filter((i) => !keep.has(i)) };
}

const PHONE = '(max-width: 600px)';

/** Wires the layout and the panel for the tag row inside `root` (the `.controls` block). */
export function initTagRow(root: HTMLElement, controller: CategoryController): void {
  const row = root.querySelector<HTMLElement>('[data-chiprow]');
  const panel = root.querySelector<HTMLElement>('[data-morepanel]');
  const more = root.querySelector<HTMLButtonElement>('[data-more]');
  if (row === null || panel === null || more === null) return;
  // Canonical (config) order, taken before anything moves.
  const chips = [...root.querySelectorAll<HTMLElement>('.chip[data-tag]')];
  const phone = matchMedia(PHONE);

  const setOpen = (open: boolean): void => {
    more.setAttribute('aria-expanded', String(open));
    panel.hidden = !open;
  };

  function layout(): void {
    const focused = document.activeElement;
    // Measure with every chip in the row and the toggle at its widest.
    row!.append(...chips);
    more!.hidden = false;
    more!.textContent = moreToggle(chips.length);
    const gap = parseFloat(getComputedStyle(row!).columnGap) || 6;
    // The row has 3 px of padding on each side so focus rings are not clipped.
    const available = row!.clientWidth - 6 + gap;
    const active = controller.getState().tag;
    const pinned = new Set(chips.flatMap((chip, i) => (chip.dataset['tag'] === 'all' || chip.dataset['tag'] === active ? [i] : [])));
    const { row: inRow, panel: inPanel } = fitChips(chips.map((chip) => chip.offsetWidth + gap), available, more!.offsetWidth + gap, pinned, phone.matches);

    row!.append(...inRow.flatMap((i) => chips[i] ?? []));
    panel!.append(...inPanel.flatMap((i) => chips[i] ?? []));
    more!.hidden = inPanel.length === 0;
    more!.textContent = moreToggle(inPanel.length);
    more!.setAttribute('aria-label', moreToggleName(inPanel.length));
    if (inPanel.length === 0) setOpen(false);
    if (focused instanceof HTMLElement && focused.isConnected && document.activeElement !== focused) focused.focus();
  }

  more.addEventListener('click', () => {
    const open = more.getAttribute('aria-expanded') !== 'true';
    setOpen(open);
    if (open) panel.querySelector<HTMLElement>('button')?.focus();
  });
  panel.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    setOpen(false);
    more.focus();
  });
  // Choosing a chip closes the panel. The category script applies the tag; the layout then pins that chip into the row.
  panel.addEventListener('click', (event) => {
    if (event.target instanceof Element && event.target.closest('button[data-tag]') !== null) setOpen(false);
  });

  let frame = 0;
  const relayout = (): void => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(layout);
  };
  window.addEventListener('resize', relayout);
  phone.addEventListener('change', relayout);
  // The webfont swaps in after first paint and changes the chip widths.
  void document.fonts?.ready.then(relayout);
  controller.onChange(layout);
  layout();
}
