# Troubleshooting

Most problems come from files that don't belong together. The plugin and the two snippets are
made as a set: **always update all of them together**, then restart Obsidian. The version shown
at the top of *Settings → Lined Paper Pages* tells you which plugin version is running.

| What you see | What to do |
|---|---|
| Nothing changes in a note | Check the note's properties: `cssclasses: [lined-paper]` (and `cornell` for Cornell notes). Check both snippets are switched on in *Settings → Appearance → CSS snippets*. |
| A note above the first page says *"Lined Paper Pages plugin is not running"* | Switch the plugin on in *Settings → Community plugins*. The snippets alone draw the paper, but only the plugin moves text out of footers and onto the next page. |
| Text runs into the footer, or the summary sits in the wrong place | Make sure the plugin and the snippets are the same version. A downloaded file may have been saved as `lined-paper (1).css` or `main (1).js`: then Obsidian keeps using the old one. Delete the old copies, keep one of each name, restart Obsidian. |
| The last lines of a PDF page spill onto an extra page | Lower *Advanced → Page height used* by 1–2 mm. |
| The handwriting looks like a plain font, or the title is cut off (`Title…`) | The handwriting fonts download from Google Fonts. Export or open the note while online, or pick a font installed on your computer (*Settings → Handwriting font → Other*). |
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
