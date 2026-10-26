# Contributing

Thanks for helping. Bug reports, ideas and pull requests are all welcome.

## Reporting a bug

Open an issue using the bug report form. The most useful things to include: the plugin version
(top of *Settings → Lined Paper Pages*), your Obsidian version, operating system and display
scaling, a screenshot or exported PDF, and the Markdown of a small note that shows the problem.

## Project layout

```
main.js                  the plugin (plain JavaScript, loaded by Obsidian as-is)
manifest.json            plugin manifest
styles.css               the plugin's own styles (sheet shadows, labels, settings page)
snippets/
  lined-paper.css        the paper, the rows, the A4 pages, the PDF export
  cornell-notes.css      the Cornell layout
docs/                    user documentation, and architecture.md for contributors
examples/                example notes
tests/                   the test suites (node:test + Playwright)
  lib/harness.js         renders a note in reading view and as a PDF
  lib/notes.js           the test notes
  lib/obsidian-sim.css   a stand-in for Obsidian's own CSS
scripts/                 lint, packaging, version bump, screenshots
```

Read [docs/architecture.md](docs/architecture.md) before changing the layout code.

## Setting up

You need Node.js 20 or newer and, for the PDF tests, `pdftotext` (`poppler-utils` on Linux,
`brew install poppler` on macOS).

```sh
npm install
npx playwright install chromium
npm run lint
npm test
```

To try a change in Obsidian, copy `main.js`, `manifest.json` and `styles.css` into a test vault's
`.obsidian/plugins/lined-paper-pages/` and the snippets into `.obsidian/snippets/`, then run
*Reload app without saving* (or toggle the plugin).

## Making a change

- **Keep reading view and the PDF identical.** The `layout` tests compare them word for word; run
  them after every layout change. Both pagination modes (plugin and CSS `column-wrap`) must pass.
- **Add a test note** to `tests/lib/notes.js` for a new block or a bug, and a test that fails
  without your fix.
- **Settings are CSS variables.** A new option is a `--lp-…` / `--cn-…` variable with a default in
  the snippet, an entry in `SETTINGS` in `main.js`, and an entry in the snippet's Style Settings
  block.
- **Never write into notes**, and record every DOM change the plugin makes in the undo list.
- **Match the surrounding style**: comments explain *why*, in plain words; CSS sections keep
  their numbered headers.
- Update `CHANGELOG.md` under **Unreleased**, and the docs if users see the change.

## Releasing

1. Move the **Unreleased** entries in `CHANGELOG.md` under a new version heading.
2. `npm version <patch|minor|major>`: updates `package.json`, `manifest.json` and `versions.json`,
   commits, and tags the commit with the bare version number (e.g. `1.8.1`).
3. `git push --follow-tags`. The release workflow runs the lint and tests, builds the zip, and
   publishes a GitHub release with `main.js`, `manifest.json`, `styles.css`, the snippets and the
   zip, using the changelog entry as its notes.
