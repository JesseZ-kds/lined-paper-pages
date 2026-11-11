# Writing notes

How to turn a note into lined paper or a Cornell notes page, and every block you can use.

- [Turning a note into paper](#turning-a-note-into-paper)
- [Commands and hotkeys](#commands-and-hotkeys)
- [Cornell notes](#cornell-notes)
- [Other callouts](#other-callouts)
- [Embedding a callout from another note](#embedding-a-callout-from-another-note)
- [Pen colours](#pen-colours)
- [Coloured links and embeds](#coloured-links-and-embeds)
- [Pictures](#pictures)
- [PDF export](#pdf-export)

## Turning a note into paper

Add this to the note's properties (front matter):

```yaml
---
cssclasses: [lined-paper]          # lined paper only
---
```

```yaml
---
cssclasses: [lined-paper, cornell]  # Cornell notes
---
```

Only notes with these classes are changed. The first `# Heading` becomes the title bar; the title
sits on the bar's double line like handwriting, the tails of g, y and p hanging below it (*Title
position* in the settings moves it). It can run
under the date, up to the right margin. A title a little too long for that is made smaller and stays
on one line; only a very long one goes on two lines inside the title bar.

The red margin line runs down the whole page, footer included, like on real paper.

If a note shows no lines, its `cssclasses` property is missing or misspelt: run **Make this note
Cornell notes** (or **Make this note lined paper**) to set it.

## Commands and hotkeys

Every command has a name that says its kind, and the kinds have their own families of hotkeys
(**Mod** = Ctrl, Cmd on a Mac): **Insert:** Alt + letter, **Pen:** Mod + Alt + letter,
**Highlight:** Alt + Shift + letter, **Mark:** Mod + Alt + Shift + letter. The full list is in the
[README](../README.md#keyboard-shortcuts); change any in *Settings → Hotkeys* (search "Lined Paper").
The **Paper:** and **Note:** commands have no hotkey of their own.

| Command | What it does |
| --- | --- |
| Make this note lined paper | Sets `cssclasses: [lined-paper]` (other classes are kept) |
| Make this note Cornell notes | Sets `cssclasses: [lined-paper, cornell]` |
| Make this note a plain note again | Takes the two classes off |
| Insert title (and today's date) | `# Note name`, and today's date in the note's `date` property (if it has none): shown in the title bar's corner as "26 Oct 2026" |
| Insert Cornell page | Title, question, one cue + notes group, summary; today's date in the `date` property |
| Insert arrow / double arrow / wavy arrow | Types `->`, `=>` or `~>`, drawn as an arrow |
| Set this note's date | A date picker for the note's `date` property (the date in the title bar) |
| Switch the paper between light and dark | Light or dark pages for every note, whatever Obsidian's theme (also the ☀/☾ button in the left ribbon) |
| Switch this note's paper between light and dark | This note only: adds `dark-paper` or `light-paper` to its `cssclasses` |
| Paper follows Obsidian's light / dark theme again | Undoes *Switch the paper* |
| Insert cue + notes | A `[!cue]` / `[!notes]` group, the cursor in the cue |
| Insert essential question | `[!question]` |
| Insert summary | `[!summary]` |
| Insert full-width lines | `[!wide]` |
| Insert divider line | `[!divider]` |
| Insert page break | `[!nextpage]` |
| Pen: blue / red / green / purple / orange | Writes the selected text (or what you type next) in that pen: `<font color="…">` (see [Pen colours](#pen-colours)) |
| Pen: highlighter | Marks the selected text with a yellow highlighter: `==text==` |
| Highlighter: yellow / green / pink / blue / orange | Highlights the selected words in that colour, `<mark class="hl-pink">…</mark>`: several colours in one note (`==text==` is the colour picked in the settings) |
| Remove pen colour / Remove highlight / Remove pen marks / Remove all colours, highlights and marks | Takes them off the selected text, or off the run the cursor is in. (A new pen colour, highlighter or mark always takes the place of the one there: no need to remove it first) |
| Pen: circle / box | Draws a circle / a box round the selected words with the marking pen: `<span class="pen-circle">…</span>` (see [Pen marks](#pen-marks)) |
| Pen: underline / wavy underline | Underlines the selected words with the marking pen |
| Pen: scribble out | Scribbles over the selected words, like a mistake crossed out by hand |
| Pen: cross out | Crosses the selected text out: `~~text~~` |
| Insert checkbox (task) | Turns the line into a task, `- [ ] `, with a hand-drawn box |

Blocks go on lines of their own, with the blank lines around them that Markdown needs, and the
cursor ends up where you write next. Every block is written in a quote of its own (`>> [!question]`,
`>> [!divider]` …), the same way as the cue / notes groups; `>` and `>>` work the same. Suggested hotkeys: Ctrl/Cmd + Shift + C for *Insert cue +
notes*, Ctrl/Cmd + Shift + N for *Make this note Cornell notes* (check they are free first).

## Cornell notes

> **Quick reference (also for AI):** [cornell-note-guide.md](cornell-note-guide.md) has the exact
> rules, a colour scheme and a complete example. Give it to an AI with "write Cornell notes on
> *topic* using this guide".

Every Cornell block is a callout. Put a blank line between blocks.

### Essential question *(optional, at the top)*

```markdown
> [!question] Question
> What do I want to find out?
```

The question block is always three rows: the "Question" label, the question on **one line** (a long
question is made smaller to fit, it never wraps), a red line under it, then the Cues | Notes row,
with the cues and notes starting on the line right below. The question is centred between its two
ruled lines (*Centre the question across the page* in the settings centres it on the line).

### Cue + notes *(as many as you like)*

Write each pair as one group (recommended):

```markdown
>> [!cue]
>> What is X?
>
>> [!notes]
>> X is ...
>> Press Enter for a new line.
```

Or as two separate callouts:

```markdown
> [!cue]
> What is X?

> [!notes]
> X is ...
```

Cues are centred in the cue column and start on the same line as their notes.

**Folding (editing view):** point at a heading line and click the small arrow in the margin gap left
of it to fold that part away (a `# Title` folds its whole page); click it again to unfold. Or use
the commands *Toggle fold on the current line*, *Fold all headings and lists* and *Unfold all
headings and lists* (give them hotkeys in Settings → Hotkeys). Folding needs *Settings → Editor →
Fold heading* on. Reading view shows the pages without fold arrows; a part folded while editing is
left out of reading view too, and the pages are laid out for what is left.

Long notes continue on the next page, in the notes column. A cue that is too long continues in
the cue column.

### Writing across the whole line *(optional, anywhere)*

```markdown
> [!wide]
> A sentence that runs across both columns.
```

The block spans the full width on plain paper (no callout background), with a red line above
and below it, and its text centred (*Centre full-width lines* in the settings puts
it on the left). It is at least **2 lines** tall (change it in the settings) and grows with longer
text. The Cues | Notes divider stops on its top red line and starts again under the bottom one,
and the red margin line always runs through it.

**At the top of a page** (directly under the title bar, or right after a `[!nextpage]`) it takes
the essential question's place. It sits right under the title bar with only its bottom red line,
and the Cues | Notes labels follow under that line. If it lands at the top of a later page by
itself, it simply has no red line above it.

### Divider *(optional, anywhere)*

```markdown
> [!divider]
```

A `[!wide]` with nothing in it: just a red line right across the page (both columns), to split
the page into parts. It has no lines of its own: in reading view and the PDF it sits between a
blank line above and a blank line below, and in editing view on its own ruled row (the
`> [!divider]` line), so nothing after it moves up a line. It works on plain lined paper too.

### Start a new page

```markdown
> [!nextpage]
```

Everything under it starts at the top of the next page. The callout itself is invisible in
reading view and in the PDF; while editing you can still see it.

**A new topic on a new page:** just write a new `# Title`. Every `# Title` after the note's own
title starts a new page by itself, as if `[!nextpage]` were written above it (switch this off with
*Start a new page at every # title* in the settings). It becomes that page's title, in its title
bar, exactly like the note's title on page 1, and the page carries on under it the same way (a
`[!question]` under it sits right below the title, then Cues | Notes). A summary just before it
stays with the part above it. Writing the `[!nextpage]` yourself does the same:

```markdown
>> [!nextpage]

# Second topic

>> [!question] Question
>> What is the second topic about?
```

### Summary *(optional, always last)*

```markdown
> [!summary] Summary
> The big picture in a few lines.
```

- It always sits on the **bottom lines of the last page**: 5 lines by default, or more if its
  text needs them.
- If the notes take some of that room, it shrinks, but never below 3 lines or below its own text.
- If even that doesn't fit, it **moves to a new page**.
- You may also write it inside the last group, as `>> [!summary]`.
- **One summary per part:** each part of a note (up to the next `# Title` or `[!nextpage]`) is a page
  of its own, and its summary (a block of its own, or written inside the part's last group) goes on
  the bottom lines of that part's last page, with the same rules; the next part starts on the page
  after it:

  ```markdown
  >> [!summary] Summary
  >> What the first topic comes down to.

  >> [!nextpage]

  # Second topic
  ```

## Other callouts

Every other callout (`[!note]`, `[!tip]`, `[!warning]`, …) keeps Obsidian's own colours. Its
box is **80 % of the height of the lines it spans** and centred on them, and its text is spaced to
fit the box (change the 80 % in the settings).

A callout is never split between two pages: when it doesn't fit at the bottom of a page, it moves
to the next page whole. A long title goes on to the next line instead of being cut off.

Inside the cues or notes, the next line starts right under a callout. Elsewhere, in reading view
and the PDF, a callout leaves one blank line after it. In editing view it takes
only its own lines, because the empty lines you type between blocks are already there.

## Embedding a callout from another note

Give the callout a block ID in its own note: a line with `^my-id`, with a blank line before and
after it, right under the callout (or right-click the callout → *Copy link to block*). Then embed
it on a line of its own:

```markdown
> [!tip] In "Other note"
> Some text.

^my-id
```

```markdown
![[Other note#^my-id]]
```

The plugin shows the callout as if you had written it right there: a cue/notes group, `[!wide]`,
`[!question]`, `[!summary]` or any other callout looks and lays out exactly like a typed one, in
reading view and in the PDF. Change it in the other note and the copy updates.

The embed can be anywhere, as long as it is alone on its line: at the top level, inside
`[!notes]` or `[!cue]`, inside another callout or in a list. Inside notes it looks just like a
callout typed into the notes:

```markdown
>> [!cue] Cues
>> What is [[immunity#^immunity|immunity]]?
>
>> [!notes] Notes
>> ![[immunity#^immunity]]
```

This works in reading view and in the PDF. The embed's purple bar, frame and link icon are gone:
only the callout shows, exactly like a typed one, on exactly the lines a typed one takes. In editing
view too, it takes no more lines than the same callout typed in, and its title is in the same
handwriting as its text. Inside a `[!wide]` block it takes only the lines it needs, and keeps a
callout's text size. An embed that loads late (e.g. a big note) is picked up as soon as it
appears.

An embed of any other single block (`![[Note#^block-id]]` of a paragraph, a list, ...) has no embed
frame either: no side bar, title or link icon, and its text is written on the ruled lines like your
own. Embeds of a whole note or a heading stay ordinary Obsidian embeds.

## Pen colours

Five pens and a highlighter, like writing on paper: dark enough to read easily and to print clearly
on white paper. Use the *Pen* commands (give them hotkeys), or type the tags yourself:

| Pen | Write | Good for |
| --- | --- | --- |
| Black (normal text) | just write | the notes themselves |
| Blue | `<font color="#1e4fbf">text</font>` | key words, terms, links |
| Red | `<font color="#c62828">text</font>` | warnings, common mistakes, corrections |
| Green | `<font color="#2e7d32">text</font>` | examples |
| Purple | `<font color="#6a1b9a">text</font>` | names, people, sources, quotes |
| Orange | `<font color="#d84315">text</font>` | dates, numbers, formulas |
| Highlighter | `==text==` | the one thing to remember |

More highlighter colours in the same note: the *Highlighter: …* commands, or
`<mark class="hl-green">text</mark>` (`hl-yellow`, `hl-green`, `hl-pink`, `hl-blue`, `hl-orange`).
The stroke covers the words and the spaces between them; the space before and after a highlight stays
clear (a space you select by accident at either end is left outside).

The highlighter looks like a real felt-tip one: one even see-through stroke over the body of the
letters, running a little past the words, its ends cut on the slant like the chisel tip. In dark theme the pens are a little lighter and the
highlighter is a solid yellow stroke with dark text, so they stay easy to read on the dark paper
(on screen and in a PDF exported from dark theme); the Word / Office colours (`#4f81bd`, `#c0504d`,
`#9bbb59`, `#8064a2`, `#4bacc6`, `#f79646`) are a little lighter there too. For printing, export from the light theme: white paper with
the pen colours above. Any other colour (`<font color="#4f81bd">`) still works and is shown as
written.

## The date

The date in the title bar's corner is the note's **`date` property** (`date: 2026-10-26`, shown as
26 Oct 2026; `Date` or `created` work too). It is not written into the title, so the title line is
just `# Title`. *Insert title* and *Insert Cornell page* set it to today when the note has none.
**Every new page has a date too.** The title bar of each page that starts with a `# Title` shows
the note's date, or that page's own date from the `page-dates` list property: the first date in it
for the 2nd `# Title`, the second for the 3rd, and so on (an empty item: the note's date).
*Insert title* / *Insert Cornell page* on a later page put today in that list, at that page's place,
and clicking a page's date sets that page's own date.

```yaml
---
date: 2026-10-26
page-dates:
  - 2026-10-28
  - 2026-11-02
---
```

To change it: in reading view, **click the date** in the title bar and pick a new one (Enter or
click away to save, Esc to cancel); run *Set this note's date* (also for a note with no date yet);
or edit the property itself while editing. A date written into the title the old way (`<span class="paper-date">…</span>`) still works.

## Light or dark paper

The paper follows Obsidian's light or dark theme, unless you choose otherwise:

- for every note: **Settings → Lined Paper Pages → Light or dark paper**, or the *Switch the paper
  between light and dark* command (and the ☀/☾ button in the left ribbon);
- for one note: the *Switch this note's paper* command, or add `dark-paper` / `light-paper` to its
  `cssclasses`.

The PDF export uses the same paper. For printing, light paper uses far less ink.

## Definitions and quotes

A definition or a quote gets a page of its own (a note), and is embedded where you use it, so one
definition can be in many notes and stays the same in all of them.

- **Insert: definition**: asks for the word and its definition, makes its page in the definitions
  folder, and embeds it where your cursor is (`![[Conscientious objection#^def]]`, Alt + F),
  or puts just a link to it there (`[[Conscientious objection#^def|Conscientious objection]]`,
  Alt + Shift + F).
- **Insert: quote** (Alt + O; *linked here* has no hotkey of its own): asks for the author or
  source, a link to the source (optional) and the quote. The quote's title is its source, a link
  when you give one.

A definition's page:

```
---
format: def
date: 2026-11-11
---
> [!info] Conscientious objection
> A doctor may refuse to perform a procedure on moral grounds.

^def
```

(a quote's: `format: quote`, `link:` when it has one, `> [!quote] [Author](https://…)`, `^quote`).
A definition's title is written small (an abbreviation stays as it is), and it ends with a full stop;
a quote is kept exactly as you wrote it.
The pages are plain notes (not lined paper). Each has its **aliases**: its name in other capitals,
its plural or singular, its British / American spellings and with a hyphen or a space (for a
definition), and its abbreviations (from *Abbreviations or other names* in the form, or in brackets after the
name: *In vitro fertilisation (IVF)*), so links and search find it however you write it.

**Revised versions:** on a definition's or quote's page, the **Add a revised definition / quote**
button under its last version (or **Insert: revised version**, Alt + R) adds a new version under it,
with the same title and the next block id: `^revised`, then `^revised-2`, `^revised-3` … Its embed,
`![[Conscientious objection#^revised]]`, is copied for you to paste where you want the new version.

**Folders:** *Settings → Embeds → Folder for definitions / quotes* (Definitions and Quotes by
default; made when needed).

**Formats:** the `format` property (def, quote, img …) gives the page the class `lp-format-…`, for a
look of its own (a CSS snippet: `.lp-format-def …`).

## Arrows

Type an arrow and it is drawn, like an arrow drawn with your pen:

| Type | Drawn |
| --- | --- |
| `->`  `<-`  `<->` | an arrow right, left, both ways |
| `=>`  `<=>` | a double arrow (leads to / both ways) |
| `-->`  `<--` | a long arrow |
| `~>` | a wavy arrow (roughly leads to) |

Pick their look in *Settings → Pen and paper → Arrows*: hand-drawn, straight, bold (filled heads)
or as typed; and their colour (*Arrow colour*: by default the colour of the writing round them).
They show in reading view, in the PDF and while editing (the text again when the cursor is on it),
never in code, and the note keeps what you typed.

**A coloured arrow:** put the cursor on it and run a *Pen: …* colour command (or write it in a pen
colour, `<font color="#c62828">-></font>`). It keeps that colour, even with an *Arrow colour* set.

**↳ bullets:** *Settings → Pen and paper → Bullets* (every point) or *Sub-point bullets* (only the
indented points of a list) can be *↳ Arrow from the line above*: a line coming down from the line
above, turning to point at the point, as in hand-written notes where a point follows from the one
above it.

**A different bullet for each kind of point:** a list item can start with `-`, `*` or `+`, and each
can have its own bullet (*Settings → Pen and paper*: *Bullets* for `-`, *Bullets typed with \** and
*Bullets typed with +*: dot, dash, arrow, ↳, small circle or star). For example, with `+` as ↳ and
`*` as an arrow:

```
- Judaism: life begins at birth
  + the foetus is special          (↳ follows from the line above)
  * until forty days it is water   (→ leads on)
```

## Pen marks

Mark words the way you would on paper. Select them and run a *Pen* command (or type the tag):

| Mark | Write |
| --- | --- |
| Circle | `<span class="pen-circle">word</span>` |
| Box | `<span class="pen-box">word</span>` |
| Underline | `<span class="pen-underline">words</span>` |
| Wavy underline | `<span class="pen-wavy">words</span>` |
| Scribbled out | `<span class="pen-scribble">mistake</span>` |

The marks are drawn over the writing in the marking pen (red by default: *Settings → Pen and
paper → Marking pen colour*). They take no room, so nothing on the page moves, and they show while
editing, in reading view and in the PDF.

**Settings → Pen and paper** sets up the rest of the pen-on-paper feel: the pen (blue ballpoint,
black gel, blue-black fountain pen, pencil), its thickness, ink that soaks into the paper a
little, slightly uneven handwriting, the paper (ivory, cream, a yellow legal pad, recycled grey),
how sub-headings are underlined, drawn bullets (dash, arrow, circle, star) and their colour,
hand-drawn checkboxes ticked in green, how crossed-out text looks, and the highlighter's colour.

## Tables without a header

Markdown needs a header row on a table, so a table without one is written with an empty header
(`| | |` over `|---|---|`). That empty row takes no line on the page: the table's first row is on
the line the table starts on (typed or embedded with `![[Note#^table]]`).

Each row of a table takes exactly as many ruled lines as its writing, and the writing after a table
(typed or embedded) starts on the very next line. An empty row typed straight under the header is
left out; to have a gap there, switch on *Settings → A line under a table's header row*.

## Coloured links and embeds

Links show in their colour only, without an underline, like writing (*Settings → Underline links*
brings the underline back).

Put a colour around a link or an embed with HTML:

```markdown
What is <font color="#4f81bd">[[immunity#^immunity|immunity]]</font>?

What is <span style="color: #c0504d">[[immunity]]</span>?

<font color="#4f81bd">![[immunity#^immunity]]</font>
```

Inside Cornell blocks it works the same way:

```markdown
>> [!cue] Cues
>> What is <font color="#4f81bd">[[immunity#^immunity|immunity]]</font>?
>
>> [!notes] Notes
>> <font color="#4f81bd">![[immunity#^immunity]]</font>
```

A link takes that colour. An embedded callout gets it for its text, while its title and box keep
the callout's own colour.

This works in editing view too: the coloured text shows in its colour and its links work (click
to open). Put the cursor in it to see and edit the HTML. In reading view and the PDF, a link inside
a colour always comes out as a working link, even where Obsidian on its own would drop it.

## Pictures

A picture takes 6 lines and runs from one ruled line to another, kept in proportion. It sits on
plain paper, so the ruled lines don't run through a transparent picture, and the PDF keeps its
full resolution, so it prints sharp.

## PDF export

Use Obsidian's *⋯ → Export to PDF* with **Page size: A4** and **Margin: None**. Export from the
**light theme** for the cleanest print.

The PDF has the same pages as reading view. Every page repeats the title bar (empty after page 1)
and the Cues | Notes row, and the footer stays blank.
