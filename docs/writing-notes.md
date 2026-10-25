# Writing notes

How to turn a note into lined paper or a Cornell notes page, and every block you can use.

- [Turning a note into paper](#turning-a-note-into-paper)
- [Cornell notes](#cornell-notes)
- [Other callouts](#other-callouts)
- [Embedding a callout from another note](#embedding-a-callout-from-another-note)
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

Only notes with these classes are changed. The first `# Heading` becomes the title bar; the title rests on the bar's double line like handwriting (*Title position* in the settings).

The red margin line runs down the whole page, footer included, like on real paper.

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

Long notes continue on the next page, in the notes column. A cue that is too long continues in
the cue column.

### Writing across the whole line *(optional, anywhere)*

```markdown
> [!wide]
> A sentence that runs across both columns.
```

The block spans the full width on plain paper (no callout background), with a red line above
and below it. It is at least **2 lines** tall (change it in the settings) and grows with longer
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
blank line above and a blank line below, and in editing view on the line between the lines around
it. It works on plain lined paper too.

### Start a new page

```markdown
> [!nextpage]
```

Everything under it starts at the top of the next page. The callout itself is invisible in
reading view and in the PDF; while editing you can still see it.

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

## Other callouts

Every other callout (`[!note]`, `[!tip]`, `[!warning]`, …) keeps Obsidian's own colours. Its
box is **80 % of the height of the lines it spans** and centred on them, and its text is spaced to
fit the box (change the 80 % in the settings).

In reading view and the PDF a callout leaves one blank line after it. In editing view it takes
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

Embeds of anything else (a whole note, a heading, a paragraph) stay ordinary Obsidian embeds.

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
