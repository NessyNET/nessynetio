# Manual checks

What cannot be automated (design 5.2, ux 10 and 11, brief R16 and R19). Run these on a build of the real site before launch and after any large UI change. Record each result in the table at the end of its section: date, build commit (`.build-meta.json`), who, pass or fail, notes.

Preview a build locally:

```
npm run build -- --strict --allow-samples --out .builds/manual
npm run serve:static -- --dir .builds/manual --port 4330     # then open http://127.0.0.1:4330/
```

Use a real phone on the same network or the CI `site-preview` artifact for the phone checks.

## 1. Keyboard only (F1, F4, F5)

Desktop browser and a phone with a keyboard (or the phone's switch/keyboard access). Mouse and touch are not used.

1. **F1, find and read a project:** from the landing page reach a project page and its install steps using only Tab, Shift+Tab, Enter and Space. Every control shows a visible focus ring, nothing is skipped, the skip link works, focus is never hidden under the status line.
2. **F4, filter and sort a category:** on `/ffxiv/` pick a tag from the row, open "+N more" and choose a hidden tag (focus stays on it, the row pins it), change the sort field and direction, reach the empty state with `?tag=nope` and use "show all". Escape closes the panel and returns focus to the toggle.
3. **F5, copy a command:** activate a copy button with Enter and with Space; the label reads "copied" and the announcement is spoken; paste to confirm the exact text.

| Date | Commit | Tester | Device | F1 | F4 | F5 | Notes |
|---|---|---|---|---|---|---|---|

## 2. Screen readers

VoiceOver (macOS Safari, iOS Safari) and TalkBack (Android Chrome). One category page (`/ffxiv/`) and one project page (a plugin with install steps).

- Landmarks and the heading order make sense (one `h1`, windows are labelled regions).
- Links announce where they go; external links say "opens in new tab".
- The tag row, "+N more" toggle, sort controls and copy buttons announce name, state and result.
- Status words (active, retired) and notices are read as text, not as decoration.

| Date | Commit | Tester | Reader and browser | Category page | Project page | Notes |
|---|---|---|---|---|---|---|

## 3. Firefox and Safari: status line (ux check 5)

Automated in Chromium and Firefox (and WebKit in CI), repeated by hand because Safari on a real device behaves differently.

- After scrolling to the end the status line sits at the bottom edge and the last content is above it.
- Tab through the landing, a category and a project page: no focused element is under the status line or above the viewport.
- Safari iOS: the address bar collapsing does not cover the status line.

| Date | Commit | Tester | Browser | Pass | Notes |
|---|---|---|---|---|---|

## 4. Real phone: status line and focus

On an actual phone (not emulation): scroll a long page, open the on-screen keyboard if a field exists, tab with an external keyboard. The status line stays visible, tap targets are reachable, nothing overflows sideways at the phone's width and in landscape.

| Date | Commit | Tester | Phone and browser | Pass | Notes |
|---|---|---|---|---|---|

## 5. Link previews (R19)

The owner pastes three project URLs and the home URL into Discord and into one other chat (for example Telegram or Slack). Expected: a card with the title, the description and the 1200x630 image; no broken image; a second paste of a changed page shows the new card (the image URL carries a hash). This needs the site to be reachable, so do it after the first deploy or against a temporary public URL.

| Date | Chat | URL | Title | Description | Image | Notes |
|---|---|---|---|---|---|---|

## 6. JavaScript off (R18)

Browser setting "disable JavaScript", at 1366 px and 390 px, on `/`, `/ffxiv/`, a project page and `/bookmarks/`:

- All project rows are visible in default order; there are no filter or sort controls, no "+N more", no copy buttons.
- Commands are visible as text and can be selected.
- The 404 page still lists the categories.
- Layout is intact (no overlap, no sideways scroll).

| Date | Commit | Tester | 1366 | 390 | Notes |
|---|---|---|---|---|---|

## 7. Font licence (037)

Confirm the licence files shipped with the build match the fonts used: `public/licenses/JetBrainsMono-OFL.txt` is served at `/licenses/JetBrainsMono-OFL.txt`, and `src/og/fonts/OFL.txt` sits next to the vendored TTFs. Follow the checklist recorded in the licence task (037) and note the date.

| Date | Commit | Tester | Pass | Notes |
|---|---|---|---|---|
