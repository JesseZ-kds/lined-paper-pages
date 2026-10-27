# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.12.1] - 2026-10-27

### Added
- A `[!summary]` written just before `[!nextpage]` stays with the part of the note above it: on the
  bottom lines of that part's last page (shrinking, or taking a page of its own, like the summary at
  the end), with the next part starting on the page after it. Before, it was moved to the end of
  the note, on top of the last summary. Reading view and the PDF.

## [1.12.0] - 2026-10-27

### Added
- A `# Title` straight under `[!nextpage]` is the title of the new page: in its title bar, like the
  note's title on page 1, with the page carrying on under it the same way (a `[!question]` or a
  `[!wide]` under it too). Reading view and the PDF.

### Changed
- The highlighter (`==text==`) looks like a real highlighter: a see-through yellow stroke across the
  middle of the words, slightly slanted, darker at its ends; on dark paper a solid yellow stroke
  with dark text.
- In dark theme the Word / Office colours often used in notes (`#4f81bd`, `#c0504d`, `#9bbb59`,
  `#8064a2`, `#4bacc6`, `#f79646`) are a little lighter, like the pens, so they stay easy to read.

## [1.11.0] - 2026-10-27

### Added
- Pen colours: *Pen: blue / red / green / purple / orange* and *Pen: highlighter* (`==text==`),
  like pens on paper: clear to read and to print on white paper, a little lighter in dark theme.
  See *Pen colours* in docs/writing-notes.md.

### Changed
- An empty `>>` line in the cues or notes (between two paragraphs, or after a list) is an empty
  ruled line on the page.
- The *Colour text …* commands are now the *Pen* commands (same hotkeys), with the pen colours.

### Fixed
- The red line under the `[!question]` replaced the ruled line there: in the margin, left of the red
  margin line, that ruled line was missing. The red line is now drawn on top of it.

## [1.10.2] - 2026-10-27

### Changed
- The red line under the `[!question]` is back (1.10.1 had made it an ordinary ruled line).
- The question block is always exactly three rows: the "Question" label, the question, then the
  Cues | Notes row, so the cues and notes start on the line right below the question. The
  *Essential question lines* setting is gone: a value of 2 saved by an earlier version (in the
  plugin or in Style Settings) left an empty row under the question.

## [1.10.1] - 2026-10-26

### Changed
- The line under the `[!question]` is an ordinary ruled line, like every other writing line (it was
  a red rule): the question is written on it like any other line.
- *Insert title with today's date* and *Insert Cornell page* write the date like `26 Oct 2026`.

## [1.10.0] - 2026-10-26

### Added
- A *Keyboard shortcuts* list in the README.
- Every page block works in a quote of its own (`>> [!divider]`, `>> [!nextpage]`, `>> [!wide]`,
  `>> [!question]`, `>> [!summary]`), like the cue / notes groups.

### Changed
- `[!question]`: the "Question" label is back on a row of its own, the question one line under it.
- The insert commands write every block as `>> [!…]`.

### Fixed
- In editing view a `[!divider]` took no ruled row, so everything after it moved up a line: it keeps
  its row now.
- `>> [!nextpage]` didn't start a new page, and `>> [!divider]` could lose its red line.

## [1.9.9] - 2026-10-26

### Fixed
- An empty row under the `[!question]`: a `cornell-notes` snippet left on from an earlier install
  set the question to its old 2 lines. The question ignores that now, and the plugin switches the
  old `lined-paper` / `cornell-notes` snippets off when it loads (their newer styles are in the
  plugin; the snippet files are kept).

### Added
- Command *Insert title with today's date*: `# Note name <span class="paper-date">26 Oct 2026</span>`
  (the date sits in the title bar's corner). *Insert Cornell page* writes its title the same way.

### Changed
- The plugin writes its version in the developer console when it loads.
- A date written in the title (`<span class="paper-date">`) no longer counts towards the title's
  length when the plugin fits the title on its line.

## [1.9.8] - 2026-10-26

### Added
- Commands (give them hotkeys in Settings → Hotkeys): *Make this note lined paper / Cornell notes /
  a plain note again* (sets `cssclasses`, keeping other classes), *Insert Cornell page*, *Insert cue
  + notes*, *Insert essential question*, *Insert summary*, *Insert full-width lines*, *Insert divider
  line*, *Insert page break*, and *Colour text blue / red / green / orange / purple*.

### Changed
- `[!question]` is one row: the "Question" label and the question on the same ruled line.

### Fixed
- A cue + notes group starting on the last row of a page could leave its cue there and move its
  notes to the next page in reading view, while the PDF moved the whole group: now both move it.

## [1.9.7] - 2026-10-26

### Changed
- The note title sits ON the title bar's double line, like handwriting, whatever the font: the
  plugin measures where the letters sit. The tails of g, y and p hang below the line, in reading
  view and the PDF.
- The `[!question]` text is always one line: a long question is made smaller to fit instead of
  wrapping.
- External links in the PDF are written in the colour of the text around them, without the
  coloured ↗ icon.

## [1.9.6] - 2026-10-26

### Changed
- The note title stays on one line, low in the title bar, as before: it may run under the date (which
  sits in the bar's top corner) up to the right margin, and a title a little too long for that is
  made smaller instead of going on two lines. Only a very long title goes on two lines.

## [1.9.5] - 2026-10-26

### Changed
- The writing reaches further right: the right margin is the red margin line's distance from the
  left edge, mirrored, so double-sided pages can be hole-punched on either side (new setting:
  *Page margin (right)*; *Page margin* is now *Page margin (left)*).
- `[!question]` text: each line is centred in the height of its own row, starting on the first
  row. The *Centre the question in its lines* setting from 1.9.4 is gone.

## [1.9.4] - 2026-10-26

### Added
- Settings for the `[!question]` text: *Centre the question across the page* (off by default) and
  *Centre the question in its lines* (on by default).

### Changed
- `[!question]` text starts on the left by default, centred in the height only.
- *Centre the question and full-width lines* is now *Centre full-width lines*, for `[!wide]` only.

## [1.9.3] - 2026-10-26

### Changed
- The text of `[!question]` is centred in the height as well: in the middle of its rows, between
  the "Question" label and the red line.

### Fixed
- The note title looks as it did in 1.9.1 again (same size, place and room in the title bar,
  with or without a date).

## [1.9.2] - 2026-10-26

### Changed
- The text of `[!question]` and `[!wide]` is centred on the page (setting: *Centre the question
  and full-width lines*).
- `[!question]` keeps 1 line by default (was 2).
- A note without a date gives its title the room the date would take.

### Fixed
- A title that fits on one line could still be put on two lines: it is now measured against the
  real title bar in reading view, and again once the handwriting fonts have loaded.

## [1.9.1] - 2026-10-26

### Fixed
- The Cues | Notes labels and the shadow of a new page appeared late (after a layout, or only once
  scrolling stopped). They now follow the note's height at once, in the same frame as the page,
  and a layout never takes them away and puts them back.
- A blank line followed every callout inside the cues or notes. The next line now starts right
  under it; the blank line between two notes stays.

## [1.9.0] - 2026-10-26

### Changed
- **One install.** The plugin's stylesheet now includes everything the two CSS snippets did, so
  installing the plugin is all it takes (from Obsidian's community plugins, with BRAT, or by hand).
  The snippets are still published for using the look without the plugin.
- `styles.css` is built from `src/plugin.css` and the snippets with `npm run build`.
- Author: JesseZ-kds.

### Added
- A one-time reminder to switch off the old snippets when they are still on next to the plugin.

## [1.8.1] - 2026-10-26

### Fixed
- A callout that landed on a page break was split between two pages (its title or last line
  hidden behind the page edge) in reading view with CSS pagination. A callout, table, code block
  or picture now always moves to the next page whole, as in the PDF.
- Long callout titles were cut off with "…": they now continue on the next line, and the callout
  grows by whole lines.
- A note title too long for the title bar was cut off with "…": it now goes on two lines inside
  the bar, a little smaller, in reading view and the PDF.

## [1.8.0] - 2026-10-25

### Added
- Repository layout: snippets in `snippets/`, user documentation in `docs/`, example notes in
  `examples/`.
- Automated test suite (Playwright, `node:test`): reading view = PDF word for word, summary
  placement, column containment, embeds, scrolling, editing view, settings.
- Release tooling: lint, packaging into a ready-to-install zip, version bump, CI and release
  workflows.

### Changed
- The plugin logs its start-up messages at debug level only.

## [1.7.11] - 2026-10-25

### Fixed
- At 125 % / 150 % display scaling, a ruled line every few rows sat a pixel off or looked doubled:
  every row is now a whole number of screen pixels.

## [1.7.10] - 2026-10-25

### Fixed
- Scrolling stuttered: the pages are no longer laid out again while scrolling, only once it stops
  and only when the note really changed.

## [1.7.9] - 2026-10-25

### Fixed
- Reading view jumped back to the top while scrolling (introduced in 1.7.8).

## [1.7.8] - 2026-10-25

### Fixed
- Pages, labels and text moved while scrolling long notes: the whole note now stays on the page.

## [1.7.7] - 2026-10-25

### Added
- Coloured text with links (`<font color>[[link]]</font>`) in editing view, links clickable.

### Fixed
- A link inside a colour tag could disappear in reading view and the PDF.

## [1.7.6] - 2026-10-25

### Added
- `[!divider]`: a red line across the page.

### Changed
- In editing view, callouts and `[!wide]` no longer add blank lines of their own.

## [1.7.5] - 2026-10-25

### Fixed
- Embedded callouts took extra lines in editing view.
- A callout inside `[!wide]` used the body text size.

## [1.7.4] - 2026-10-25

### Fixed
- Callout titles used Obsidian's own font instead of the handwriting.
- An embedded callout on a `>>` line took an extra line in editing view.

## [1.7.3] - 2026-10-25

### Changed
- Embedded callouts are recognised whatever Obsidian's embed wrappers look like.
- The settings page shows the running version.

## [1.7.2] - 2026-10-23

### Added
- *Underline links* setting; links are no longer underlined by default.

## [1.7.1] - 2026-10-23

### Added
- Embedded callouts (`![[Note#^id]]`) are shown as the callout itself, anywhere in a note.
- Coloured links and embeds with `<font color>` / `<span style="color">`.

## [1.7.0] - 2026-10-23

### Added
- Settings page for every option, handwriting font list, `[!wide]`, `[!nextpage]`.

### Changed
- The title sits on its line like handwriting; the red margin line runs through the footer.

## Earlier versions

1.0 – 1.6: lined paper and Cornell snippets, A4 pagination in reading view, the summary at the
bottom of the last page, callouts and pictures on the rows, reading view matching the PDF export.

[Unreleased]: ../../compare/1.12.1...HEAD
[1.12.1]: ../../compare/1.12.0...1.12.1
[1.12.0]: ../../compare/1.11.0...1.12.0
[1.11.0]: ../../compare/1.10.2...1.11.0
[1.10.2]: ../../compare/1.10.1...1.10.2
[1.10.1]: ../../compare/1.10.0...1.10.1
[1.10.0]: ../../compare/1.9.9...1.10.0
[1.9.9]: ../../compare/1.9.8...1.9.9
[1.9.8]: ../../compare/1.9.7...1.9.8
[1.9.7]: ../../compare/1.9.6...1.9.7
[1.9.6]: ../../compare/1.9.5...1.9.6
[1.9.5]: ../../compare/1.9.4...1.9.5
[1.9.4]: ../../compare/1.9.3...1.9.4
[1.9.3]: ../../compare/1.9.2...1.9.3
[1.9.2]: ../../compare/1.9.1...1.9.2
[1.9.1]: ../../compare/1.9.0...1.9.1
[1.9.0]: ../../compare/1.8.1...1.9.0
[1.8.1]: ../../compare/1.8.0...1.8.1
[1.8.0]: ../../releases/tag/1.8.0
