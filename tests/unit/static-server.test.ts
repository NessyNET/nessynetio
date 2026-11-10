import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer } from '../server/static-server.mjs';

const fixtureDir = fileURLToPath(new URL('../server/fixture-dist', import.meta.url));

let server: Server;
let base: string;

// redirect: 'manual' keeps 301s visible. fetch normalises a literal "/../", so
// the traversal cases also use percent-encoded dots and slashes.
const get = (path: string) => fetch(base + path, { redirect: 'manual' });

beforeAll(async () => {
  server = createServer({ dir: fixtureDir });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe('static server', () => {
  it('serves / as html with status 200', async () => {
    const res = await get('/');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(await res.text()).toContain('fixture-home');
  });

  it('redirects a directory without trailing slash, relative Location', async () => {
    const res = await get('/ffxiv');
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('/ffxiv/');
  });

  it('preserves the query string on the directory redirect', async () => {
    const res = await get('/ffxiv?tag=x');
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('/ffxiv/?tag=x');
  });

  it('serves a directory index with a trailing slash', async () => {
    const res = await get('/ffxiv/');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('fixture-ffxiv');
  });

  it('answers unknown paths with status 404 and the 404.html body', async () => {
    const res = await get('/__nope__/');
    expect(res.status).toBe(404);
    expect(await res.text()).toContain('fixture-404');
  });

  it('answers /404.html directly with status 404', async () => {
    const res = await get('/404.html');
    expect(res.status).toBe(404);
    expect(await res.text()).toContain('fixture-404');
  });

  it.each(['/.build-meta.json', '/.hidden', '/_astro/x.js.map'])('hides %s', async (path) => {
    expect((await get(path)).status).toBe(404);
  });

  it.each(['/../etc/passwd', '/%2e%2e/etc/passwd', '/..%2fetc%2fpasswd', '/%00'])(
    'rejects traversal and malformed path %s',
    async (path) => {
      expect((await get(path)).status).toBe(404);
    },
  );

  it.each([
    ['/og/x.png', 'image/png'],
    ['/_astro/x.js', 'text/javascript'],
  ])('sends Content-Type for %s', async (path, type) => {
    const res = await get(path);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain(type);
  });

  it('serves HEAD without a body', async () => {
    const res = await fetch(base + '/', { method: 'HEAD' });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('');
  });
});
