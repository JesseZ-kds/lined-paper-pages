# Lined Paper Pages

**Lined paper and Cornell notes for [Obsidian](https://obsidian.md).** Your notes look like
handwritten pages: ruled lines, a red margin, a title bar, and the Cornell layout (cues, notes,
summary). Reading view shows them as real A4 sheets that look exactly like the PDF export.

<p align="center">
  <img src="docs/images/cornell-light.png" width="48%" alt="A Cornell notes page in the light theme: question, cues and notes on ruled lines, and a summary at the bottom">
  <img src="docs/images/cornell-dark.png" width="48%" alt="The same page in the dark theme">
</p>

## Features

- **Lined paper**: text sits on ruled lines, with a red margin line and a title bar, in reading
  view, editing view and the PDF. Handwriting fonts to choose from.
- **Cornell notes**: an essential question, cue | notes columns, and a summary that always sits on
  the bottom lines of the last page.
- **Real A4 pages in reading view**, page for page and word for word the same as *Export to PDF*.
  Long notes continue on the next page in the right column; nothing ever runs into a footer.
- **Building blocks**: `[!wide]` lines across both columns, `[!divider]` lines, `[!nextpage]` page
  breaks, pictures sized to the rows, and every Obsidian callout fitted to the lines.
- **Embedded callouts** (`![[Note#^id]]`) look exactly like typed ones, and update with their note.
- **Colour coding**: coloured text and links with `<font color>`, in every view.
- **A settings page** for everything (sizes, fonts, colours, Cornell layout), also available in
  the Style Settings plugin.
- **Nothing is ever written into your notes.** Turn it off and your notes are plain Markdown.

## Installation

### From Obsidian (once it is listed as a community plugin)

*Settings → Community plugins → Browse*, search for **Lined Paper Pages**, then **Install** and
**Enable**. Updates come through *Check for updates*.

### With BRAT (now, with automatic updates)

1. Install and enable **BRAT** from *Settings → Community plugins → Browse*.
2. Run the command **BRAT: Add a beta plugin for testing** (*Ctrl/Cmd + P*) and enter
   `JesseZ-kds/lined-paper-pages`.
3. Enable **Lined Paper Pages** in *Settings → Community plugins*.

### By hand

Download `lined-paper-pages-<version>.zip` from the [latest release](../../releases/latest), unzip
it, and copy the `lined-paper-pages` folder into `<your vault>/.obsidian/plugins/`. Then enable
**Lined Paper Pages** in *Settings → Community plugins*. To update, replace the folder and restart
Obsidian.

The version that is running is shown at the top of *Settings → Lined Paper Pages*.

> **Upgrading from 1.8 or earlier?** The plugin now includes everything that the two CSS snippets
> did. Switch the snippets **lined-paper** and **cornell-notes** off in *Settings → Appearance →
> CSS snippets* (the plugin reminds you once). They still work on their own, without the plugin,
> if you only want the look without the pages.

## Quick start

Add a `cssclasses` property to a note:

```markdown
---
cssclasses: [lined-paper, cornell]
---

# Photosynthesis

> [!question] Question
> How do plants turn sunlight into food?

>> [!cue]
>> What is photosynthesis?
>
>> [!notes]
>> - Plants make **glucose** from light, water and CO₂
>> - Oxygen is given off as a by-product

> [!summary] Summary
> Plants use light to turn water and CO₂ into glucose and oxygen.
```

Use `cssclasses: [lined-paper]` for lined paper without the Cornell layout. Only notes with these
classes are changed. Commands (with hotkeys if you like) set the classes and type the blocks for you:
see [Commands and hotkeys](docs/writing-notes.md#commands-and-hotkeys). The [examples](examples/) folder has two complete notes to copy.

## Keyboard shortcuts

Every command is in the command palette (Ctrl/Cmd + P, type "Lined Paper"). To give one a
shortcut: **Settings → Hotkeys**, search "Lined Paper", click the ⊕ next to the command and press
the keys. Suggested shortcuts (none are set for you; check a combination is free first):

| Command | Suggested shortcut |
| --- | --- |
| Make this note Cornell notes | Ctrl/Cmd + Alt + C |
| Make this note lined paper | Ctrl/Cmd + Alt + L |
| Make this note a plain note again | — |
| Insert Cornell page | Ctrl/Cmd + Alt + P |
| Insert title with today's date | Ctrl/Cmd + Alt + T |
| Insert cue + notes | Ctrl/Cmd + Alt + N |
| Insert essential question | Ctrl/Cmd + Alt + Q |
| Insert summary | Ctrl/Cmd + Alt + S |
| Insert full-width lines (`[!wide]`) | Ctrl/Cmd + Alt + W |
| Insert divider line | Ctrl/Cmd + Alt + D |
| Insert page break | Ctrl/Cmd + Alt + Enter |
| Colour text blue / red / green / orange / purple | Ctrl/Cmd + Alt + 1 … 5 |
| Re-paginate reading view | — |

The *Insert* and *Colour* commands work in editing view (where there is a cursor); switch with
Ctrl/Cmd + E (*Toggle reading view*). Details: [Commands and hotkeys](docs/writing-notes.md#commands-and-hotkeys).

## Documentation

| | |
|---|---|
| [Writing notes](docs/writing-notes.md) | Every block: question, cues and notes, `[!wide]`, `[!divider]`, `[!nextpage]`, summary, callouts, embeds, colours, pictures, PDF export. |
| [Cornell note guide](docs/cornell-note-guide.md) | A one-page reference with the exact rules, a colour scheme and a complete example. Written so that an AI can follow it too. |
| [Settings](docs/settings.md) | Every option on the settings page. |
| [Troubleshooting](docs/troubleshooting.md) | Common problems, limits, and how to report a bug. |
| [How it works](docs/architecture.md) | For contributors: how the pages are made. |

<p align="center">
  <img src="docs/images/lined-paper.png" width="48%" alt="A page of plain lined paper with a heading, a list and a callout">
</p>

## Exporting to PDF

Use *⋯ → Export to PDF* with **Page size: A4** and **Margin: None**. The PDF has the same pages as
reading view; every page repeats the title bar and the Cues | Notes row.

## Privacy and compatibility

- **Network**: the handwriting fonts load from Google Fonts (`fonts.googleapis.com`). Nothing
  else is sent anywhere. Pick a font installed on your computer to use it offline.
- **Obsidian internals**: to keep reading view still while you scroll, the plugin adjusts how
  Obsidian's reading view renders long lined-paper notes. This uses parts of Obsidian that are not
  an official API; if they change, the plugin leaves them alone and only that feature stops.
- Requires Obsidian 1.4 or newer. Developed and tested on desktop; it isn't marked desktop-only,
  but mobile is untested.

## Development

```sh
npm install          # Playwright, CodeMirror and esbuild, for the tests
npx playwright install chromium
npm run build        # styles.css from src/plugin.css and the snippets (run after editing CSS)
npm run lint         # syntax, JSON, version numbers, stylesheet braces, styles.css up to date
npm test             # the whole test suite in a real Chromium (needs pdftotext: poppler-utils)
npm run package      # dist/lined-paper-pages-<version>.zip
```

`main.js` is plain JavaScript with no build step. The stylesheet is assembled by `npm run build`:
edit `src/plugin.css` and `snippets/*.css`, never `styles.css` itself.
See [CONTRIBUTING.md](CONTRIBUTING.md) for the project layout, the tests and how to release.

## License

[MIT](LICENSE)
