// External-link classifier (design 3.5.2, ux 7.15). The build decides externality; authors never mark links.

export type LinkKind = 'internal' | 'external' | 'mailto' | 'fragment';

const SCHEME = /^([a-z][a-z0-9+.-]*):/i;

/** Lower-cased host name with any port removed. */
const bareHost = (host: string): string => host.replace(/:\d+$/, '').toLowerCase();

/**
 * @throws on a malformed absolute URL or a scheme other than http(s)/mailto: those are validator bugs, not content.
 */
export function classifyHref(href: string, siteHost: string): LinkKind {
  if (href.startsWith('#')) return 'fragment';
  const scheme = SCHEME.exec(href)?.[1]?.toLowerCase();
  if (scheme === 'mailto') return 'mailto';
  if (scheme === undefined && !href.startsWith('//')) return 'internal';
  if (scheme !== undefined && scheme !== 'http' && scheme !== 'https') {
    throw new Error(`Unsupported URL scheme "${scheme}:" in href "${href}"`);
  }
  let url: URL;
  try {
    url = new URL(scheme === undefined ? `https:${href}` : href);
  } catch {
    throw new Error(`Malformed URL "${href}"`);
  }
  return url.hostname === bareHost(siteHost) ? 'internal' : 'external';
}

/** Host (with a non-default port) of an absolute or protocol-relative URL, else null. */
export function hostOf(url: string): string | null {
  if (!/^(https?:)?\/\//i.test(url)) return null;
  try {
    return new URL(url.startsWith('//') ? `https:${url}` : url).host;
  } catch {
    return null;
  }
}
