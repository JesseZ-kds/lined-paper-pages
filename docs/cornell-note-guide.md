# Cornell Note Guide

How to write a Cornell notes page for the **Lined Paper & Cornell Notes** setup in Obsidian.
It is written for people, and precise enough for an AI to follow exactly.

> **Using an AI?** Give it this whole file and ask, for example:
> *"Using cornell-note-guide.md, write a Cornell notes page on the water cycle. Output only the
> Markdown file."*

---

## 1. The rules (read these first)

1. The file starts with **front matter** (section 2). Nothing comes before it.
2. Then **one** `# Title` line. Use `#` only once in the whole note. It becomes the title bar.
3. Every block is a **callout**, written with `>` at the start of each of its lines.
4. Put **one empty line between blocks**. Never put an empty line *inside* a block. An empty line
   ends the block.
5. Blocks go in this order:
   1. Essential question *(optional, once, first)*
   2. Cue + notes groups *(as many as needed)*, with full-width blocks and dividers between them
      if wanted
   3. Summary *(optional, once, always last)*
6. These callout names are **reserved** for the layout. Use each only for its job below:
   `question`, `cue`, `notes`, `summary`, `wide`, `divider`, `nextpage`.
   For coloured boxes, use the other callout types (section 5).
7. Keep it like handwritten notes: short cues, short bullet points, and a summary of 2–4 lines.

---

## 2. Front matter

```markdown
---
cssclasses: [lined-paper, cornell]
date: 2026-10-25
---
```

- `cssclasses: [lined-paper, cornell]` turns the note into a Cornell page. Write it exactly like
  this.
- `date` is optional. It is shown in the top-right corner of the page. Use the format `YYYY-MM-DD`.

---

## 3. The blocks

### Essential question *(optional)*

The big question the page answers, at the top. One sentence.

```markdown
> [!question] Question
> How do plants turn sunlight into food?
```

### Cue + notes group *(the main part)*

Each group is one idea: a **cue** on the left (a short question or keyword), and the **notes** on
the right. Write the pair as one group:

```markdown
>> [!cue]
>> What is photosynthesis?
>
>> [!notes]
>> - Plants make **glucose** from light, water and CO₂
>> - Happens in the **chloroplasts**
```

Exact shape, line by line:

| Line | Starts with | What it is |
|---|---|---|
| 1 | `>> [!cue]` | starts the cue |
| 2… | `>> ` | the cue text (one or more lines) |
| next | `>` | **a single `>` on its own**, which separates cue and notes (not an empty line) |
| next | `>> [!notes]` | starts the notes |
| rest | `>> ` | the notes: text, bullet lists (`>> - `), numbered lists (`>> 1. `), bold, colours |

- An empty line inside the notes is written as `>>` alone, never as a truly empty line.
- Long notes are fine: they continue on the next page, in the notes column.
- Keep cues short: a question ("Why…?", "What is…?") or one or two keywords.

### Full-width line *(optional, anywhere between groups)*

Text across both columns, between red lines. Use it for a heading, a definition or a key fact
that belongs to the whole page.

```markdown
> [!wide]
> Part 2: The light reactions
```

- At the very top of the page (right after the title, instead of a question) it takes the
  question's place.

### Divider *(optional, anywhere between groups)*

A red line across the page that splits it into parts. It has no text.

```markdown
> [!divider]
```

### New page *(optional)*

Everything after it starts on the next page.

```markdown
> [!nextpage]
```

### Summary *(optional, always the last block)*

The big picture in 2–4 lines, in your own words. It sits at the bottom of the last page.

```markdown
> [!summary] Summary
> Plants use light energy to turn water and CO₂ into glucose and oxygen. This happens in two
> stages: the light reactions and the Calvin cycle.
```

---

## 4. Inside the text

| You want | Write |
|---|---|
| bold | `**word**` |
| italic | `*word*` |
| highlight | `==word==` |
| coloured text | `<font color="#4f81bd">word</font>` |
| bold and coloured | `**<font color="#4f81bd">word</font>**` |
| link to another note | `[[Other note]]` |
| a picture (6 lines tall) | `![[picture.png]]` on its own line |
| a callout from another note | `![[Other note#^block-id]]` on its own line |
| a line break | just start a new line (in a block: a new `>>` line) |

To show other words for a link, add them after a bar: `[[Other note|shown text]]`.
Links are not underlined. A colour put around a link colours the link:
`<font color="#4f81bd">[[Other note]]</font>`.

---

## 5. Colour coding

Use **one meaning per colour** across the whole page, and few colours (two or three). Do not
colour whole sentences.

### Text colours

These read well on both light and dark paper:

| Colour | Code | Use it for |
|---|---|---|
| blue | `#4f81bd` | key terms and definitions |
| red | `#c0504d` | warnings, common mistakes, things to remember |
| green | `#9bbb59` | examples |
| orange | `#f79646` | dates, numbers, formulas |
| purple | `#8064a2` | people, names, sources |

### Coloured boxes (callouts inside the notes)

A box inside the notes, for something that should stand out. Put it inside the notes, with
`>>` in front of every line:

```markdown
>> [!notes]
>> - Light reactions happen in the thylakoids
>> > [!tip] Memory trick
>> > "Thylakoids take the light"
```

Inside the notes, a box starts with `>> > [!type] Title`, and each of its lines with `>> > `.
Its box takes whole lines of the page.

| Type | Colour | Use it for |
|---|---|---|
| `[!note]` or `[!info]` | blue | extra information |
| `[!tip]` | cyan | memory tricks, hints |
| `[!example]` | purple | worked examples |
| `[!success]` | green | the key result, the answer |
| `[!warning]` | orange | common mistakes |
| `[!danger]` | red | very important, often in tests |
| `[!quote]` | grey | quotes |

A box can also be its own block between groups (`> [!tip] Title`, with an empty line before and
after). Never use the reserved names (`question`, `cue`, `notes`, `summary`, `wide`, `divider`,
`nextpage`) for boxes.

---

## 6. Don't

- Don't put an empty line inside a block (use `>` between cue and notes, `>>` inside notes).
- Don't use `#` headings inside the note (only the one title). Use a cue, `[!wide]` or bold
  instead.
- Don't put the summary anywhere but last.
- Don't put more than one essential question.
- Don't make one very long table or code block: a table or code block taller than a page can't be
  split across pages.
- Don't write long paragraphs in the notes. Use short bullet points.

---

## 7. A complete example

Copy this shape.

````markdown
---
cssclasses: [lined-paper, cornell]
date: 2026-10-25
---

# Photosynthesis

> [!question] Question
> How do plants turn sunlight into food?

>> [!cue]
>> What is photosynthesis?
>
>> [!notes]
>> - Plants make **<font color="#4f81bd">glucose</font>** from light, water and CO₂
>> - Oxygen is given off as a by-product
>> - Happens in the **<font color="#4f81bd">chloroplasts</font>**

>> [!cue]
>> The equation
>
>> [!notes]
>> <font color="#f79646">6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂</font>
>> - Needs light energy and chlorophyll

> [!wide]
> Part 2: The two stages

>> [!cue]
>> Light reactions
>
>> [!notes]
>> - In the **<font color="#4f81bd">thylakoids</font>**
>> - Light splits water → oxygen is released
>> - Makes ATP and NADPH for the next stage
>> > [!tip] Memory trick
>> > "Thylakoids take the light"

>> [!cue]
>> Calvin cycle
>
>> [!notes]
>> - In the **<font color="#4f81bd">stroma</font>**
>> - Uses ATP and NADPH to turn CO₂ into glucose
>> - Does not need light directly
>> - <font color="#c0504d">Common mistake: it does not only happen at night</font>

> [!divider]

>> [!cue]
>> Why does it matter?
>
>> [!notes]
>> - Makes the oxygen we breathe
>> - Food for almost every food chain
>> - <font color="#9bbb59">e.g. wheat → bread → us</font>

> [!summary] Summary
> Plants use light to turn water and CO₂ into glucose and oxygen. The light reactions (thylakoids)
> make ATP and NADPH; the Calvin cycle (stroma) uses them to build glucose.
````

---

## 8. Checklist before you finish

- [ ] Front matter first, with `cssclasses: [lined-paper, cornell]`
- [ ] Exactly one `# Title`
- [ ] One empty line between blocks, none inside a block
- [ ] Every group: `>> [!cue]`, cue lines, a single `>`, `>> [!notes]`, notes lines
- [ ] Reserved names used only for their own job
- [ ] Two or three colours, one meaning each
- [ ] Summary last, 2–4 lines
