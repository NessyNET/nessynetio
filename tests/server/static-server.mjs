#!/usr/bin/env node
// Local dev/e2e static server. Mimics the parts of the nginx contract the
// browser tests need (real 404 status with 404.html body, relative directory
// redirect, hidden files). No TLS, no headers contract, no compression: the
// authoritative server check is tests/server/check.sh against nginx.
import { createServer as createHttpServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, resolve, sep, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

const isHidden = (segments) =>
  segments.some((s) => s.startsWith('.') || s.endsWith('.map')) ||
  segments.join('/') === '404.html';

async function statOrNull(path) {
  try {
    return await stat(path);
  } catch {
    return null;
  }
}

export function createServer({ dir }) {
  const root = resolve(dir);
  const notFoundPage = join(root, '404.html');

  const sendFile = async (req, res, file, status) => {
    const info = await stat(file);
    res.writeHead(status, {
      'Content-Type': CONTENT_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'Content-Length': info.size,
      'Cache-Control': 'no-cache',
    });
    if (req.method === 'HEAD') return res.end();
    createReadStream(file).pipe(res);
  };

  const sendNotFound = async (req, res) => {
    if (await statOrNull(notFoundPage)) return sendFile(req, res, notFoundPage, 404);
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(req.method === 'HEAD' ? undefined : 'Not found\n');
  };

  const handle = async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' });
      return res.end();
    }
    const url = new URL(req.url ?? '/', 'http://localhost');
    let decoded;
    try {
      decoded = decodeURIComponent(url.pathname);
    } catch {
      return sendNotFound(req, res);
    }
    const segments = decoded.split('/').filter(Boolean);
    if (decoded.includes('\0') || segments.includes('..') || isHidden(segments)) {
      return sendNotFound(req, res);
    }

    const target = resolve(root, ...segments);
    if (target !== root && !target.startsWith(root + sep)) return sendNotFound(req, res);

    const info = await statOrNull(target);
    if (info?.isFile() && !decoded.endsWith('/')) return sendFile(req, res, target, 200);
    if (info?.isDirectory()) {
      if (!decoded.endsWith('/')) {
        res.writeHead(301, { Location: `${url.pathname}/${url.search}` });
        return res.end();
      }
      const index = join(target, 'index.html');
      if (await statOrNull(index)) return sendFile(req, res, index, 200);
    }
    return sendNotFound(req, res);
  };

  return createHttpServer((req, res) => {
    handle(req, res).catch(() => {
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({
    options: { dir: { type: 'string' }, port: { type: 'string', default: '4321' } },
  });
  if (!values.dir) {
    console.error('usage: static-server.mjs --dir <dist> --port <n>');
    process.exit(2);
  }
  const port = Number(values.port);
  createServer({ dir: values.dir }).listen(port, '127.0.0.1', () => {
    console.log(`static server: ${resolve(values.dir)} on http://127.0.0.1:${port}`);
  });
}
