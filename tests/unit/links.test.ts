import { describe, expect, it } from 'vitest';
import { classifyHref, hostOf } from '../../src/lib/links.ts';

const SITE = 'nessynet.io';

describe('classifyHref', () => {
  it.each([
    ['#install', 'fragment'],
    ['mailto:a@b', 'mailto'],
    ['MAILTO:a@b', 'mailto'],
    ['/ffxiv/', 'internal'],
    ['ffxiv/loch-lantern/', 'internal'],
    ['/ffxiv/?tag=plugin', 'internal'],
    ['https://nessynet.io/x', 'internal'],
    ['http://nessynet.io/x', 'internal'],
    ['https://NESSYNET.IO:443/', 'internal'],
    ['https://nessynet.io:8443/', 'internal'],
    ['https://gear.nessynet.io/', 'external'],
    ['https://repo.nessynet.io/repo.json', 'external'],
    ['https://www.nessynet.io/', 'external'],
    ['https://github.com/nessy', 'external'],
    ['https://nessynet.io.evil.example/', 'external'],
    ['//example.com/', 'external'],
    ['//nessynet.io/x', 'internal'],
  ])('%s -> %s', (href, expected) => {
    expect(classifyHref(href, SITE)).toBe(expected);
  });

  it('ignores case and port in the site host', () => {
    expect(classifyHref('https://nessynet.io/', 'NessyNet.io:4321')).toBe('internal');
  });

  it('throws on a malformed absolute URL', () => {
    expect(() => classifyHref('https://exa mple', SITE)).toThrow(/https:\/\/exa mple/);
  });

  it('throws on an unsupported scheme rather than guessing', () => {
    expect(() => classifyHref('javascript:alert(1)', SITE)).toThrow(/scheme/);
    expect(() => classifyHref('tel:+123', SITE)).toThrow(/scheme/);
  });
});

describe('hostOf', () => {
  it('returns the lower-case host of an absolute URL', () => {
    expect(hostOf('https://GitHub.com/goatcorp/Dalamud')).toBe('github.com');
    expect(hostOf('https://gear.nessynet.io')).toBe('gear.nessynet.io');
  });

  it('keeps a non-default port', () => {
    expect(hostOf('http://localhost:4321/x')).toBe('localhost:4321');
  });

  it('handles protocol-relative URLs', () => {
    expect(hostOf('//example.com/a')).toBe('example.com');
  });

  it('returns null when there is no host', () => {
    expect(hostOf('/ffxiv/')).toBeNull();
    expect(hostOf('#install')).toBeNull();
    expect(hostOf('mailto:a@b')).toBeNull();
    expect(hostOf('https://exa mple')).toBeNull();
  });
});
