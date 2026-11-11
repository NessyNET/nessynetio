import { parse } from 'smol-toml';
import { describe, expect, it } from 'vitest';
import type { Layout } from '../../src/lib/content/model.ts';
import { LAYOUTS, parseDetails, resolveLayout, webHost } from '../../src/lib/content/variants.ts';

const ctx = { file: 'content/projects/minecraft/peatmoss.toml', entry: 'peatmoss' };
const toml = (src: string): Record<string, unknown> => parse(src);

describe('resolveLayout', () => {
  it.each([
    ['plugin', 'plugin'],
    ['offline', 'offline'],
    ['web', 'web'],
    ['mod', 'mod'],
    ['modpack', 'modpack'],
    ['cli', 'tool'],
    ['tui', 'tool'],
    ['theme', 'tool'],
    ['bot', 'bot'],
  ] as const)('maps type tag %s to layout %s', (id, layout) => {
    expect(resolveLayout({ id })).toEqual({ layout, fellBack: false });
  });

  it('honours an explicit layout on a new tag id', () => {
    expect(resolveLayout({ id: 'datapack', layout: 'mod' })).toEqual({ layout: 'mod', fellBack: false });
  });

  it('lets an explicit layout override the default for a known id', () => {
    expect(resolveLayout({ id: 'cli', layout: 'generic' })).toEqual({ layout: 'generic', fellBack: false });
  });

  it('falls back to generic for an unknown id and says so', () => {
    expect(resolveLayout({ id: 'experiment' })).toEqual({ layout: 'generic', fellBack: true });
  });

  it('does not report a fallback for a null type tag', () => {
    expect(resolveLayout(null)).toEqual({ layout: 'generic', fellBack: false });
  });

  it('does not treat Object.prototype keys as type tags', () => {
    expect(resolveLayout({ id: 'constructor' })).toEqual({ layout: 'generic', fellBack: true });
  });
});

describe('LAYOUTS', () => {
  it('lists table, schema and requiresVersion per layout', () => {
    const summary = Object.fromEntries(
      Object.entries(LAYOUTS).map(([k, v]) => [k, [v.table, v.schema !== null, v.requiresVersion]]),
    );
    expect(summary).toEqual({
      plugin: ['ffxiv', true, true],
      offline: ['ffxiv', true, true],
      web: ['webtool', true, false],
      mod: ['minecraft', true, true],
      modpack: ['minecraft', true, true],
      tool: ['linux', true, true],
      bot: ['bot', true, true],
      generic: [null, false, true],
    });
  });
});

describe('parseDetails: valid tables', () => {
  it('parses plugin (project.html)', () => {
    const r = parseDetails('plugin', toml('[ffxiv]\nrequires = "Dalamud API 12"'), ctx);
    expect(r).toEqual({ details: { requires: 'Dalamud API 12' }, diagnostics: [], unknownKeys: [] });
  });

  it('parses offline with and without requires', () => {
    expect(parseDetails('offline', toml('[ffxiv]\nrequires = "Windows 10"'), ctx).details).toEqual({
      requires: 'Windows 10',
    });
    const none = parseDetails('offline', toml('[ffxiv]'), ctx);
    expect(none.details).toEqual({});
    expect(none.diagnostics).toEqual([]);
    expect(parseDetails('offline', {}, ctx).details).toEqual({});
  });

  it('parses web (webtool.html)', () => {
    const raw = toml('[webtool]\nruns_in = "any modern browser"\naccount = "none"\ndata = "stays in your browser"');
    expect(parseDetails('web', raw, ctx).details).toEqual({
      runsIn: 'any modern browser',
      account: 'none',
      data: 'stays in your browser',
    });
  });

  it('parses mod (mc-mod.html) and normalises dates', () => {
    const raw = toml(`
[minecraft]
loader = "Fabric"
game_versions = ["1.21", "1.21.1"]
side = "both"
files = [
  { game = "1.21.1", loader = "fabric 0.16+", file = "peatmoss-0.6.0+1.21.1.jar", date = 2026-10-05 },
  { game = "1.21.0", loader = "fabric 0.15+", file = "peatmoss-0.5.2+1.21.jar", date = "2026-06-12" },
]
dependencies = [
  { name = "Fabric API", url = "https://modrinth.com/mod/fabric-api", need = "required", why = "core hooks" },
  { name = "Mod Menu", need = "optional" },
]
`);
    const r = parseDetails('mod', raw, ctx);
    expect(r.diagnostics).toEqual([]);
    expect(r.unknownKeys).toEqual([]);
    expect(r.details).toEqual({
      loader: 'Fabric',
      gameVersions: ['1.21', '1.21.1'],
      side: 'both',
      files: [
        { game: '1.21.1', loader: 'fabric 0.16+', file: 'peatmoss-0.6.0+1.21.1.jar', date: '2026-10-05' },
        { game: '1.21.0', loader: 'fabric 0.15+', file: 'peatmoss-0.5.2+1.21.jar', date: '2026-06-12' },
      ],
      dependencies: [
        { name: 'Fabric API', url: 'https://modrinth.com/mod/fabric-api', need: 'required', why: 'core hooks' },
        { name: 'Mod Menu', need: 'optional' },
      ],
    });
  });

  it('defaults omitted arrays to [] on a mod', () => {
    const r = parseDetails('mod', toml('[minecraft]\nloader = "Fabric"\nside = "client"'), ctx);
    expect(r.details).toEqual({ loader: 'Fabric', gameVersions: [], side: 'client', files: [], dependencies: [] });
  });

  it('parses modpack (mc-modpack.html)', () => {
    const raw = toml(`
[minecraft]
loader = "Fabric 0.16"
game_versions = ["1.21.1"]
import_url = "https://modrinth.com/modpack/highland-pack"
launcher = "Prism Launcher"
memory_gb = 6
mods_total = 42
mods_url = "https://modrinth.com/modpack/highland-pack/version/1.4.0"
mods = [
  { name = "Peatmoss", version = "0.6.0", mine = true },
  { name = "Sodium", version = "0.6.x", url = "https://modrinth.com/mod/sodium", mine = false },
]
`);
    const r = parseDetails('modpack', raw, ctx);
    expect(r.diagnostics).toEqual([]);
    expect(r.details).toEqual({
      loader: 'Fabric 0.16',
      gameVersions: ['1.21.1'],
      importUrl: 'https://modrinth.com/modpack/highland-pack',
      launcher: 'Prism Launcher',
      memoryGb: 6,
      mods: [
        { name: 'Peatmoss', version: '0.6.0', mine: true },
        { name: 'Sodium', version: '0.6.x', url: 'https://modrinth.com/mod/sodium', mine: false },
      ],
      modsTotal: 42,
      modsUrl: 'https://modrinth.com/modpack/highland-pack/version/1.4.0',
    });
  });

  it('parses a modpack without optional keys and mods', () => {
    const raw = toml('[minecraft]\nloader = "Fabric"\nimport_url = "https://x.example/p"\nmemory_gb = 4\nmods_total = 0');
    expect(parseDetails('modpack', raw, ctx).details).toEqual({
      loader: 'Fabric',
      gameVersions: [],
      importUrl: 'https://x.example/p',
      memoryGb: 4,
      mods: [],
      modsTotal: 0,
    });
  });

  it('parses tool (linux-tool.html)', () => {
    const raw = toml(`
[linux]
language = "Rust"
needs = ["pacman", "systemd"]
install = [
  { method = "Arch Linux (AUR)", command = "yay -S lochctl", note = "Or any AUR helper: paru -S lochctl." },
  { method = "Any distro (cargo)", command = "cargo install lochctl" },
]
distros = [
  { name = "Arch, EndeavourOS, CachyOS", support = "supported", how = "AUR" },
  { name = "NixOS", support = "unsupported" },
]
[linux.usage]
synopsis = "lochctl [ check | update | rollback | status ] [ options ]"
commands = [{ name = "check", help = "show pending updates" }]
options = [{ flag = "-n, --dry-run", help = "print what would happen" }]
example = "lochctl check && lochctl update -y"
`);
    const r = parseDetails('tool', raw, ctx);
    expect(r.diagnostics).toEqual([]);
    expect(r.unknownKeys).toEqual([]);
    expect(r.details).toEqual({
      language: 'Rust',
      needs: ['pacman', 'systemd'],
      install: [
        { method: 'Arch Linux (AUR)', command: 'yay -S lochctl', note: 'Or any AUR helper: paru -S lochctl.' },
        { method: 'Any distro (cargo)', command: 'cargo install lochctl' },
      ],
      usage: {
        synopsis: 'lochctl [ check | update | rollback | status ] [ options ]',
        commands: [{ name: 'check', help: 'show pending updates' }],
        options: [{ flag: '-n, --dry-run', help: 'print what would happen' }],
        example: 'lochctl check && lochctl update -y',
      },
      distros: [
        { name: 'Arch, EndeavourOS, CachyOS', support: 'supported', how: 'AUR' },
        { name: 'NixOS', support: 'unsupported' },
      ],
    });
  });

  it('parses a manual install method: no command, steps and a note', () => {
    const raw = toml(`
[linux]
language = "JSON"
install = [
  { method = "VS Code", steps = ["Open Extensions.", "Search for Nessy."], note = "Restart the editor." },
  { method = "kitty", command = "kitty +kitten themes Nessy" },
]
[linux.usage]
synopsis = "x"
example = "x"
`);
    const r = parseDetails('tool', raw, ctx);
    expect(r.diagnostics).toEqual([]);
    expect(r.unknownKeys).toEqual([]);
    expect((r.details as { install: unknown }).install).toEqual([
      { method: 'VS Code', steps: ['Open Extensions.', 'Search for Nessy.'], note: 'Restart the editor.' },
      { method: 'kitty', command: 'kitty +kitten themes Nessy' },
    ]);
  });

  it('defaults omitted tool arrays, including usage.commands and usage.options', () => {
    const raw = toml('[linux]\nlanguage = "Go"\n[linux.usage]\nsynopsis = "x"\nexample = "x"');
    expect(parseDetails('tool', raw, ctx).details).toEqual({
      language: 'Go',
      needs: [],
      install: [],
      usage: { synopsis: 'x', commands: [], options: [], example: 'x' },
      distros: [],
    });
  });

  it('parses bot (other-bot.html)', () => {
    const raw = toml(`
[bot]
platform = "Discord"
hosting = "self-hosted"
invite = false
commands = [{ name = "/event new", help = "create an FC event", who = "officers" }]
`);
    expect(parseDetails('bot', raw, ctx).details).toEqual({
      platform: 'Discord',
      hosting: 'self-hosted',
      invite: false,
      commands: [{ name: '/event new', help: 'create an FC event', who: 'officers' }],
    });
  });

  it('returns no details for generic', () => {
    expect(parseDetails('generic', {}, ctx)).toEqual({ details: undefined, diagnostics: [], unknownKeys: [] });
  });
});

describe('parseDetails: errors', () => {
  it('reports a missing required key with its field path', () => {
    const r = parseDetails('plugin', toml('[ffxiv]'), ctx);
    expect(r.details).toBeUndefined();
    expect(r.diagnostics).toEqual([
      expect.objectContaining({
        code: 'details/shape',
        level: 'error',
        file: ctx.file,
        entry: ctx.entry,
        field: 'ffxiv.requires',
      }),
    ]);
  });

  it('reports a missing table when keys are required', () => {
    const r = parseDetails('web', {}, ctx);
    expect(r.diagnostics.map((d) => d.field).sort()).toEqual(['webtool.account', 'webtool.data', 'webtool.runs_in']);
  });

  it('reports a table that is not a table', () => {
    const r = parseDetails('plugin', { ffxiv: 'x' }, ctx);
    expect(r.diagnostics).toEqual([expect.objectContaining({ code: 'details/shape', field: 'ffxiv' })]);
  });

  it('reports a bad enum value', () => {
    const r = parseDetails('mod', toml('[minecraft]\nloader = "Fabric"\nside = "everywhere"'), ctx);
    expect(r.details).toBeUndefined();
    expect(r.diagnostics).toEqual([expect.objectContaining({ level: 'error', field: 'minecraft.side' })]);
  });

  it('reports nested errors with an indexed path', () => {
    const raw = toml(`
[minecraft]
loader = "Fabric"
side = "both"
files = [
  { game = "1.21", loader = "fabric", file = "a.jar", date = 2026-10-05 },
  { game = "1.21", loader = "fabric", file = "b.jar", date = "last Tuesday" },
]
dependencies = [{ name = "X", need = "maybe" }]
`);
    const fields = parseDetails('mod', raw, ctx).diagnostics.map((d) => d.field);
    expect(fields).toEqual(['minecraft.files[1].date', 'minecraft.dependencies[0].need']);
  });

  it('rejects an impossible calendar date', () => {
    const raw = toml(
      '[minecraft]\nloader = "F"\nside = "both"\nfiles = [{ game = "1", loader = "f", file = "a", date = "2026-02-31" }]',
    );
    expect(parseDetails('mod', raw, ctx).diagnostics.map((d) => d.field)).toEqual(['minecraft.files[0].date']);
  });

  it('reports a missing usage table on a tool', () => {
    const r = parseDetails('tool', toml('[linux]\nlanguage = "Rust"'), ctx);
    expect(r.diagnostics.map((d) => d.field)).toEqual(['linux.usage']);
  });

  it('reports a wrong value type', () => {
    const r = parseDetails('modpack', toml('[minecraft]\nloader = "F"\nimport_url = "u"\nmemory_gb = "six"\nmods_total = 1'), ctx);
    expect(r.diagnostics.map((d) => d.field)).toEqual(['minecraft.memory_gb']);
  });
});

describe('parseDetails: unknown keys and wrong tables', () => {
  it('returns an unknown key in the layout table, still parsing the rest', () => {
    const raw = toml('[minecraft]\nloader = "Fabric"\nside = "both"\ncolour = "red"');
    const r = parseDetails('mod', raw, ctx);
    expect(r.unknownKeys).toEqual(['minecraft.colour']);
    expect(r.diagnostics).toEqual([]);
    expect(r.details).toMatchObject({ loader: 'Fabric' });
    expect(r.details).not.toHaveProperty('colour');
  });

  it('returns unknown keys inside array entries and usage', () => {
    const raw = toml(`
[minecraft]
loader = "Fabric"
side = "both"
dependencies = [{ name = "X", need = "required", extra = 1 }]
`);
    expect(parseDetails('mod', raw, ctx).unknownKeys).toEqual(['minecraft.dependencies[0].extra']);
    const tool = toml('[linux]\nlanguage = "Go"\n[linux.usage]\nsynopsis = "x"\nexample = "x"\nman = "y"');
    expect(parseDetails('tool', tool, ctx).unknownKeys).toEqual(['linux.usage.man']);
  });

  it('keeps parsing dates after dropping an unknown key', () => {
    const raw = toml(
      '[minecraft]\nloader = "F"\nside = "both"\ncolour = "red"\nfiles = [{ game = "1", loader = "f", file = "a", date = 2026-10-05 }]',
    );
    const r = parseDetails('mod', raw, ctx);
    expect(r.unknownKeys).toEqual(['minecraft.colour']);
    expect(r.details).toMatchObject({ files: [{ date: '2026-10-05' }] });
  });

  it('reports a table for the wrong layout by table name', () => {
    const raw = toml('[ffxiv]\nrequires = "API 12"\n[linux]\nlanguage = "Rust"');
    const r = parseDetails('plugin', raw, ctx);
    expect(r.unknownKeys).toEqual(['linux']);
    expect(r.details).toEqual({ requires: 'API 12' });
  });

  it('reports a [ffxiv] table on a null-typed (generic) project', () => {
    const r = parseDetails('generic', toml('[ffxiv]\nrequires = "x"'), ctx);
    expect(r.unknownKeys).toEqual(['ffxiv']);
    expect(r.details).toBeUndefined();
    expect(r.diagnostics).toEqual([]);
  });

  it('ignores top-level keys that are not detail tables', () => {
    const raw = toml('slug = "x"\nname = "X"\n[ffxiv]\nrequires = "API 12"');
    expect(parseDetails('plugin', raw, ctx).unknownKeys).toEqual([]);
  });

  it.each(['plugin', 'offline', 'web', 'mod', 'modpack', 'tool', 'bot'] as const satisfies readonly Layout[])(
    'reports no stray table for %s when only its own table is present',
    (layout) => {
      const table = LAYOUTS[layout].table!;
      expect(parseDetails(layout, { [table]: {} }, ctx).unknownKeys).toEqual([]);
    },
  );
});

describe('webHost', () => {
  it('picks the host of the first external get url', () => {
    expect(
      webHost([
        { kind: 'download', url: 'https://example.com/a.zip' },
        { kind: 'external', url: 'https://gear.nessynet.io/' },
        { kind: 'external', url: 'https://other.example/' },
      ]),
    ).toBe('gear.nessynet.io');
  });

  it('is undefined without an external url', () => {
    expect(webHost([{ kind: 'install' }, { kind: 'none' }])).toBeUndefined();
    expect(webHost([{ kind: 'external' }])).toBeUndefined();
    expect(webHost([{ kind: 'external', url: 'not a url' }])).toBeUndefined();
  });

  it('keeps a port in the host', () => {
    expect(webHost([{ kind: 'external', url: 'http://localhost:4321/x' }])).toBe('localhost:4321');
  });
});
