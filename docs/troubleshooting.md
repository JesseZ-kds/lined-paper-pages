# Troubleshooting

Most problems come from an old copy of the plugin. The version shown at the top of *Settings →
Lined Paper Pages* tells you which version is running; update it (*Community plugins → Check for
updates*, BRAT, or by replacing the plugin folder) and restart Obsidian.

| What you see | What to do |
|---|---|
| Nothing changes in a note | Check the note's properties: `cssclasses: [lined-paper]` (and `cornell` for Cornell notes). Check **Lined Paper Pages** is enabled in *Settings → Community plugins*. |
| A note above the first page says *"Lined Paper Pages plugin is not running"* | You are using the CSS snippets without the plugin: they draw the paper, but only the plugin moves text out of footers and onto the next page. Enable the plugin in *Settings → Community plugins*, and switch the snippets off. |
| Text runs into the footer, or the summary sits in the wrong place | Update the plugin. If you installed it by hand, a downloaded file may have been saved as `main (1).js`: then Obsidian keeps using the old one. Replace the whole `lined-paper-pages` folder and restart Obsidian. |
| Settings show up twice in Style Settings, an empty row under the question, or a change seems to apply twice | The old CSS snippets are still switched on next to the plugin. Since 1.9.9 the plugin switches **lined-paper** and **cornell-notes** off when it loads; otherwise switch them off in *Settings → Appearance → CSS snippets*. |
| The last lines of a PDF page spill onto an extra page | Lower *Advanced → Page height used* by 1–2 mm. |
| The handwriting looks like a plain font | The handwriting fonts download from Google Fonts. Export or open the note while online, or pick a font installed on your computer (*Settings → Handwriting font → Other*). |
| A setting doesn't change anything | It may be set in Style Settings too: the plugin's settings page wins, so reset it there or here. |
| An embedded callout still shows Obsidian's embed frame (purple bar) | The embed must be alone on its line and point at a block that is one callout (or one cue/notes group). Embeds of anything else stay ordinary embeds. |
| A link inside `<font color>` doesn't show | Update to the latest version: the plugin rebuilds such links in reading view, the PDF and editing view. |
| Scrolling a long note feels slow, jumps, or resets to the top | Update to the latest version: the plugin keeps the whole note on the page and never lays it out again while you scroll. |
| Every few rows a ruled line sits a pixel off or looks doubled (125 % / 150 % display scaling) | Update to the latest version: every row is a whole number of screen pixels. |
| Things look odd after an update | Run the command **Re-paginate reading view** (*Ctrl/Cmd + P*). |

## Limits

- A single table or code block taller than a whole page can't be split, so it runs over the footer.
- Without the plugin, a summary longer than 4 lines may run past the page.
- Reading view keeps the whole note on the page (needed to lay out pages). On very long notes
  (hundreds of pages) this uses more memory than Obsidian's usual reading view.

## Reporting a problem

Open an issue with: your Obsidian version, the plugin version (top of *Settings → Lined Paper
Pages*), your operating system and display scaling, a screenshot or the exported PDF, and the
Markdown of a small note that shows the problem.
