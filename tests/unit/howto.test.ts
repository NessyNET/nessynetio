// The owner how-to (content/README.md quick-start, content/REFERENCE.md field tables) documents every
// content key (design 8.3, brief R4). Field-reference tables in REFERENCE.md are found by their heading, "#### `<table id>`", and hold one row per
// key: "| `key` | required|optional | notes |". They are compared with the zod schemas.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ZodType } from 'zod';
import {
  bookmarkSchema,
  categorySchema,
  groupSchema,
  projectSchema,
  relationSchema,
  siteSectionSchema,
  tagSchema,
  whoamiSchema,
} from '../../src/lib/content/schema.ts';
import { LAYOUTS } from '../../src/lib/content/variants.ts';

const README = readFileSync(new URL('../../content/README.md', import.meta.url), 'utf8');
const REFERENCE = readFileSync(new URL('../../content/REFERENCE.md', import.meta.url), 'utf8');

type Shape = Record<string, ZodType>;
interface Def {
  type: string;
  innerType?: ZodType;
  in?: ZodType;
  element?: ZodType;
  shape?: Shape;
}
const def = (schema: ZodType): Def => (schema as unknown as { _def: Def })._def;

/** Peels optional/default wrappers, transform pipes and array elements until an object schema (or a leaf) is reached. */
function objectShape(schema: ZodType): Shape | undefined {
  const d = def(schema);
  if ((d.type === 'optional' || d.type === 'default') && d.innerType) return objectShape(d.innerType);
  if (d.type === 'pipe' && d.in) return objectShape(d.in);
  if (d.type === 'array' && d.element) return objectShape(d.element);
  return d.type === 'object' ? d.shape : undefined;
}

/** table id -> { key -> required }, with nested objects and arrays of objects as `<id>.<key>` tables. */
function tablesOf(id: string, shape: Shape, skip: ReadonlySet<string> = new Set()): Map<string, Map<string, boolean>> {
  const out = new Map<string, Map<string, boolean>>();
  const keys = new Map<string, boolean>();
  out.set(id, keys);
  for (const [key, schema] of Object.entries(shape)) {
    // A key is optional when `undefined` is a valid value (optional and default wrappers).
    keys.set(key, !schema.safeParse(undefined).success);
    const nested = skip.has(key) ? undefined : objectShape(schema);
    if (nested) for (const [k, v] of tablesOf(`${id}.${key}`, nested)) out.set(k, v);
  }
  return out;
}

const DETAIL_TABLES = new Set(['ffxiv', 'webtool', 'minecraft', 'linux', 'bot']);

const expected = new Map<string, Map<string, boolean>>([
  ...tablesOf('site', objectShape(siteSectionSchema)!),
  ...tablesOf('whoami', objectShape(whoamiSchema)!),
  ...tablesOf('category', objectShape(categorySchema)!, new Set(['tags'])),
  ...tablesOf('tag', objectShape(tagSchema)!),
  ...tablesOf('project', objectShape(projectSchema)!, DETAIL_TABLES),
  ...tablesOf('relation', objectShape(relationSchema)!),
  ...tablesOf('group', objectShape(groupSchema)!),
  ...tablesOf('bookmark', objectShape(bookmarkSchema)!),
  // `generic` has no detail table.
  ...Object.entries(LAYOUTS).flatMap(([layout, spec]) =>
    spec.schema ? [...tablesOf(`layout.${layout}`, objectShape(spec.schema as ZodType)!)] : [],
  ),
]);

/** Parses every "#### `id`" heading and the table rows before the next heading into id -> { key -> required }. */
function documentedTables(text: string): Map<string, Map<string, boolean>> {
  const out = new Map<string, Map<string, boolean>>();
  let rows: Map<string, boolean> | undefined;
  for (const line of text.split('\n')) {
    if (/^#{1,6}\s/.test(line)) {
      const id = /^####\s+`([^`]+)`/.exec(line)?.[1];
      rows = id === undefined ? undefined : new Map();
      if (id !== undefined && rows) out.set(id, rows);
      continue;
    }
    const row = /^\|\s*`([^`]+)`\s*\|\s*(required|optional)\s*\|/.exec(line);
    if (rows && row?.[1] !== undefined) rows.set(row[1], row[2] === 'required');
  }
  return out;
}

describe('content/README.md', () => {
  const documented = documentedTables(REFERENCE);

  it('has the ten numbered sections of design 8.3, in order', () => {
    const headings = [...README.matchAll(/^##\s+(\d+)\.\s/gm)].map((m) => Number(m[1]));
    expect(headings).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('links to the field reference and keeps the quick-start short', () => {
    expect(README).toContain('](REFERENCE.md)');
    expect(README.split('\n').length).toBeLessThanOrEqual(130);
  });

  it('documents exactly the schema tables', () => {
    expect([...documented.keys()].sort()).toEqual([...expected.keys()].sort());
  });

  for (const [id, keys] of expected) {
    it(`table ${id} lists exactly the schema keys, with their required flags`, () => {
      const rows = documented.get(id) ?? new Map<string, boolean>();
      const missing = [...keys.keys()].filter((k) => !rows.has(k));
      const extra = [...rows.keys()].filter((k) => !keys.has(k));
      const wrongFlag = [...keys].filter(([k, req]) => rows.has(k) && rows.get(k) !== req).map(([k]) => k);
      expect({ missing, extra, wrongFlag }).toEqual({ missing: [], extra: [], wrongFlag: [] });
    });
  }
});
