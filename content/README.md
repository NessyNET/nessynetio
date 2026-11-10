# Owner how-to

Everything you change lives in this folder. Edit, then push to `main`. Examples below are in the sample files; copy one rather than starting from nothing.

## 1. Where things live

```
content/
  site.toml          site url, description, the whoami block
  categories.toml    categories and their tags
  bookmarks.toml     relations, groups, bookmarks
  projects/<category>/<slug>.toml     one file per project
  projects/<category>/<slug>/         that project's screenshots
  schema/            editor help, generated; do not edit
```

Edit nothing outside `content/`. With the Even Better TOML editor extension the `#:schema` line at the top of each file gives completion and red squiggles.

## 2. Commands and publishing

| Command | What it does |
|---|---|
| `npm run dev` | Live preview with warnings in the terminal. |
| `npm run samples` | Lists every placeholder still in the content. `0 sample items` means ready. |
| `npm run build -- --strict` | What deploy runs. Warnings become errors and placeholders are refused. |

Publish by pushing to `main`; CI checks the site and deploys it. Roll back from the GitHub Actions page: run the deploy workflow with action `rollback`.

## 3. Add a project

1. Copy a sample of the same layout to `projects/<category>/<slug>.toml`: plugin `ffxiv/heather-hotbar`, web tool `ffxiv/gorse-gearplanner`, offline tool `ffxiv/peat-fishing-log`, mod `minecraft/peatmoss`, modpack `minecraft/highland-pack`, Linux tool `linux/lochctl`, bot `other/ripple-bot`.
2. Set `slug` to the filename without `.toml` (lowercase letters, digits, single `-`); `slug` is unique across the whole site. The folder must be the `category`.
3. Fill the required fields (section 4, REFERENCE.md). `summary` is one sentence; `priority` orders the list (section 6).
4. Put screenshots in `projects/<category>/<slug>/` and list each under `[[screenshots]]` with a `file` and a `caption` (the caption is also the alt text). Sources wider than 3000 px give a warning.
5. Replace every copied `[[screenshots]]` entry with your own images, or delete the entries. Delete `sample = true` and every `[sample]` in the text.
6. Run `npm run dev` and read the warnings.

## 4. Field reference

Every key, with required or optional and its limits, is in [REFERENCE.md](REFERENCE.md). Unknown keys give a warning (an error under `--strict`).

## 5. Add a tag

Append `{ id = "...", description = "..." }` to that category's `tags` in `categories.toml`. The order of the list is the order of the chips. Ids use lowercase letters, digits and single `-`, and appear once per category. A type tag has `type = true`; every project has exactly one. Its layout comes from the id (`plugin`, `offline`, `web`, `mod`, `modpack`, `bot`; `cli`, `tui` and `theme` use `tool`). For any other id add `layout = "..."`, or the page uses the plain `generic` layout (a NOTE). A project tag that is not in its category is not shown; strict refuses it.

## 6. Priorities

`priority` is a whole number; lower comes first in the default order. Retired projects always come after active ones. Leave gaps (10, 20, 30) so you can insert later.

## 7. Add a bookmark

Add a `[[bookmark]]` to `bookmarks.toml` with `name`, `url`, `note` and a `relation` from the legend. Set `category` to list it under a category, `group` for a free group, or neither for the general list; if you set both, `category` wins. List project slugs in `projects` to show it as "see also" on those pages. A new relation or group goes in `[[relation]]` or `[[group]]` first.

## 8. Notices and wording

Voice: first person, plain and calm. No apology, no words like "unavailable" or "N/A". A notice is a fixed label plus at most 2 sentences (about 30 words): the fact first, then what the visitor can do instead.

| `notice.kind` | Label shown | Template for `text` |
|---|---|---|
| `local` | `local only:` | {Name} runs only on my machine{, against ...}. It is here to show the work, not to download. |
| `private` | `private {what}:` | {Name} runs only on {where}. It is here to show the work; ask me if you want something similar. |
| `retired` | `retired:` | Start with the reason: "{one reason}. {The source stays up for reference / Use {alternative} instead.}" The page adds `Retired on {date}.` from `date`; do not write the date. |
| `separate` | `separate site:` | {Name} runs on {host} and opens in a new tab. {Nothing to install; what happens to data.} |
| `caution` (not a notice) | `warn:` | {risk in one clause}. {what to do}. |

What each `get.kind` shows:

| `kind` | Shows |
|---|---|
| `install` | `see install`; plugins also get the repo URL steps (needs the category `repo_url`), tools show their install methods. |
| `external` | A link to another site, marked with an arrow and "opens in new tab". Web tools show `Open tool: {host}`. |
| `download` | A `download` link to `url`. |
| `none` | `Not distributed (local only)`, `(private ...)` or `No longer distributed`, chosen by the notice. Needs a `notice`. |

## 9. Reading build messages

Lines read `LEVEL file [entry] field: message`.

| Level | Meaning |
|---|---|
| `ERROR` | Wrong or missing data. The build stops. |
| `WARNING` | Something is dropped or odd. Fine while editing; under `--strict` most become errors. |
| `NOTE` | For your information; never blocks. |

`--strict` also refuses anything marked `sample`. The three fixes you will meet most:

1. `tag 'x' is not defined in category 'y'`: add the tag to the category (section 5), or fix the spelling.
2. `install entry needs repo_url ...` or `... needs at least one install method ...`: set the category `repo_url` (only once the manifest exists), add a `[[linux.install]]`, or remove the `install` entry.
3. `required field` or `unknown key`: compare the key with the tables in REFERENCE.md; check spelling and that the key sits in the right table.

## 10. Launch checklist

- [ ] `npm run samples` prints `0 sample items`.
- [ ] Read by eye what `samples` cannot see: relation descriptions, group labels, tag descriptions, screenshot captions and changelog items have no `[sample]` marker or flag.
- [ ] The `release-readiness` job on `main` is green.
- [ ] Set a category's `repo_url` only once the manifest exists at that address.
- [ ] Set the repository variable `DEPLOY_ENABLED` to `true`.
- [ ] After the first deploy, paste three project URLs into Discord and check the previews.
