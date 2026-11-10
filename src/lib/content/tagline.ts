// Tagline accent markup parser (ux 7.14, design 3.5.2). Build-time only, pure, linear in the input length.
import { TAGLINE_AUTO_CYCLE, isTaglineColour, type TaglineColour } from '../palette.ts';
import type { TaglineSegment } from './model.ts';

export interface TaglineIssue {
  readonly code: 'unclosed' | 'bad-colour' | 'empty' | 'too-many';
  /** Offset in the source of the `*` that opens the offending span. */
  readonly index: number;
  readonly detail: string;
}

export interface ParsedTagline {
  readonly segments: TaglineSegment[];
  readonly plain: string;
  readonly renderedLength: number;
  readonly issues: TaglineIssue[];
}

const MAX_ACCENTS = 3;
/** Longest `{colour}` suffix examined; keeps the closing-brace search bounded. */
const MAX_COLOUR_LENGTH = 16;

/** Reads the text of an accent span starting after the opening `*` at `open`; null when it never closes. */
function readSpan(src: string, open: number): { text: string; close: number } | null {
  let text = '';
  for (let i = open + 1; i < src.length; i++) {
    const ch = src[i];
    if (ch === '*') return { text, close: i };
    if (ch === '\\' && (src[i + 1] === '*' || src[i + 1] === '\\')) {
      text += src[i + 1];
      i++;
    } else {
      text += ch;
    }
  }
  return null;
}

/** Reads an optional `{colour}` directly after a span; `end` is the offset after it. */
function readColour(src: string, from: number): { name: string; end: number } | null {
  if (src[from] !== '{') return null;
  const limit = Math.min(src.length, from + MAX_COLOUR_LENGTH + 2);
  for (let i = from + 1; i < limit; i++) {
    if (src[i] === '}') return { name: src.slice(from + 1, i), end: i + 1 };
  }
  return null;
}

export function parseTagline(src: string): ParsedTagline {
  const segments: TaglineSegment[] = [];
  const issues: TaglineIssue[] = [];
  let plain = '';
  let pending = '';
  let accents = 0;
  let autoUsed = 0;

  const flush = (): void => {
    if (pending !== '') segments.push({ text: pending });
    pending = '';
  };

  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\\' && (src[i + 1] === '*' || src[i + 1] === '\\')) {
      pending += src[i + 1];
      plain += src[i + 1];
      i += 2;
      continue;
    }
    if (ch !== '*') {
      pending += ch;
      plain += ch;
      i++;
      continue;
    }

    const start = i;
    const span = readSpan(src, start);
    if (span === null) {
      issues.push({ code: 'unclosed', index: start, detail: 'unclosed `*`, rendered literally' });
      pending += ch;
      plain += ch;
      i++;
      continue;
    }
    if (span.text === '') {
      issues.push({ code: 'empty', index: start, detail: 'empty `**` removed' });
      i = span.close + 1;
      continue;
    }

    const suffix = readColour(src, span.close + 1);
    let explicit: TaglineColour | undefined;
    if (suffix !== null) {
      if (isTaglineColour(suffix.name)) {
        explicit = suffix.name;
      } else {
        issues.push({
          code: 'bad-colour',
          index: start,
          detail: `colour "${suffix.name}" is not allowed, using the automatic colour`,
        });
      }
    }
    i = suffix === null ? span.close + 1 : suffix.end;
    plain += span.text;

    if (accents >= MAX_ACCENTS) {
      issues.push({ code: 'too-many', index: start, detail: `more than ${MAX_ACCENTS} accents, rendered plain` });
      pending += span.text;
      continue;
    }
    accents++;
    // Only automatic spans advance the colour cycle; explicit colours leave it alone.
    const accent = explicit ?? TAGLINE_AUTO_CYCLE[autoUsed++ % TAGLINE_AUTO_CYCLE.length]!;
    flush();
    segments.push({ text: span.text, accent });
  }
  flush();

  return { segments, plain, renderedLength: Array.from(plain).length, issues };
}
