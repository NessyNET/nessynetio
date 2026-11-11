// Backtick spans in owner-written install text (ux 4.3, 7.1): `code` becomes a code part, a backslash before a
// backtick is a literal backtick, and an unclosed backtick is reported and kept as written.
import { describe, expect, it } from 'vitest';
import { parseInlineCode } from '../../src/lib/inline-code.ts';

const t = (text: string) => ({ kind: 'text', text });
const c = (text: string) => ({ kind: 'code', text });

describe('parseInlineCode', () => {
  it('returns plain text as one part', () => {
    expect(parseInlineCode('Restart the editor.')).toEqual({ parts: [t('Restart the editor.')], unclosed: false });
  });

  it('turns text between backticks into code parts, in order', () => {
    expect(parseInlineCode('Copy `dist/vscode` to `~/.vscode/extensions`.')).toEqual({
      parts: [t('Copy '), c('dist/vscode'), t(' to '), c('~/.vscode/extensions'), t('.')],
      unclosed: false,
    });
  });

  it('reads a backslash-backtick as a literal backtick, inside or outside code', () => {
    expect(parseInlineCode('Type \\` first').parts).toEqual([t('Type ` first')]);
    expect(parseInlineCode('Run `echo \\`date\\``').parts).toEqual([t('Run '), c('echo `date`')]);
  });

  it('keeps other backslashes as written', () => {
    expect(parseInlineCode('C:\\Users\\me').parts).toEqual([t('C:\\Users\\me')]);
  });

  it('flags an unclosed backtick and keeps it and the rest as plain text', () => {
    expect(parseInlineCode('Copy the `dist folder.')).toEqual({ parts: [t('Copy the `dist folder.')], unclosed: true });
    expect(parseInlineCode('A `ok` then `open')).toEqual({ parts: [t('A '), c('ok'), t(' then `open')], unclosed: true });
  });

  it('passes markup through as text, for the template to escape', () => {
    expect(parseInlineCode('<b>`<i>`</b>').parts).toEqual([t('<b>'), c('<i>'), t('</b>')]);
  });

  it('keeps an empty pair of backticks as text', () => {
    expect(parseInlineCode('a `` b')).toEqual({ parts: [t('a `` b')], unclosed: false });
  });
});
