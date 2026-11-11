// Backtick spans in owner-written install text (ux 4.3, 7.1): `code` is command text, a backslash before a backtick
// is a literal backtick, and nothing else is markup. An unclosed backtick stays as written and is reported.
import type { StepPart } from './strings.ts';

export interface InlineCode {
  readonly parts: readonly StepPart[];
  readonly unclosed: boolean;
}

/** Reads one run up to the next unescaped backtick from `from`; `end` is -1 when there is none. */
function readRun(text: string, from: number): { value: string; end: number } {
  let value = '';
  for (let i = from; i < text.length; i++) {
    if (text[i] === '\\' && text[i + 1] === '`') {
      value += '`';
      i++;
    } else if (text[i] === '`') {
      return { value, end: i };
    } else {
      value += text[i];
    }
  }
  return { value, end: -1 };
}

export function parseInlineCode(text: string): InlineCode {
  const parts: StepPart[] = [];
  let plain = '';
  let unclosed = false;
  const flush = (): void => {
    if (plain !== '') parts.push({ kind: 'text', text: plain });
    plain = '';
  };
  let at = 0;
  while (at < text.length) {
    const run = readRun(text, at);
    if (run.end === -1) {
      plain += run.value;
      break;
    }
    plain += run.value;
    const span = readRun(text, run.end + 1);
    if (span.end === -1) {
      // No closing backtick: the opening one and the rest are shown as written (escapes resolved).
      plain += '`' + span.value;
      unclosed = true;
      break;
    }
    if (span.value === '') {
      plain += '``';
    } else {
      flush();
      parts.push({ kind: 'code', text: span.value });
    }
    at = span.end + 1;
  }
  flush();
  return { parts, unclosed };
}
