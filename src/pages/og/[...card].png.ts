import type { APIRoute, GetStaticPaths } from 'astro';
import { getSiteModel, optionsFromEnv } from '../../lib/content/index.ts';
import { renderCard } from '../../og/card.ts';
import { ogInputsFor, ogPathFor, readScreenshot } from '../../og/inputs.ts';
import type { OgCardInput } from '../../og/types.ts';

interface Props {
  input: OgCardInput;
}

export const getStaticPaths: GetStaticPaths = async () => {
  const model = await getSiteModel();
  const { dir } = optionsFromEnv();
  return [...ogInputsFor(model)].map(([pagePath, input]) => ({
    params: { card: ogPathFor(pagePath, input, dir).replace(/^\/og\//, '').replace(/\.png$/, '') },
    props: { input } satisfies Props,
  }));
};

export const GET: APIRoute = async ({ props }) => {
  const { input } = props as Props;
  const png = await renderCard(input, readScreenshot(input, optionsFromEnv().dir));
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
