# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.19.0] - 2026-11-04

### Added
- **Highlighters of several colours in one note.** The *Highlighter: yellow / green / pink / blue /
  orange* commands write `<mark class="hl-pink">text</mark>`, which shows while editing, in reading
  view and in the PDF. `==text==` stays the colour picked in the settings.

### Fixed
- **Highlight edges:** a highlight covers the words and the spaces between them, but no longer
  runs into the space before or after it, so that space stays clear up to the next word.
- **Selected spaces:** the pen and highlighter commands leave a space selected at either end
  outside the mark.

## [1.18.1] - 2026-11-04

### Fixed
- The PDF export has the dates: the note's date on page 1 and each later page's date (its own from
  `page-dates`, or the note's) in its title bar.
  - Before, they were only added a moment after the export was made, which could be too late.
  - Now each part of the export gets its date as Obsidian renders it, from the note's properties
    and its source.

## [1.18.0] - 2026-11-02

### Added
- **Dates on every new page.** Each page that starts with a `# Title` shows a date in its title
  bar corner, in reading view and the PDF:
  - Its own date comes from the `page-dates` list property: the first item for the 2nd title, the
    second for the 3rd, and so on.
  - A page without its own date shows the note's date.
  - Clicking a page's date sets that page's own date.
  - *Insert title* and *Insert Cornell page* on a later page put today in the list, at that page's
    place, so the pages after it keep their dates.

## [1.17.1] - 2026-11-02

### Added
- The date stays easy to change. In reading view, click the date in the title bar and pick a new
  one; it is saved to the note's date property (Enter or click away to save, Esc to cancel). The
  *Set this note's date* command does the same from anywhere, also for a note that has no date
  yet. While editing, the date is the note's ordinary date property.

## [1.17.0] - 2026-11-02

### Added
- **Light or dark paper, whatever Obsidian's theme:**
  - for every note: *Settings → Light or dark paper* (follow Obsidian, always light, always dark),
    the *Switch the paper between light and dark* command, or the ☀/☾ button in the left ribbon;
  - for one note: the *Switch this note's paper* command, or `cssclasses: dark-paper` /
    `light-paper`.

  Obsidian's own colours on the page (callouts, tables, properties) follow the paper, and the PDF
  export uses it too.

### Changed
- **The date is no longer written into the title.** The title bar's corner shows the note's `date`
  property (`date: 2026-10-26` shows as "26 Oct 2026"; `Date` or `created` work too), in reading
  view and the PDF.
  - *Insert title* and *Insert Cornell page* write just `# Title` and set the date property to
    today if the note has none.
  - Titles that still have `<span class="paper-date">` keep working.

## [1.16.1] - 2026-11-02

### Fixed
- Every embedded block (`![[Note#^id]]`) starts on its own line in reading view and the PDF: its
  first line goes straight under whatever is written above it (or on the column's first line), so
  the `![[]]` line takes no room. The plugin now measures from the writing above the embed instead
  of only inside the embed. That also catches an empty line outside it, from a line break, an
  invisible character, an empty element or an empty paragraph Obsidian puts before it.

### Changed
- The layout report (Copy layout report) lists the note's embeds: where each one is, how far it
  was pulled up, and the shape of its line (tags only, none of your text).

## [1.16.0] - 2026-11-02

### Added
- **Pen and paper** settings, for notes that feel written by hand:
  - **Pen:** blue ballpoint, black gel pen, blue-black fountain pen or pencil (lighter versions on
    dark paper).
  - **Pen thickness**, **ink that soaks into the paper** (soft letter edges) and **uneven
    handwriting** (each line sits a touch differently). None of these moves anything to another
    line.
  - **Paper:** ivory, cream, a yellow legal pad or recycled grey.
  - **Sub-headings:** the underline can be wavy, two lines, dashed or none, and the headings can be
    written in the heading pen.
  - **Bullets:** dash, arrow, small circle or star, in a colour of your choice.
  - **Checkboxes:** hand-drawn, ticked in green (on by default).
  - **Crossed-out text:** scribbled out, two lines or a red line.
  - **Highlighter:** yellow, green, pink, blue or orange.
- **Pen marks:** circle, box, underline, wavy underline and scribble out
  (`<span class="pen-circle">…</span>` and so on). They are drawn over the writing in a marking pen
  colour you choose, take no room, and show while editing, in reading view and in the PDF. Each has
  a command, as do *Pen: cross out* (`~~`) and *Insert checkbox (task)*.

### Fixed
- A table written with an empty header row (`| | |` over `|---|---|`, the way to write a table
  without a header) no longer leaves an empty line above its first row. This also fixes an embedded
  table (`![[Note#^table]]`) starting a line low in the notes.

## [1.15.4] - 2026-11-01

### Fixed
- Reading view with the browser's own pages (newer Obsidian): the summary of a part (before a new
  `# Title` or `[!nextpage]`) sits on the bottom lines of the page that part ends on, above the next
  page's title, as in the PDF. It is placed from where the part's notes really are, not from CSS
  anchors, which put it in the footer, under the next title, in some Chromium versions.

### Changed
- Faster reading view: the summaries are all measured first and then all placed (one layout of the
  note instead of one per summary).
- The layout report (Copy layout report) shows how many layouts the note has had and how long the
  last one took.

## [1.15.3] - 2026-11-01

### Fixed
- In reading view and the PDF, the `![[Note#^id]]` line takes no room of its own: text written on the
  line right after an embed (in the same paragraph) came a line too low, under an empty line left by
  the line break after the embed. That break is left out now.

## [1.15.2] - 2026-11-01

### Fixed
- An embedded table (or any embedded block, `![[Note#^id]]`) starts on the embed's own line: nothing
  of Obsidian's inside the embed above it (spacing above the table, an element where the hidden
  embed title was) pushes it a line down. Anything left there is measured and the embed pulled up
  by it. Reading view and the PDF (the spacing in editing view too).

## [1.15.1] - 2026-11-01

### Fixed
- In editing view an embedded block (`>> ![[Note#^id]]` of a paragraph, a list, ...) on a quote line
  started one line lower, under the `>>`; it starts on its own line now, as an embedded callout does.
- A `[!summary]` written inside the notes (`>> > [!summary]`) is laid out like one written after
  them: on the bottom lines of its part's page (before, it stayed among the notes, or pushed itself
  into the footer).
- The check for old copies of the plugin's styles also finds snippets that only style `.cornell` or
  the cue / notes callouts.

### Changed
- *Copy layout report* also tells which snippets are old copies, and, for each summary, where the
  content above it ends and the shape of its block (no text).

## [1.15.0] - 2026-11-01

### Changed
- Reading view is laid out much faster: a long note (28 pages) in about 0.2 s instead of 4 s with the
  browser's own pages, 3 s instead of 7 s with the plugin's. Measuring the note's sizes made the
  browser lay the whole note out again for every value; now they are read without a new layout,
  and titles and questions are measured all together. A note that was just opened or changed is
  laid out on the next frame instead of after a pause.
- Folding headings is for editing view: the fold arrow shows in the margin gap left of a heading
  line there. Reading view has no fold arrows any more (a part folded while editing stays folded
  there).

## [1.14.3] - 2026-11-01

### Fixed
- Older copies of the plugin's styles kept as CSS snippets under other names (e.g. "cornell",
  "lined-paper-print-a4") are switched off too, not only the ones called "lined-paper" and
  "cornell-notes": any switched-on snippet whose CSS is for lined paper. They load after the plugin's
  styles and overrode them (pages not laid out, a new page's title on top of the summary before it,
  an empty row under the question). Their files are kept.
- *Copy layout report* reports the note on screen (not a hidden one).

## [1.14.2] - 2026-11-01

### Fixed
- **Bold** text is bold in the PDF too: the handwriting font has no bold of its own, and the PDF
  export could leave out the way it is drawn on screen; in the PDF it is now a thin outline round the
  letters (it takes no room, so every line still breaks as on screen).

### Added
- Command *Copy layout report*: copies how the open note is laid out (pages, titles, summaries, the
  plugin version and settings) to paste into a message when the pages look wrong. Nothing is changed.

## [1.14.1] - 2026-11-01

### Changed
- Cues start on the same line as their notes again (1.14.0 moved a short cue down to the middle of
  its notes); their text stays centred in the cue column.

### Added
- Folding headings in reading view: the fold arrow shows in the margin gap left of a heading (and
  of the title) when you point at it. Folding takes that part away and the pages are laid out again
  for what is left; unfolding brings it back.

### Fixed
- Folding a heading (e.g. with "Toggle fold") did not work on lined paper: the plugin, which keeps
  every part of a long note on the page, put the folded part straight back, which could leave the
  page laid out wrongly (a summary cut off by the next page's title).

## [1.14.0] - 2026-11-01

### Changed
- Cue text is centred in the cue column (and, in this version only, a short cue was moved down to
  the middle of its notes).

## [1.13.4] - 2026-10-29

### Fixed
- Switching to reading view (or opening a note) showed the note half laid out for a moment: the
  titles of later pages piled up in the first page's title bar, their questions stacked under it.
  Until a changed note is laid out again, only the paper shows now (at most 1.5 s), then the
  finished pages.

## [1.13.3] - 2026-10-29

### Fixed
- Reading view could lay a long note out wrongly when it was opened partway down (a `# Title` not at
  the top of its page, everything after it shifted): as Obsidian built the note a piece at a time,
  the rest of a group continued on the next page could end up after other blocks. It is now put
  straight back after the block it continues (and keeping your place while scrolling no longer
  follows such a block when Obsidian moves it).

### Changed
- An embed of any one block (`![[Note#^block-id]]`: a paragraph, a list, ...) has no embed frame,
  like an embedded callout: no side bar, no title, no link icon, no padding; its text is written on
  the ruled lines like your own. Reading view, editing view and the PDF.

## [1.13.2] - 2026-10-27

### Fixed
- Each part of a note (up to a new `# Title` or a `[!nextpage]`) is a page of its own: its summary
  goes on the bottom lines of that part's last page also when it is written straight under the
  part's last group (`>> [!summary]` inside the group's quote) or with other blocks between it and
  the next title. Before, such a summary went to the end of the note, on top of the last one.

## [1.13.1] - 2026-10-27

### Fixed
- Reading view jumped back to the top while scrolling a note with more than one `# Title`. To start a
  new page at a title, 1.13.0 put an invisible page break between Obsidian's own blocks, which made
  Obsidian lose its place. Now the title's own block is only marked (a class), and the page breaks
  there as before.

## [1.13.0] - 2026-10-27

### Added
- Every `# Title` after the note's own title starts a new page by itself, as if `[!nextpage]` were
  written above it: it is that page's title, and a summary just before it stays with the part above
  it. Setting: *Start a new page at every # title* (on).

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

[Unreleased]: ../../compare/1.15.3...HEAD
[1.15.3]: ../../compare/1.15.2...1.15.3
[1.15.2]: ../../compare/1.15.1...1.15.2
[1.15.1]: ../../compare/1.15.0...1.15.1
[1.15.0]: ../../compare/1.14.3...1.15.0
[1.14.3]: ../../compare/1.14.2...1.14.3
[1.14.2]: ../../compare/1.14.1...1.14.2
[1.14.1]: ../../compare/1.14.0...1.14.1
[1.14.0]: ../../compare/1.13.4...1.14.0
[1.13.4]: ../../compare/1.13.3...1.13.4
[1.13.3]: ../../compare/1.13.2...1.13.3
[1.13.2]: ../../compare/1.13.1...1.13.2
[1.13.1]: ../../compare/1.13.0...1.13.1
[1.13.0]: ../../compare/1.12.1...1.13.0
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
