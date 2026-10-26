# How it works

A guide for contributors. For using the plugin, see the [README](../README.md) and
[writing notes](writing-notes.md).

## The parts

| File | Role |
|---|---|
| `styles.css` | The plugin's stylesheet, **generated** by `npm run build` from the three files below. |
| `src/plugin.css` | The plugin's own styles: sheet shadows, page labels, the settings page. |
| `snippets/lined-paper.css` | The paper: ruled rows, red margin line, title bar, body text on the rows, callouts and pictures on the rows, the A4 pages of reading view, and the PDF export. |
| `snippets/cornell-notes.css` | The Cornell layout on top of it: the cue \| notes columns, the essential question, `[!wide]`, `[!divider]`, the summary. |
| `main.js` | The plugin (plain JavaScript, no build step). Everything CSS can't do; see below. |

Everything is driven by **CSS custom properties** with defaults (`var(--lp-line, 36px)`), read
by both snippets. The snippets also work on their own, as CSS snippets in a vault, for the look
without the plugin's pages. The plugin's settings page and the Style Settings plugin set those variables
on `<body>`, so a setting is one variable and never needs the layout code to know about it.

## Rows

Everything sits on rows of height `--line`. Text has `line-height: var(--line)`; every block is
a whole number of rows tall (callouts round their height up with `calc-size()`); pictures are 6
rows. The ruled lines are a repeating gradient with the same period, `--shift` above the row
bottom, so text rests on them.

On screen, `--line` is rounded to whole **device** pixels (the plugin sets `--lp-dpr`): at 125 % or
150 % display scaling a fractional row would make the ruled lines and the (pixel-snapped) text
drift apart by a pixel every few rows. The PDF keeps its exact row.

## Pages

One A4 page = title bar (`--bar-lines` rows) + body (`--body-rows`) + footer, filling
`--print-h` (a little under 297 mm). Row height = `--print-h / rows`, so the three always add up.

**PDF export.** Print CSS breaks pages, repeats the header with fixed-position layers, and pins
the summary to the bottom of the last page. The plugin's markdown post-processors run on the
export too (the summary's invisible copy, embedded callouts, coloured links).

**Reading view.** The sizer is a stack of sheets (`--page-h` = sheet + gap). Two ways to fill them:

1. **CSS pagination**: Chromium builds with `column-wrap` (Obsidian's newer Electron) make each
   sheet a column (`column-height`, `column-wrap: wrap`); the browser moves text to the next
   sheet. The plugin only adds sheet shadows and labels (`decorate()`).
2. **Plugin pagination** (`paginate()`): the plugin walks the blocks top to bottom. A block that
   would cross a sheet's writing area is pushed down with `padding-top`; a Cornell group that is
   too tall is **split by line** (`split()` / `cut()`): the notes continue in a continuation group
   on the next sheet (cue column blank), a long cue continues in the cue column. Headings keep
   with what follows; `[!nextpage]` forces a break; the summary is placed on the last rows of the
   last sheet, or on a new sheet when it doesn't fit.

Every change is recorded in an **undo list**, and every layout starts by undoing the previous
one, so the plugin never leaves anything behind and nothing is written into a note.

## Keeping reading view still

Obsidian renders long notes **virtually**: only sections near the screen are in the DOM, and a
spacer (`.markdown-preview-pusher`) holds the room of the others. Pages can't be laid out from
part of a note, so for lined-paper notes the plugin wraps the renderer's (internal)
`updateVirtualDisplay`: while it runs, the preview element reports a very tall screen at the top
of the note, so Obsidian keeps every section; a scroll back to that pretend position is ignored;
Obsidian's remembered scroll position is set to the real one; what is on screen is anchored.

Layouts are queued (`queue()`): they wait until scrolling has stopped, and DOM changes that don't
change the note (a section moved, or taken off and put straight back) don't trigger one.

These internals are optional: if Obsidian changes them, the plugin leaves them alone.

## Embedded callouts

`![[Note#^id]]` alone on its line, pointing at one callout (or one cue/notes group): the plugin
puts a copy of the callout in its place and hides the embed (`unwrapCalloutEmbeds()`), so it is
laid out exactly like a typed one. In reading view this is undone and redone with every layout,
so the copy follows changes in the other note. CSS also strips the embed frame, as a fallback
while the plugin hasn't run.

## Coloured text

`<font color>` / `<span style="color">` around a `[[link]]`: Obsidian may not render the link.
In reading view and the PDF a post-processor rebuilds it from the section's source
(`getSectionInfo`); in editing view a CodeMirror 6 extension shows the coloured text as a widget
with working links, and the source while the cursor is in it.

## Tests

`npm test` runs the suites in `tests/` in a real Chromium (Playwright):

| Suite | Checks |
|---|---|
| `layout` | Reading view = PDF, word for word, for every test note, in both pagination modes; display scaling. |
| `summary` | Summary placement for 80 combinations of note length and summary length. |
| `containment` | Every letter of notes and cues stays in its column and in a page's writing area. |
| `embeds` | Embedded callouts = typed ones, for several embed DOM shapes, with and without the plugin. |
| `scroll` | A stand-in for Obsidian's virtual renderer: no scroll resets, nothing moves, no layouts while scrolling. |
| `editor` | Editing view: line counts, fonts, and the coloured-text extension in a real CodeMirror. |
| `settings` | The settings page, and one scroll bar in the reading pane. |

`tests/lib/obsidian-sim.css` stands in for the parts of Obsidian's own CSS that matter, and
`tests/lib/harness.js` for its plugin API. When Obsidian's DOM or CSS changes, update those two.
