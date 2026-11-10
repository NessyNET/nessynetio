// Hand-built SiteModel for the chrome tests (011): 3 published categories (a 4th, "other", is configured but not
// published, so it is absent from the model like the loader would leave it) and one bookmarks group.
import type { Category, Project, SiteModel, Whoami } from '../../src/lib/content/model.ts';

export const SITE_HOST = 'nessynet.io';

export function category(id: string, over: Partial<Category> = {}): Category {
  return {
    id,
    label: id.toUpperCase(),
    shortLabel: id.toUpperCase(),
    blurb: `${id} blurb. Second sentence.`,
    blurbFirstSentence: `${id} blurb.`,
    accent: 'blue',
    showEmpty: false,
    tags: [],
    projects: [],
    bookmarks: [],
    ...over,
  };
}

export function whoami(links: Whoami['links'] = { github: 'https://github.com/nessy', mail: 'hello@nessynet.io' }): Whoami {
  return { name: 'Nessy', tagline: null, taglinePlain: null, bio: 'Bio.', links };
}

export function siteModel(over: Partial<SiteModel> = {}): SiteModel {
  return {
    site: { url: `https://${SITE_HOST}`, host: SITE_HOST, description: 'Plugins, mods and small tools.' },
    whoami: whoami(),
    categories: [
      category('ffxiv', { label: 'Final Fantasy XIV', shortLabel: 'FFXIV', accent: 'blue' }),
      category('minecraft', { label: 'Minecraft', shortLabel: 'Minecraft', accent: 'orange' }),
      category('linux', { label: 'Linux', shortLabel: 'Linux tools', accent: 'yellow' }),
    ],
    projectsBySlug: new Map(),
    bookmarks: [],
    relations: [],
    updatesLog: [],
    paths: [],
    samples: [],
    ...over,
  };
}

/** Only the fields the chrome reads; the rest of a Project is irrelevant to it. */
export function project(categoryId: string, slug: string, name = slug, summary = `${slug} summary.`): Project {
  return { slug, name, categoryId, summary, path: `/${categoryId}/${slug}/` } as unknown as Project;
}
