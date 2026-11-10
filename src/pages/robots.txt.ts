import type { APIRoute } from 'astro';
import { getSiteModel } from '../lib/content/index.ts';

export const GET: APIRoute = async () => {
  const { site } = await getSiteModel();
  const body = `User-agent: *\nAllow: /\n\nSitemap: ${site.url}/sitemap-index.xml\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
