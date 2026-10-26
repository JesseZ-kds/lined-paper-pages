# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

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

[Unreleased]: ../../compare/1.8.1...HEAD
[1.8.1]: ../../compare/1.8.0...1.8.1
[1.8.0]: ../../releases/tag/1.8.0
