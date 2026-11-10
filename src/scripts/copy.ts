// Copy buttons (ux 7.16). One delegated click handler for every `button[data-copy]` on the page.
// `handleCopy` holds the behaviour against an abstract target and injected effects, so it runs without a DOM.
import { COPIED_ANNOUNCEMENT, COPIED_LABEL, COPY_FAILED_ANNOUNCEMENT, COPY_FAILED_LABEL, COPY_LABEL } from '../lib/strings.ts';
import { announce } from './announce.ts';

const RESET_MS = 2000;

export interface CopyTarget {
  /** Exact text to put on the clipboard. */
  value: string;
  /** Pending reset timer; owned by `handleCopy` so a second click restarts the window. */
  timer: unknown;
  showLabel(text: string): void;
  showState(state: 'copied' | 'failed' | null): void;
  /** Select the visible text so the user can copy it by hand. */
  selectText(): void;
}

export interface CopyDeps {
  /** Absent when the browser has no Clipboard API. */
  writeText: ((text: string) => Promise<void>) | undefined;
  announce(message: string): void;
  setTimer(fn: () => void, ms: number): unknown;
  clearTimer(id: unknown): void;
}

export async function handleCopy(target: CopyTarget, deps: CopyDeps): Promise<void> {
  let copied = true;
  try {
    if (deps.writeText === undefined) throw new Error('no clipboard');
    await deps.writeText(target.value);
  } catch {
    copied = false;
    target.selectText();
  }
  target.showLabel(copied ? COPIED_LABEL : COPY_FAILED_LABEL);
  target.showState(copied ? 'copied' : 'failed');
  deps.announce(copied ? COPIED_ANNOUNCEMENT : COPY_FAILED_ANNOUNCEMENT);
  if (target.timer !== undefined) deps.clearTimer(target.timer);
  target.timer = deps.setTimer(() => {
    target.timer = undefined;
    target.showLabel(COPY_LABEL);
    target.showState(null);
  }, RESET_MS);
}

const timers = new WeakMap<HTMLElement, unknown>();

function domTarget(button: HTMLButtonElement, doc: Document): CopyTarget {
  const label = button.querySelector('[data-label]') ?? button;
  const code = button.closest('.copyrow')?.querySelector('code') ?? null;
  return {
    value: button.dataset['copy'] ?? '',
    get timer() {
      return timers.get(button);
    },
    set timer(id: unknown) {
      timers.set(button, id);
    },
    showLabel: (text) => {
      label.textContent = text;
    },
    showState: (state) => {
      if (state === null) delete button.dataset['state'];
      else button.dataset['state'] = state;
    },
    selectText: () => {
      if (code === null) return;
      const selection = doc.getSelection();
      if (selection === null) return;
      selection.selectAllChildren(code);
    },
  };
}

function attach(doc: Document): void {
  const deps: CopyDeps = {
    writeText: typeof navigator.clipboard?.writeText === 'function' ? (text) => navigator.clipboard.writeText(text) : undefined,
    announce: (message) => announce(message, doc),
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
  };
  doc.addEventListener('click', (event) => {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>('button[data-copy]');
    if (button === null || button === undefined) return;
    void handleCopy(domTarget(button, doc), deps);
  });
}

if (typeof document !== 'undefined') attach(document);
