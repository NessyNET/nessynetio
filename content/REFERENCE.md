# Field reference

Every key of every content file, with required or optional. Part of the owner how-to: see [README.md](README.md).

Every key is listed. Unknown keys give a warning (an error under `--strict`). Dates are `YYYY-MM-DD`. URLs are absolute `https://` (or `http://`).

#### `site`
`[site]` in `site.toml`.

| Key | Need | Notes |
|---|---|---|
| `url` | required | The site origin, `https://` only. |
| `description` | required | Link-preview text. |

#### `whoami`
`[whoami]` in `site.toml`.

| Key | Need | Notes |
|---|---|---|
| `name` | required | At most 24 characters. |
| `tagline` | optional | At most 80 characters as shown (the markup is not counted). `*words*{colour}` marks a coloured word; up to 5 per tagline, more show plain. Without `{colour}` the colour follows the word's position: green, yellow, cyan, pink, purple. |
| `bio` | required | 1 to 3 sentences, at most 280 characters. |
| `sample` | optional | `true` for placeholder; remove when real. |
| `links` | optional | See the next table. |

#### `whoami.links`
`[whoami.links]`.

| Key | Need | Notes |
|---|---|---|
| `github` | optional | Profile URL. |
| `mail` | optional | Bare address, no `mailto:`. |

#### `category`
`[[category]]` in `categories.toml`.

| Key | Need | Notes |
|---|---|---|
| `id` | required | Lowercase letters, digits, single `-`. Not `bookmarks`, `og`, `fonts`, `licenses`, `404`, `_astro`. |
| `label` | required | Full name. |
| `short_label` | optional | Shorter name for tight spaces. |
| `blurb` | required | One or two sentences; the first is shown on the home page. |
| `accent` | required | `blue`, `orange`, `yellow`, `purple`, `cyan`, `teal` or `pink`. |
| `show_empty` | optional | `true` publishes the category with no projects. |
| `repo_url` | optional | Dalamud custom repo URL, `https://`, not on this site. Needed for plugin `install` entries. |
| `sample` | optional | `true` for placeholder. |
| `tags` | required | List of tags; see the next table. |

#### `tag`
Inside a category's `tags`.

| Key | Need | Notes |
|---|---|---|
| `id` | required | Lowercase letters, digits, single `-`; once per category. |
| `label` | optional | Display name (type tags, e.g. `web tool`). |
| `description` | optional | Shown on hover and in the tag list. |
| `type` | optional | `true` for a type tag. |
| `layout` | optional | Type tags only: `plugin`, `offline`, `web`, `mod`, `modpack`, `tool`, `bot` or `generic`. |

#### `project`
Top of every project file.

| Key | Need | Notes |
|---|---|---|
| `slug` | required | Equals the filename. |
| `name` | required | Display name. |
| `category` | required | A category `id`; equals the folder. |
| `status` | required | `active` or `retired`. |
| `summary` | required | One sentence, about 90 characters. |
| `priority` | required | Whole number; lower is first. |
| `updated` | required | Date of the last change. |
| `description` | required | 1 to 3 short paragraphs. |
| `tags` | required | One type tag plus up to 3 others, from the category. |
| `version` | optional | Required on every layout except `web`. |
| `licence` | optional | Row hidden if absent. |
| `issues` | optional | Issue tracker URL. |
| `changelog_url` | optional | Link to the full changelog. |
| `source` | optional | Without it the page says `Source not available`. |
| `get` | required | At least one entry; see `project.get`. |
| `notice` | optional | Required when `status = "retired"` or a `get` is `none`. |
| `caution` | optional | Text of the `warn:` note in the plugin install steps. |
| `screenshots` | optional | Each needs a caption. |
| `changelog` | optional | Newest first. |
| `sample` | optional | `true` for placeholder. |
| `ffxiv` | optional | Layout table for `plugin` and `offline`. |
| `webtool` | optional | Layout table for `web`. |
| `minecraft` | optional | Layout table for `mod` and `modpack`. |
| `linux` | optional | Layout table for `tool`. |
| `bot` | optional | Layout table for `bot`. |

#### `project.source`
`source = { host = "GitHub", url = "..." }`.

| Key | Need | Notes |
|---|---|---|
| `host` | required | Name shown, e.g. `GitHub`. |
| `url` | required | Repository URL. |

#### `project.get`
`[[get]]`, one per way to get it.

| Key | Need | Notes |
|---|---|---|
| `kind` | required | `install`, `external`, `download` or `none`; see section 8. `none` must be the only entry. |
| `label` | optional | Link text; 2 to 4 words, sentence case. |
| `url` | optional | Needed for `external` and `download`; a path starting `/` is allowed here. |

#### `project.notice`
`[notice]`; wording in section 8.

| Key | Need | Notes |
|---|---|---|
| `kind` | required | `local`, `private`, `retired` or `separate`. |
| `text` | required | At most 2 sentences, about 30 words. |
| `date` | optional | Required for `retired`. |
| `what` | optional | For `private`: the thing, e.g. `bot` gives `private bot`. |

#### `project.screenshots`
`[[screenshots]]`.

| Key | Need | Notes |
|---|---|---|
| `file` | required | File name inside `projects/<category>/<slug>/`. |
| `caption` | required | Also the alt text. |

#### `project.changelog`
`[[changelog]]`, newest first.

| Key | Need | Notes |
|---|---|---|
| `version` | required | Version label. |
| `date` | required | Release date. |
| `items` | required | List of short lines. |

#### `layout.plugin`
`[ffxiv]` for a Dalamud plugin (`plugin`).

| Key | Need | Notes |
|---|---|---|
| `requires` | required | e.g. `Dalamud API 12`. |

#### `layout.offline`
`[ffxiv]` for a desktop app or script (`offline`).

| Key | Need | Notes |
|---|---|---|
| `requires` | optional | What the user needs first. |

#### `layout.web`
`[webtool]` for a browser tool (`web`). The host shown comes from the `external` get URL.

| Key | Need | Notes |
|---|---|---|
| `runs_in` | required | e.g. `any modern browser`. |
| `account` | required | e.g. `none`. |
| `data` | required | What happens to the user's data. |

#### `layout.mod`
`[minecraft]` for a single mod (`mod`).

| Key | Need | Notes |
|---|---|---|
| `loader` | required | e.g. `Fabric`; shown as written. |
| `game_versions` | optional | List, e.g. `["1.21.4"]`. |
| `side` | required | `client`, `server` or `both`. |
| `files` | optional | `[[minecraft.files]]` downloads. |
| `dependencies` | optional | `[[minecraft.dependencies]]`. |

#### `layout.mod.files`
`[[minecraft.files]]`.

| Key | Need | Notes |
|---|---|---|
| `game` | required | Game version. |
| `loader` | required | Loader name. |
| `file` | required | File name. |
| `date` | required | Release date. |

#### `layout.mod.dependencies`
`[[minecraft.dependencies]]`.

| Key | Need | Notes |
|---|---|---|
| `name` | required | Mod name. |
| `url` | optional | Where to get it. |
| `need` | required | `required` or `optional`. |
| `why` | optional | One short reason. |

#### `layout.modpack`
`[minecraft]` for a modpack (`modpack`).

| Key | Need | Notes |
|---|---|---|
| `loader` | required | Loader name. |
| `game_versions` | optional | List. |
| `import_url` | required | Launcher import link (copyable). |
| `launcher` | optional | Launcher name. |
| `memory_gb` | required | Recommended RAM, above 0. |
| `mods` | optional | `[[minecraft.mods]]`; the first 5 are shown. |
| `mods_total` | required | Whole number, for "N of M". |
| `mods_url` | optional | Link to the full list. |

#### `layout.modpack.mods`
`[[minecraft.mods]]`.

| Key | Need | Notes |
|---|---|---|
| `name` | required | Exactly the project name if it is yours. |
| `version` | optional | Version label. |
| `url` | optional | Link. |
| `mine` | required | `true` for your own mods (links to its page). |

#### `layout.tool`
`[linux]` for a command-line tool, TUI or theme (`tool`).

| Key | Need | Notes |
|---|---|---|
| `language` | required | e.g. `Rust`. |
| `needs` | optional | List of dependencies. |
| `install` | optional | `[[linux.install]]`; an `install` get entry needs at least one. |
| `usage` | required | `[linux.usage]`, the man-page block. |
| `distros` | optional | `[[linux.distros]]` or an inline list. |

#### `layout.tool.install`
`[[linux.install]]`, one per method. A method with a `command` shows a copy button; one without shows its `steps` and `note` as plain text.

| Key | Need | Notes |
|---|---|---|
| `method` | required | e.g. `Arch Linux (AUR)`. |
| `command` | optional | Copyable command. Leave it out for manual steps (an editor, a settings page): no copy button is shown, and the method then needs `steps` or a `note`. |
| `steps` | optional | List of short manual steps, shown as a numbered list. Put paths and typed text in backticks (`` `dist/vscode` ``) to show them as code; write `\`` for a literal backtick. |
| `note` | optional | One short line; backticks work as in `steps`. |

#### `layout.tool.usage`
`[linux.usage]`.

| Key | Need | Notes |
|---|---|---|
| `synopsis` | required | One-line usage. |
| `commands` | optional | `[[linux.usage.commands]]`. |
| `options` | optional | `[[linux.usage.options]]`. |
| `example` | required | A copyable example. |

#### `layout.tool.usage.commands`
`[[linux.usage.commands]]`.

| Key | Need | Notes |
|---|---|---|
| `name` | required | Command name. |
| `help` | required | One short line. |

#### `layout.tool.usage.options`
`[[linux.usage.options]]`.

| Key | Need | Notes |
|---|---|---|
| `flag` | required | e.g. `--dry-run`. |
| `help` | required | One short line. |

#### `layout.tool.distros`
Each entry `{ name, support, how }`.

| Key | Need | Notes |
|---|---|---|
| `name` | required | Distro names. |
| `support` | required | `supported`, `untested` or `unsupported`. |
| `how` | optional | e.g. `AUR`. |

#### `layout.bot`
`[bot]` for a bot (`bot`).

| Key | Need | Notes |
|---|---|---|
| `platform` | required | e.g. `Discord`. |
| `hosting` | required | Where it runs. |
| `invite` | required | `true` if anyone may invite it. |
| `commands` | optional | `[[bot.commands]]`. |

#### `layout.bot.commands`
`[[bot.commands]]`.

| Key | Need | Notes |
|---|---|---|
| `name` | required | Command, e.g. `/roll`. |
| `help` | required | One short line. |
| `who` | required | Who may use it. |

#### `relation`
`[[relation]]` in `bookmarks.toml`; order = legend order.

| Key | Need | Notes |
|---|---|---|
| `id` | required | Used by bookmarks. |
| `description` | required | Legend text. |

#### `group`
`[[group]]`; free groups shown after the categories.

| Key | Need | Notes |
|---|---|---|
| `id` | required | Used by bookmarks. |
| `label` | required | Section title. |

#### `bookmark`
`[[bookmark]]`.

| Key | Need | Notes |
|---|---|---|
| `name` | required | Link text. |
| `url` | required | Another site; not this one. |
| `note` | required | One line, about 90 characters: why it matters. |
| `relation` | required | A relation `id`. |
| `category` | optional | A category `id`. |
| `group` | optional | A group `id`. |
| `author` | optional | Maker's name. |
| `projects` | optional | Project slugs; shown as "see also". |
| `sample` | optional | `true` for placeholder. |
