'use strict';
/*
 * Lined Paper Pages: lined paper and Cornell notes for Obsidian.
 *
 * The look comes from the plugin's styles.css, built from snippets/lined-paper.css and
 * snippets/cornell-notes.css (which also work on their own, as CSS snippets) and src/plugin.css:
 * paper, ruled lines, title bar, Cornell columns, and the A4 pages of reading view and the PDF.
 * This plugin does what CSS can't (see docs/architecture.md):
 *
 *   Reading view   - pagination: a block that would touch a sheet's footer or the next sheet's
 *                    header is pushed to the next sheet; a Cornell group that is too tall is split
 *                    by line (the notes continue in the notes column, a long cue in the cue
 *                    column); the summary goes to the bottom of the last sheet; every sheet gets
 *                    its shadow and, from sheet 2, its Cues | Notes labels. In Chromium builds
 *                    with CSS `column-wrap` the browser makes the pages and the plugin only adds
 *                    the shadows and labels;
 *                  - embedded callouts (`![[Note#^id]]`) are shown as the callout itself;
 *                  - the whole note is kept on the page (Obsidian builds long notes bit by bit),
 *                    and the pages are never laid out again while scrolling.
 *   PDF export     - markdown post-processors: the summary's invisible copy, embedded callouts,
 *                    coloured links.
 *   Editing view   - an editor extension shows <font color>/<span style="color"> text, links in it
 *                    working.
 *   Settings page  - every option sets one of the CSS variables the snippets read (--lp-…, --cn-…)
 *                    on <body>; see SETTINGS below.
 *
 * Nothing is ever written into a note. Every layout starts by undoing the previous one.
 */
const { Plugin, Notice, PluginSettingTab, Setting } = require('obsidian');

// ---------- settings ----------
// Every option of the settings page. Each sets the CSS variable --<key> (read by lined-paper.css /
// cornell-notes.css), or a class on <body> (type 'toggle' with cls). Not set = the snippet's default.
//   unit   appended to the number ('px', 'mm'; percentages are stored as 0..1)
//   pct    shown as a percentage on the page (stored 0..1)
const SETTINGS = [
  { section: 'Pages and text' },
  { key: 'pages', type: 'toggle', cls: 'lp-no-pages', invert: true, def: true, name: 'A4 pages in reading view',
    desc: 'Show reading view as separate A4 sheets, exactly like the PDF export. Off: one long lined page.' },
  { key: 'paper-theme', type: 'select', cls: 'lp-paper-theme-', def: 'auto', name: 'Light or dark paper',
    options: { auto: 'Follow Obsidian\'s theme', light: 'Always light paper', dark: 'Always dark paper' },
    desc: 'Light or dark pages, whatever Obsidian\'s theme is (the PDF too). A single note can have its own: the "Switch this note\'s paper" command, or cssclasses: dark-paper / light-paper.' },
  { key: 'lp-body-rows', type: 'slider', min: 20, max: 48, step: 1, def: 32, name: 'Lines per page',
    desc: 'Ruled lines on each A4 page (not counting the title bar and footer). Fewer lines = bigger writing.' },
  { key: 'lp-text', type: 'slider', min: 14, max: 40, step: 1, def: 22, unit: 'px', name: 'Text size' },
  { key: 'lp-title', type: 'slider', min: 24, max: 80, step: 1, def: 48, unit: 'px', name: 'Title size' },
  { key: 'lp-title-drop', type: 'slider', min: 0, max: 1.2, step: 0.05, def: 0.8, name: 'Title position',
    desc: 'How far down the title sits in its bar, in lines. 0.8 = on the double line like handwriting; less lifts it off the line.' },
  { key: 'lp-hand', type: 'font', def: 'Patrick Hand', name: 'Handwriting font',
    desc: 'The writing on the page. The handwriting fonts download automatically; the last three must be installed on your computer.' },
  { key: 'lp-hand-title', type: 'font', def: 'Caveat', name: 'Title font' },
  { key: 'auto-break', type: 'toggle', cls: 'lp-no-auto-break', invert: true, def: true, name: 'Start a new page at every # title',
    desc: 'Every # title after the note\'s own title starts a new page and is that page\'s title, as if [!nextpage] were written above it.' },
  { key: 'links', type: 'toggle', cls: 'lp-link-underline', def: false, name: 'Underline links',
    desc: 'Links are shown in their colour only, like writing. Switch this on to underline them.' },

  { section: 'Pen and paper', desc: 'Make the page feel like writing by hand. Everything here shows in reading view, while editing and in the PDF.' },
  { key: 'pen', type: 'select', cls: 'lp-ink-', def: 'default', name: 'Pen',
    options: { default: 'Theme ink (Colours → Text)', ballpoint: 'Blue ballpoint', black: 'Black gel pen', fountain: 'Blue-black fountain pen', pencil: 'Pencil' },
    desc: 'The colour of all your writing. A colour set under Colours → Text wins.' },
  { key: 'lp-pen-weight', type: 'slider', min: 0, max: 1, step: 0.05, def: 0, unit: 'px', name: 'Pen thickness',
    desc: 'Thicker letters, as with a broader pen. It takes no room: every line breaks the same.' },
  { key: 'ink-soft', type: 'toggle', cls: 'lp-ink-soft', def: false, name: 'Ink soaks into the paper',
    desc: 'Soft letter edges, as with a fountain or gel pen.' },
  { key: 'wobble', type: 'toggle', cls: 'lp-wobble', def: false, name: 'Uneven handwriting',
    desc: 'Each line of writing sits a touch differently, as no hand writes two lines the same. Nothing moves to another line.' },
  { key: 'paper', type: 'select', cls: 'lp-paper-', def: 'white', name: 'Paper',
    options: { white: 'White', ivory: 'Ivory', cream: 'Cream', legal: 'Yellow legal pad', recycled: 'Recycled grey' },
    desc: 'The paper you write on (light theme; the PDF is printed on it too). A colour set under Colours → Paper wins.' },
  { key: 'heading', type: 'select', cls: 'lp-head-', def: 'line', name: 'Sub-heading underline',
    options: { line: 'A straight line', wavy: 'A wavy line', double: 'Two lines', dashed: 'A dashed line', none: 'None' },
    desc: 'How ## … ###### headings are underlined (in the heading pen colour: Colours → Heading underline).' },
  { key: 'heading-ink', type: 'toggle', cls: 'lp-head-ink', def: false, name: 'Sub-headings in the heading pen',
    desc: 'Write the headings themselves in the heading underline colour, not only their underline.' },
  { key: 'bullet', type: 'select', cls: 'lp-bullet-', def: 'dot', name: 'Bullets', desc: 'Points typed with - (and with * or +, unless they have their own below).',
    options: { dot: '• Dot', dash: '– Dash', arrow: '→ Arrow', hook: '↳ Arrow from the line above', circle: '∘ Small circle', star: '✱ Star' } },
  { key: 'bullet-star', type: 'select', cls: 'lp-star-', def: 'same', name: 'Bullets typed with *',
    options: { same: 'The same as Bullets', dot: '• Dot', dash: '– Dash', arrow: '→ Arrow', hook: '↳ Arrow from the line above', circle: '∘ Small circle', star: '✱ Star' },
    desc: 'A point typed with * instead of - gets this bullet, so one note can have several kinds: - point, * point, + point.' },
  { key: 'bullet-plus', type: 'select', cls: 'lp-plus-', def: 'same', name: 'Bullets typed with +',
    options: { same: 'The same as Bullets', dot: '• Dot', dash: '– Dash', arrow: '→ Arrow', hook: '↳ Arrow from the line above', circle: '∘ Small circle', star: '✱ Star' },
    desc: 'A point typed with + gets this bullet.' },
  { key: 'sub-bullet', type: 'select', cls: 'lp-sub-', def: 'same', name: 'Sub-point bullets',
    options: { same: 'The same as Bullets', hook: '↳ Arrow from the line above', arrow: '→ Arrow', dash: '– Dash', dot: '• Dot', circle: '∘ Small circle' },
    desc: 'The bullets of indented points (a list inside a list). ↳ comes down from the line above and points at the sub-point.' },
  { key: 'lp-bullet-ink', type: 'color', def: '#1f2937', name: 'Bullet colour', desc: 'Default: the colour of the writing.' },
  { key: 'checkbox', type: 'toggle', cls: 'lp-plain-checkbox', invert: true, def: true, name: 'Hand-drawn checkboxes',
    desc: 'Tasks (- [ ] and - [x]) get a box drawn with the pen, ticked in green.' },
  { key: 'strike', type: 'select', cls: 'lp-strike-', def: 'line', name: 'Crossed-out text (~~text~~)',
    options: { line: 'One line', scribble: 'Scribbled out', double: 'Two lines', red: 'A red line' } },
  { key: 'highlighter', type: 'select', cls: 'lp-hl-', def: 'yellow', name: 'Highlighter (==text==)',
    options: { yellow: 'Yellow', green: 'Green', pink: 'Pink', blue: 'Blue', orange: 'Orange' } },
  { key: 'arrows', type: 'select', cls: 'lp-arrows-', def: 'hand', name: 'Arrows',
    options: { hand: 'Hand-drawn', simple: 'Straight', bold: 'Bold (filled heads)', off: 'As typed (->)' },
    desc: 'Type -> <- <-> => <=> --> <-- or ~> in a note and it is drawn as an arrow in this style (=> double, --> long, ~> wavy).' },
  { key: 'lp-arrow-ink', type: 'color', def: '#1f2937', name: 'Arrow colour', desc: 'Default: the colour of the writing round it. An arrow you write in a pen colour (Pen: red …, with the cursor on the arrow) keeps that colour.' },
  { key: 'lp-mark', type: 'color', def: '#c0392b', name: 'Marking pen colour',
    desc: 'For the circles, boxes, underlines and scribbles of the "Pen: circle / box / underline …" commands. Default: the heading underline colour.' },

  { section: 'Cornell notes' },
  { key: 'cn-cue', type: 'slider', min: 0.15, max: 0.5, step: 0.01, def: 0.3, pct: true, name: 'Cue column width',
    desc: 'Share of the page for the cue column (left of the divider).' },
  { key: 'cn-summary-rows', type: 'slider', min: 3, max: 15, step: 1, def: 5, name: 'Summary height',
    desc: 'Lines the [!summary] takes at the bottom of the last page, its "Summary" label included.' },
  { key: 'cn-summary-min-rows', type: 'slider', min: 2, max: 5, step: 1, def: 3, name: 'Summary minimum height',
    desc: 'When the notes need the room, the summary shrinks, but never below this (or below its text). If that does not fit, it moves to a new page.' },
  { key: 'question-centre', type: 'toggle', cls: 'cn-question-centre', def: false, name: 'Centre the question across the page',
    desc: 'The text of [!question] in the middle of the line. Off: it starts on the left.' },
  { key: 'centre', type: 'toggle', cls: 'cn-wide-left', invert: true, def: true, name: 'Centre full-width lines',
    desc: 'The text of [!wide] in the middle of the page. Off: it starts on the left.' },
  { key: 'cn-wide-lines', type: 'slider', min: 1, max: 6, step: 1, def: 2, name: 'Full-width block lines',
    desc: 'Ruled lines a [!wide] block keeps at least. It grows with longer text.' },
  { key: 'cn-label-cue', type: 'text', def: 'Cues', quote: true, name: 'Cue column label' },
  { key: 'cn-label-notes', type: 'text', def: 'Notes', quote: true, name: 'Notes column label' },
  { key: 'labels', type: 'toggle', cls: 'cn-hide-page-labels', invert: true, def: true, name: 'Column labels on page 2, 3 ...',
    desc: 'Repeat the Cues | Notes labels under the header of every page.' },

  { section: 'Callouts', desc: 'Every callout except the Cornell ones (cue, notes, question, summary, wide).' },
  { key: 'lp-callout-height', type: 'slider', min: 0.5, max: 1, step: 0.01, def: 0.8, pct: true, name: 'Callout box height',
    desc: 'Height of a callout box, as a share of the ruled lines it spans. It is centred on them; its text is spaced to fit the box.' },
  { key: 'lp-callout-text', type: 'slider', min: 0.6, max: 1, step: 0.01, def: 0.9, pct: true, name: 'Callout text size',
    desc: 'As a share of the normal text size.' },

  { section: 'Colours', desc: 'Leave a colour on its default to follow the light / dark theme. A colour you set is used in both.' },
  { key: 'lp-paper', type: 'color', def: '#fffffe', name: 'Paper' },
  { key: 'lp-rule', type: 'color', def: '#c9ddf1', name: 'Ruled lines' },
  { key: 'lp-margin', type: 'color', def: '#f1a7b0', name: 'Red margin line and divider' },
  { key: 'lp-ink', type: 'color', def: '#1f2937', name: 'Text' },
  { key: 'lp-title-ink', type: 'color', def: '#111827', name: 'Title' },
  { key: 'lp-muted', type: 'color', def: '#4b5d85', name: 'Labels and date' },
  { key: 'lp-pen-red', type: 'color', def: '#c0392b', name: 'Heading underline' },
  { key: 'lp-desk', type: 'color', def: '#d9dde3', name: 'Desk behind the pages' },

  { section: 'Advanced', advanced: true, desc: 'Fine-tuning. The defaults match the PDF export; change these only if something does not fit.' },
  { key: 'lp-print-h', type: 'slider', min: 270, max: 297, step: 1, def: 290, unit: 'mm', name: 'Page height used',
    desc: 'If the last lines of a PDF page spill onto an extra page, lower this a little.' },
  { key: 'lp-print-scale', type: 'slider', min: 0.6, max: 1, step: 0.01, def: 0.88, pct: true, name: 'Text scale on the A4 page' },
  { key: 'lp-bar-lines', type: 'slider', min: 2, max: 5, step: 1, def: 3, name: 'Title bar height (lines)' },
  { key: 'lp-foot-ratio', type: 'slider', min: 0, max: 1, step: 0.01, def: 0.11, pct: true, name: 'Footer height',
    desc: 'Blank space at the bottom of each page, as a share of the title bar.' },
  { key: 'lp-sheet-gap', type: 'slider', min: 0, max: 80, step: 1, def: 24, unit: 'px', name: 'Gap between pages' },
  { key: 'lp-pad-x', type: 'slider', min: 40, max: 200, step: 1, def: 76, unit: 'px', name: 'Page margin (left)' },
  { key: 'lp-pad-r', type: 'slider', min: 20, max: 200, step: 1, def: 60, unit: 'px', name: 'Page margin (right)',
    desc: 'Space from the text to the right page edge. By default the red margin line\'s distance from the left edge, mirrored, so a double-sided page can be hole-punched on either side.' },
  { key: 'lp-margin-gap', type: 'slider', min: 6, max: 40, step: 1, def: 16, unit: 'px', name: 'Gap after the red margin line' },
  { key: 'lp-line', type: 'slider', min: 24, max: 60, step: 1, def: 36, unit: 'px', name: 'Line height without A4 pages',
    desc: 'Only used when "A4 pages in reading view" is off, and while editing.' },
  { key: 'lp-shift', type: 'slider', min: 0, max: 16, step: 1, def: 6, unit: 'px', name: 'Ruled line position',
    desc: 'How far the ruled line sits above the bottom of its row (where the text sits on it).' },
  { key: 'lp-callout-lift', type: 'slider', min: 0, max: 0.5, step: 0.01, def: 0, pct: true, name: 'Callout lift',
    desc: 'Moves callouts up by this share of a line.' },
  { key: 'cn-cue-narrow', type: 'slider', min: 0.2, max: 0.6, step: 0.01, def: 0.36, pct: true, name: 'Cue column width (narrow window, A4 pages off)' },
  { key: 'cn-gap', type: 'slider', min: 4, max: 40, step: 1, def: 16, unit: 'px', name: 'Space either side of the divider' },
  { key: 'cn-row-min', type: 'slider', min: 1, max: 6, step: 1, def: 2, name: 'Minimum lines per cue (separate callouts)' },
  { key: 'cn-label-size', type: 'slider', min: 0.6, max: 1, step: 0.01, def: 0.85, pct: true, name: 'Label size (Question, Summary, Cues, Notes)' },
  { key: 'cn-text-size', type: 'slider', min: 0.8, max: 1.3, step: 0.01, def: 1, pct: true, name: 'Cornell writing size' },
];

// the fonts offered in the font lists (lined-paper.css downloads the handwriting ones from Google Fonts)
const FONTS = ['Patrick Hand', 'Caveat', 'Kalam', 'Indie Flower', 'Shadows Into Light', 'Architects Daughter', 'Gloria Hallelujah', 'Handlee', 'Gochi Hand', 'Schoolbell', 'Coming Soon', 'Neucha', 'Reenie Beanie', 'Nanum Pen Script', 'Covered By Your Grace', 'Homemade Apple', 'Dancing Script', 'Comic Neue', 'Segoe Print', 'Bradley Hand', 'Comic Sans MS'];

// the CSS value for a stored setting
function cssValue(def, v) {
  if (def.type === 'slider') return def.unit ? v + def.unit : String(v);
  if (def.type === 'font') return '"' + String(v).replace(/"/g, '') + '"';
  if (def.type === 'text') return JSON.stringify(String(v));
  if (def.type === 'color' && def.rgb) {
    const n = parseInt(String(v).replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(', ');
  }
  return String(v);
}

const SEL_VIEW = '.markdown-reading-view .markdown-preview-view.lined-paper';

// a CSS length in px, worked out where the note's variables are. (A hidden element that stays in
// the note, never laid out, and the length read from its style: measuring with an element that is
// laid out made the browser lay the whole note out again for every value, seconds on a long note.)
function px(view, expr) {
  let p = view.__lpProbe;
  if (!p || p.parentNode !== view) {
    p = document.createElement('div');
    p.className = 'lp-probe';
    p.setAttribute('aria-hidden', 'true');
    p.style.setProperty('display', 'none', 'important');
    view.appendChild(p);
    view.__lpProbe = p;
  }
  p.style.letterSpacing = '';
  p.style.letterSpacing = expr;
  const v = p.style.letterSpacing ? parseFloat(getComputedStyle(p).letterSpacing) : 0;
  return Number.isFinite(v) ? Math.round(v * 64) / 64 : 0;   // (as the browser lays lengths out: in 1/64 px)
}
const rows = (view, name) => Math.round(px(view, 'calc(var(' + name + ') * 1px)'));

// The Cornell summary is positioned at the bottom of the page, out of the normal flow, so on its
// own nothing knows how many rows its text takes. Next to it goes an invisible copy that stays
// in the flow (cornell-notes.css: .cn-sum-sizer): it is exactly as tall as the summary's label +
// text, so the page breaks before the summary when it would not fit, and the summary is never
// made shorter than its text. Added here for reading view and by the post-processor for exports.
function addSummarySizer(root) {
  for (const sum of root.querySelectorAll('.callout[data-callout="summary"]')) {
    if (sum.closest('.lp-embed-unwrapped')) continue; // (an embed shown as a copy: the copy gets it)
    const host = sum.parentElement;
    if (!host || host.querySelector(':scope > .cn-sum-sizer')) continue;
    const copy = sum.cloneNode(true);
    copy.removeAttribute('style');
    copy.removeAttribute('data-callout');
    copy.removeAttribute('data-callout-metadata');
    copy.removeAttribute('data-callout-fold');
    copy.className = 'cn-sum-sizer';
    copy.setAttribute('aria-hidden', 'true');
    host.appendChild(copy);
  }
}

// `![[Note#^id]]` alone on its line, where the block is one callout (or one cue/notes group):
// Obsidian shows it as an embed (a small note inside the note, with its own frame). Instead show
// a copy of the callout straight in the page, exactly as if it had been written there, and hide
// the embed. The copy goes first in the block so it is laid out like any other callout.
// `undo` (reading view only) collects what to take away again before the next layout.
// A note title stays on one line in its usual place, low in the title bar. It runs under the date
// (which sits in the bar's top corner) up to the right margin. One a little too long for that is
// made smaller until it fits (down to TITLE_MIN of its size, lined-paper.css: h1.lp-title-fit);
// only a very long one goes on two lines instead (h1.lp-title-wrap), never cut off with "…".
// CSS can't tell whether text fits, so it is measured here: the title's width on one line, in
// units of its font size, at the A4 title size, against the room in an A4 title bar, so it holds
// for reading view and the PDF alike, whatever the window is like while the export is prepared.
// Then the title is put ON the bar's double line like handwriting: where a font's letters sit
// depends on the font, so the baseline is measured and the title moved down (or up) onto the line
// (--lp-title-adjust). "Title position" in the settings moves it from there.
const TITLE_MIN = 0.6;
// the width of a title's text on one line (a date written in it, <span class="paper-date">, sits in
// the bar's corner and doesn't count)
function titleWidth(h) {
  const tw = document.createTreeWalker(h, NodeFilter.SHOW_TEXT);
  const r = document.createRange();
  let left = Infinity, right = -Infinity;
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    if (!n.data.trim() || (n.parentElement && n.parentElement.closest('.paper-date'))) continue;
    r.selectNodeContents(n);
    const b = r.getBoundingClientRect();
    if (!b.width) continue;
    left = Math.min(left, b.left); right = Math.max(right, b.right);
  }
  return right > left ? right - left : 0;
}
function fitTitles(root, undo) {
  // (all titles are changed, then all measured, and so on: changing and measuring one title after
  // another made the browser lay the whole note out again for each)
  const all = [];
  for (const h of root.querySelectorAll('h1')) {
    const view = h.closest('.markdown-preview-view.lined-paper');
    if (!view || h.closest('.markdown-embed')) continue;
    const t = { h, view, had: h.classList.contains('lp-title-wrap'), hadFit: h.classList.contains('lp-title-fit'), hadAdjust: h.style.getPropertyValue('--lp-title-adjust') !== '' };
    h.classList.remove('lp-title-wrap', 'lp-title-fit');         // (measured on one line, full size)
    h.style.removeProperty('--lp-title-fit');
    h.style.removeProperty('--lp-title-adjust');
    all.push(t);
  }
  // 1. how wide each title is, against the room in the bar
  for (const t of all) {
    const { h, view } = t;
    const cs = getComputedStyle(h);
    const size = parseFloat(cs.fontSize);
    const textW = titleWidth(h);
    if (!size || !textW) { t.skip = true; continue; }
    if (document.body.classList.contains('lp-no-pages') && view.closest('.markdown-reading-view')) {
      // (no A4 pages: the bar is the pane's width)
      t.ratio = (h.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) / textW;
    } else {
      const room = px(view, '210mm') - px(view, 'var(--pad-x)') - px(view, 'var(--pad-r)');
      t.ratio = room / ((textW / size) * px(view, 'calc(var(--lp-title, 48px) * var(--print-scale))'));
    }
    t.want = px(view, 'calc(var(--line) * (var(--bar-lines) - 0.8 + var(--lp-title-drop, 0.8)))') - 7;
  }
  // 2. smaller, or on two lines; and a mark at the end of each, held on one line, for its baseline.
  // (Measured on the first line: an export is prepared in a window that is not A4 wide, so how it
  // wraps there says nothing. A two-line title's last line is one line lower.)
  for (const t of all) {
    if (t.skip) continue;
    const { h } = t;
    if (t.ratio >= 1) { /* fits */ }
    else if (t.ratio >= TITLE_MIN) {
      h.classList.add('lp-title-fit');
      h.style.setProperty('--lp-title-fit', String(Math.floor(t.ratio * 100) / 100));
      if (undo && !t.hadFit) undo.push({ t: 'cls', el: h, name: 'lp-title-fit' }, { t: 'prop', el: h, name: '--lp-title-fit' });
    } else {
      h.classList.add('lp-title-wrap');
      if (undo && !t.had) undo.push({ t: 'cls', el: h, name: 'lp-title-wrap' });
    }
    t.probe = document.createElement('span');
    t.probe.style.cssText = 'display:inline-block;width:0;height:0;';
    h.style.setProperty('white-space', 'nowrap', 'important');
    h.appendChild(t.probe);
  }
  // 3. where each baseline is
  for (const t of all) {
    if (t.skip) continue;
    t.base = t.probe.getBoundingClientRect().bottom - t.h.getBoundingClientRect().top;
    if (t.h.classList.contains('lp-title-wrap')) t.base += parseFloat(getComputedStyle(t.h).lineHeight);
  }
  // 4. onto the line: the (last line's) baseline on the top of the double line, 7px above the bar's end
  for (const t of all) {
    if (t.skip) continue;
    t.probe.remove();
    t.h.style.removeProperty('white-space');
    t.h.style.setProperty('--lp-title-adjust', (Math.round((t.want - t.base) * 4) / 4) + 'px');
    if (undo && !t.hadAdjust) undo.push({ t: 'prop', el: t.h, name: '--lp-title-adjust' });
  }
  fitQuestions(root, undo);
}

// The [!question]'s text is ONE line, under its label: it never wraps (cornell-notes.css); a
// question too long for the line is made smaller until it fits (--lp-q-fit). Measured like the title:
// in units of the font size, at the A4 sizes, against an A4 line (an export is prepared in a window
// that is not A4 wide); without A4 pages, against the line on screen.
function fitQuestions(root, undo) {
  // (all reset, then all measured, then all set: see fitTitles)
  const all = [];
  for (const c of root.querySelectorAll('.lined-paper .callout[data-callout="question"] > .callout-content')) {
    const view = c.closest('.markdown-preview-view.lined-paper');
    if (!view || c.closest('.markdown-embed:not(.lp-embed-copy)')) continue;
    all.push({ c, view, had: c.style.getPropertyValue('--lp-q-fit') !== '' });
    c.style.removeProperty('--lp-q-fit');
  }
  const width = (el) => { const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect().width; };
  for (const q of all) {
    const { c, view } = q;
    q.ratio = 1;
    for (const b of c.children) {
      const w = width(b);
      if (!w) continue;
      if (document.body.classList.contains('lp-no-pages') && view.closest('.markdown-reading-view')) {
        q.ratio = Math.min(q.ratio, b.clientWidth / w);
      } else {
        const text = px(view, 'calc(var(--lp-text, 22px) * var(--print-scale) * var(--text-size, 1))');
        const room = px(view, '210mm') - px(view, 'var(--pad-x)') - px(view, 'var(--pad-r)');
        q.ratio = Math.min(q.ratio, room / ((w / parseFloat(getComputedStyle(b).fontSize)) * text));
      }
    }
  }
  for (const q of all) {
    if (q.ratio < 1) {
      q.c.style.setProperty('--lp-q-fit', String(Math.floor(q.ratio * 100) / 100));
      if (undo && !q.had) undo.push({ t: 'prop', el: q.c, name: '--lp-q-fit' });
    }
  }
}

const SEL_EMBED = '.markdown-embed, .internal-embed';
const EMBED_SKIP = '.mod-header, .mod-footer, .markdown-preview-pusher, .embed-title, .markdown-embed-title, .markdown-embed-link, .cn-sum-sizer, .lp-embed-copy';
// The callout an embed shows, or null when it shows anything else too. Obsidian's wrappers around
// it (and empty paragraphs, e.g. the one of the ^block-id line) do not matter.
function embeddedCallout(emb) {
  const tops = Array.from(emb.querySelectorAll('.callout')).filter((c) => {
    const up = c.parentElement.closest('.callout');
    return !(up && emb.contains(up)) && !c.closest(EMBED_SKIP);
  });
  if (!tops.length) return null;
  // one callout, or one cue/notes group (callouts side by side in one quote)
  let el = tops[0];
  const bq = el.parentElement;
  if (bq && bq.tagName === 'BLOCKQUOTE' && emb.contains(bq) && tops.every((c) => c.parentElement === bq)) el = bq;
  else if (tops.length > 1) return null;
  // nothing else may show: no other text, picture, table, ...
  const w = document.createTreeWalker(emb, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n === el || (n.nodeType === 1 && n.matches(EMBED_SKIP)) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    if (n.nodeType === 3 ? n.textContent.trim() : n.matches('img, svg, video, audio, iframe, canvas, table, hr, input, .callout')) return null;
  }
  return el;
}
// A page block written in a quote of its own, `>> [!divider]` (as the cue / notes groups are
// written), is laid out like the plain `> [!divider]`: the plugin takes the callout out of its outer
// quote (reading view and the PDF). For [!divider], [!nextpage], [!wide], [!question], [!summary].
const PAGE_BLOCKS = ['divider', 'nextpage', 'wide', 'question', 'summary'];
function unwrapQuotedBlocks(root, undo) {
  for (const bq of root.querySelectorAll('blockquote')) {
    const kids = bq.children;
    if (kids.length !== 1 || !kids[0].matches('.callout') || !PAGE_BLOCKS.includes(kids[0].dataset.callout)) continue;
    if (!bq.parentElement || bq.parentElement.tagName !== 'DIV' || bq.parentElement.closest('.callout, .markdown-embed:not(.lp-embed-copy)')) continue;
    if (Array.from(bq.childNodes).some((n) => n.nodeType === 3 && n.data.trim())) continue;
    const c = kids[0];
    bq.replaceWith(c);
    if (undo) undo.push({ t: 'unq', bq, c });
  }
}

// Every `# Title` after the note's own title starts a new page and is that page's title, as if
// a [!nextpage] were written above it (unless one is). The plugin only marks the title's block
// (.lp-break-before): reading view is Obsidian's, built a piece at a time, and an element put in
// between its blocks made it lose its place (it jumped back to the top while scrolling).
// Off with "Start a new page at every # title" in the settings.
const breaksBefore = (b) => !!(b && b.classList.contains('lp-break-before'));
const nextPageBlock = (b) => !!(b && b.querySelector(':scope > .callout[data-callout="nextpage"]'));
function autoBreaks(root, undo) {
  const off = document.body.classList.contains('lp-no-auto-break');
  for (const h of root.querySelectorAll('.lined-paper h1')) {
    const block = h.parentElement;
    const view = h.closest('.markdown-preview-view');
    if (!block || !view || block.tagName !== 'DIV' || h.closest('.markdown-embed, .callout')) continue;
    const want = !off && view.querySelector('h1') !== h && !nextPageBlock(block.previousElementSibling);   // (not the note's own title)
    if (want === breaksBefore(block)) continue;
    block.classList.toggle('lp-break-before', want);
    if (want && undo) undo.push({ t: 'cls', el: block, name: 'lp-break-before' });
  }
}

// A [!summary] written before a [!nextpage] belongs to the part of the note above it: it goes on the
// bottom rows of THAT page (not with the summary at the end of the note). The plugin's own pages place
// it themselves (paginate); for the PDF and the browser's own pages it is tied, with anchors named for
// it alone, to the content above it and to the first block after the page break: its top is the
// last --summary-rows rows of that page (or one blank line under the content, if lower), its bottom
// the end of that page's writing (the start of the next page's body, less the header and footer).
let midSummaries = 0;
// Each part of a note (up to a [!nextpage], or a `# Title` that starts a new page) is a page of its
// own: a summary anywhere in it (its own block, or written inside the part's last group) belongs at
// the bottom of that part's last page.
const topBlock = (el) => {
  let b = el;
  while (b.parentElement && !b.parentElement.matches('.markdown-preview-section, .markdown-preview-view, .print')) b = b.parentElement;
  return b;
};
const breakAfter = (b) => {
  for (let n = b && b.nextElementSibling; n; n = n.nextElementSibling) if (nextPageBlock(n) || breaksBefore(n)) return n;
  return null;
};
const isMidSummary = (sum) => !!breakAfter(topBlock(sum));
// the last of a part's content before a page break (a group: its cue and its notes), not counting
// a summary written in a block of its own
function partEnd(brk) {
  for (let p = brk.previousElementSibling; p; p = p.previousElementSibling) {
    if (p.matches('.lp-sheet, .lp-hdr, .markdown-preview-pusher, .mod-header, .metadata-container') || p.querySelector(':scope > .callout[data-callout="summary"]')) continue;
    if (!p.textContent.trim() && !p.querySelector('img')) continue;
    const cols = p.querySelectorAll(':scope > blockquote > .callout:is([data-callout="cue"], [data-callout="notes"])');
    return cols.length ? Array.from(cols) : [p];
  }
  return [];
}
function anchorMidSummaries(root, undo) {
  for (const sum of root.querySelectorAll('.lined-paper.cornell .callout[data-callout="summary"], .lined-paper .cornell .callout[data-callout="summary"]')) {
    if (sum.closest('.markdown-embed:not(.lp-embed-copy)')) continue;
    const brk = breakAfter(topBlock(sum));
    if (!brk) continue;
    const after = nextPageBlock(brk) ? brk.nextElementSibling : brk;
    const above = partEnd(brk);
    if (!above.length || !after) continue;
    const n = sum.dataset.lpMid || String(++midSummaries);
    const set = (el, name, val) => {
      if (undo && el.style.getPropertyValue(name) === '') undo.push({ t: 'prop', el, name });
      el.style.setProperty(name, val, 'important');
    };
    if (!sum.dataset.lpMid) { sum.dataset.lpMid = n; if (undo) undo.push({ t: 'attr', el: sum, name: 'data-lp-mid' }); }
    const own = (el, names) => {
      const has = getComputedStyle(el).anchorName;
      const keep = has && has !== 'none' ? has.split(',').map((x) => x.trim()).filter((x) => !x.startsWith(`--lp-sum-`)) : [];
      return [...keep, ...names].join(', ');
    };
    // (two anchors above: the bottom of the cue and of the notes, whichever is lower)
    set(above[0], 'anchor-name', own(above[0], above.length > 1 ? [`--lp-sum-above-${n}`] : [`--lp-sum-above-${n}`, `--lp-sum-above2-${n}`]));
    if (above.length > 1) set(above[above.length - 1], 'anchor-name', own(above[above.length - 1], [`--lp-sum-above2-${n}`]));
    set(after, 'anchor-name', own(after, [`--lp-sum-next-${n}`]));
    set(sum, 'top', `max(calc(anchor(--lp-sum-next-${n} top) - var(--lp-break-gap) - var(--line) * var(--summary-rows)), calc(max(anchor(--lp-sum-above-${n} bottom), anchor(--lp-sum-above2-${n} bottom)) + var(--line)))`);
    set(sum, 'bottom', `calc(anchor(--lp-sum-next-${n} top) + var(--lp-break-gap))`);
  }
}

// A [!summary] written inside a cue or the notes (`>> > [!summary]`) is laid out as one written in
// the group after them: the plugin moves it there (reading view and the PDF), so it goes on the
// bottom lines of the page like any other, and the notes don't hold the room it keeps.
function liftSummaries(root, undo) {
  for (const sum of root.querySelectorAll('.callout:is([data-callout="cue"], [data-callout="notes"]) > .callout-content .callout[data-callout="summary"]')) {
    if (sum.closest('.markdown-embed:not(.lp-embed-copy)')) continue;
    const col = sum.parentElement.closest('.callout:is([data-callout="cue"], [data-callout="notes"])');
    const bq = col && col.parentElement;
    if (!bq || bq.tagName !== 'BLOCKQUOTE') continue;
    const mark = document.createComment('lp-summary');
    sum.replaceWith(mark);
    bq.appendChild(sum);
    if (undo) undo.push({ t: 'lift', sum, mark });
  }
}

// An embedded block's text starts on the embed's own line: the `![[Note#^id]]` line itself takes
// no room. Its first line goes straight under whatever is written above it in the same column or
// block (or on that column's first line, when nothing is), whatever sits in between: something of
// Obsidian's inside the embed (spacing, an empty element where the hidden title was), or outside it
// (an empty line, a line break or an invisible character before the embed). The embed is pulled up
// by that much (--lp-embed-pull: lined-paper.css). All measured first, then all set.
const VISIBLE = /[^\s​-‍⁠﻿]/;
const EMBED_HIDDEN = '.markdown-embed-title, .embed-title, .markdown-embed-link, .mod-header, .mod-footer, .markdown-preview-pusher, .cn-sum-sizer, .lp-probe, .callout-title';
// the rows a node's writing takes: [top of its first row, bottom of its last row], or null
function writtenRows(n) {
  if (n.nodeType === 3) {
    if (!VISIBLE.test(n.data)) return null;
    const r = document.createRange();
    r.selectNodeContents(n);
    const rects = Array.from(r.getClientRects()).filter((b) => b.height);
    if (!rects.length) return null;
    const lh = parseFloat(getComputedStyle(n.parentElement).lineHeight) || rects[0].height;
    const first = rects[0], last = rects[rects.length - 1];
    return [first.top - (lh - first.height) / 2, last.bottom + (lh - last.height) / 2];
  }
  if (!n.matches('img, table, tr, hr, input, svg, .math, mjx-container, .callout')) return null;
  const b = n.getBoundingClientRect();
  return b.height ? [b.top, b.bottom] : null;
}
function alignEmbeds(root, undo) {
  const embeds = Array.from(root.querySelectorAll('.internal-embed[src*="#^"]'))
    .filter((e) => e.closest('.lined-paper, .print') && !e.closest('.lp-embed-unwrapped') && !e.parentElement.closest('.internal-embed') && e.getClientRects().length);
  for (const e of embeds) e.style.removeProperty('--lp-embed-pull');
  const walk = (el, f, skip) => {
    const tw = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.nodeType === 1 && (n === skip || n.matches(EMBED_HIDDEN)) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    for (let n = tw.nextNode(); n; n = tw.nextNode()) if (f(n) === false) return;
  };
  const pulls = embeds.map((e) => {
    // where its writing starts now
    let first = null;
    walk(e, (n) => { const r = writtenRows(n); if (r) { first = r[0]; return false; } return true; });
    if (first === null) return 0;
    // where it should start: under the writing above it in its column / block, or at the top of that
    const box = e.parentElement.closest('.callout-content, .markdown-preview-section > div, .markdown-preview-view > div, li, td, th') || e.parentElement;
    const bb = box.getBoundingClientRect(), cs = getComputedStyle(box);
    let want = bb.top + (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.paddingTop) || 0);
    walk(box, (n) => {
      if (n.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_PRECEDING) return false;   // (past the embed)
      if (n.nodeType === 1 && n.contains(e)) return true;                                   // (around it)
      const r = writtenRows(n);
      if (r) want = Math.max(want, r[1]);
      return true;
    }, e);
    return Math.round(first - want);
  });
  embeds.forEach((e, i) => {
    if (pulls[i] > 1) {
      e.style.setProperty('--lp-embed-pull', -pulls[i] + 'px');
      if (undo) undo.push({ t: 'prop', el: e, name: '--lp-embed-pull' });
    }
  });
}

// An embedded callout (the copy shown for `![[Note#^callout]]`) that is the first thing written in its
// column (the notes, a cue, [!wide], a block of the note) starts on that column's first line, exactly
// where the same callout typed there would: anything of Obsidian's that takes a line above it (an
// empty line, a line break, an element where the embed was) is not counted. Measured, then set: the
// whole rows it sits too low are taken off its top margin.
function alignEmbedCopies(root, undo) {
  // (not a summary: that goes to the bottom of its page; nor anything else placed on its own)
  const copies = Array.from(root.querySelectorAll('.lp-embed-copy')).filter((c) => c.getClientRects().length && !c.parentElement.closest('.lp-embed-copy') &&
    !c.matches('[data-callout="summary"], [data-callout="nextpage"], [data-callout="divider"]') && !/absolute|fixed/.test(getComputedStyle(c).position));
  for (const c of copies) if (c._lpPull) { c.style.removeProperty('margin-top'); c._lpPull = 0; }
  const L = copies.length ? px(copies[0].closest('.lined-paper, .print') || root, 'var(--line)') : 0;
  if (!(L > 4)) return;
  const plans = copies.map((c) => {
    const box = c.parentElement.closest('.callout-content, li, .markdown-preview-section > div, .markdown-preview-view > div');
    if (!box) return 0;
    // (only when nothing is written above it in its column)
    let before = false;
    const tw = document.createTreeWalker(box, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n === c || (n.nodeType === 1 && n.matches(EMBED_HIDDEN + ', .lp-embed-unwrapped')) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      if (n.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_PRECEDING) break;   // (past it)
      if (n.nodeType === 1 && n.contains(c)) continue;
      if (writtenRows(n)) { before = true; break; }
    }
    if (before) return 0;
    const b = box.getBoundingClientRect(), cs = getComputedStyle(box);
    const top = b.top + (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.paddingTop) || 0);
    // (a callout's box sits a little above its first line: whole rows lower than that are too low)
    const rows = Math.floor((c.getBoundingClientRect().top - top) / L + 0.5);
    return rows >= 1 ? { margin: parseFloat(getComputedStyle(c).marginTop) || 0, pull: rows * L } : 0;
  });
  copies.forEach((c, i) => {
    const p = plans[i];
    if (!p) return;
    c.style.setProperty('margin-top', p.margin - p.pull + 'px', 'important');
    c._lpPull = p.pull;
    if (undo) undo.push({ t: 'prop', el: c, name: 'margin-top' });
  });
}

// A table written with an empty header row (Markdown needs one, so `| | |` over `|---|---|` is how
// a table without a header is written) has no header on the page: that row takes no line, and the
// table's first row is on the line the table starts on (reading view and the PDF; lined-paper.css:
// thead.lp-empty-head). An empty <th></th> is caught by the CSS alone; this also catches a header
// holding only spaces or a <br>.
function markEmptyHeads(root, undo) {
  for (const head of root.querySelectorAll('thead')) {
    if (head.classList.contains('lp-empty-head')) continue;
    if (head.textContent.trim() || head.querySelector('img, svg, input, .internal-embed, .math, mjx-container')) continue;
    head.classList.add('lp-empty-head');
    if (undo) undo.push({ t: 'cls', el: head, name: 'lp-empty-head' });
  }
}

// The `![[Note#^id]]` line itself takes no room: an embed is a block of its own, which already ends
// its line, so the line break after it (a <br>, or the newline in the notes' Enter-is-a-new-line text)
// would add an empty line under it. That break is left out (reading view and the PDF).
function tidyEmbedLines(root, undo) {
  for (const e of root.querySelectorAll('.internal-embed[src*="#^"], .lp-embed-copy')) {
    if (e.closest('.markdown-embed:not(.lp-embed-copy) .markdown-embed')) continue;
    let n = e.nextSibling;
    while (n && n.nodeType === 3 && /^[ \t]*$/.test(n.data)) n = n.nextSibling;   // (spaces only)
    if (!n) continue;
    if (n.nodeType === 1 && n.tagName === 'BR' && n.style.display !== 'none') {
      n.style.setProperty('display', 'none', 'important');
      if (undo) undo.push({ t: 'prop', el: n, name: 'display' });
    } else if (n.nodeType === 3 && /^[ \t]*\n/.test(n.data)) {
      const was = n.data;
      n.data = n.data.replace(/^[ \t]*\n/, '');
      if (undo) undo.push({ t: 'text', node: n, data: was });
    }
  }
}

function unwrapCalloutEmbeds(root, undo) {
  for (const emb of root.querySelectorAll(SEL_EMBED)) {
    if (emb.closest('.lp-embed-unwrapped') || emb.parentElement.closest(SEL_EMBED)) continue;
    // the line the embed is on: its paragraph, wherever it is (top level, inside [!notes] or a
    // [!cue], another callout, a list item, ...)
    const line = emb.parentElement.closest('p') ||
      emb.parentElement.closest('li, .callout-content, .markdown-preview-section > div, .markdown-preview-view > div');
    if (!line) continue;
    // only an embed that is alone on its line (a summary's invisible copy from an earlier layout aside)
    const sizer = (n) => n.nodeType === 1 && n.matches('.cn-sum-sizer');
    const other = Array.from(line.querySelectorAll('*')).some((n) => !n.contains(emb) && !emb.contains(n) && n.tagName !== 'BR' && !n.closest('.cn-sum-sizer')) ||
      Array.from(line.childNodes).filter((n) => !sizer(n)).map((n) => n.textContent).join('').trim() !== emb.textContent.trim();
    if (other) continue;
    const src = embeddedCallout(emb);
    if (!src) continue;
    const copy = src.cloneNode(true);
    copy.classList.add('lp-embed-copy');
    for (const s of copy.querySelectorAll('.cn-sum-sizer')) s.remove();
    // a colour put around the embed (<font color="...">, <span style="color: ...">) colours the copy's text
    for (let n = emb.parentElement; n && n !== line.parentElement; n = n.parentElement) {
      const c = n.getAttribute('color') || n.style.color;
      if (c) { copy.style.color = c; break; }
    }
    let hidden;
    if (line.tagName === 'P') {
      // the copy takes the paragraph's place: first in a block of the note, as a typed callout is;
      // inside a callout just after the paragraph, so a callout that was the last thing in it still is
      for (const s of line.parentElement.querySelectorAll(':scope > .cn-sum-sizer')) s.remove(); // (made again for the copy)
      if (line.parentElement.matches('.markdown-preview-section > div, .markdown-preview-view > div')) line.before(copy);
      else line.after(copy);
      hidden = [line];
    } else {
      for (const s of line.querySelectorAll(':scope > .cn-sum-sizer')) s.remove();
      hidden = Array.from(line.children);
      line.prepend(copy);
    }
    if (undo) undo.push({ t: 'el', el: copy });
    for (const h of hidden) {
      h.classList.add('lp-embed-unwrapped');
      if (undo) undo.push({ t: 'cls', el: h, name: 'lp-embed-unwrapped' });
    }
  }
}

// ---------- bullets by the character typed: -  *  + ----------
// Markdown lists can start with -, * or +, and Obsidian shows them all alike. Each gets its own bullet
// here (Settings → Pen and paper: Bullets, Bullets typed with *, Bullets typed with +): every list
// item is marked lp-mark-dash / lp-mark-star / lp-mark-plus by the character it was typed with,
// found in the note's source (reading view and the PDF: the source Obsidian hands a post-processor;
// while editing: an editor extension marks the line).
const BULLET_LINE = /^\s*(?:>\s*)*([-*+])[ \t]/;
const RULE_LINE = /^\s*(?:>\s*)*([-*_])(?:[ \t]*\1){2,}[ \t]*$/;   // (---, ***: a rule, not a bullet)
const MARK_CLASS = { '-': 'lp-mark-dash', '*': 'lp-mark-star', '+': 'lp-mark-plus' };
function markBullets(el, ctx) {
  let info = null;
  try { info = ctx && ctx.getSectionInfo && ctx.getSectionInfo(el); } catch (e) { info = null; }
  if (!info || typeof info.text !== 'string') return;
  const marks = [];
  let fence = false;
  for (const l of info.text.split('\n').slice(info.lineStart, info.lineEnd + 1)) {
    if (/^\s*(?:>\s*)*(```|~~~)/.test(l)) { fence = !fence; continue; }
    if (fence || RULE_LINE.test(l)) continue;
    const m = BULLET_LINE.exec(l);
    if (m) marks.push(m[1]);
  }
  // (each bullet item in order; only when they pair up one to one)
  const lis = Array.from(el.querySelectorAll('ul > li')).filter((li) => !li.closest('.internal-embed, .markdown-embed, .lp-embed-copy'));
  if (!lis.length || lis.length !== marks.length) return;
  lis.forEach((li, i) => {
    for (const c of Object.values(MARK_CLASS)) if (c !== MARK_CLASS[marks[i]]) li.classList.remove(c);
    li.classList.add(MARK_CLASS[marks[i]]);
  });
}
// editing view: each list line marked by its bullet character (not in code)
function bulletEditorExtension() {
  let V, S, Lang;
  try { V = require('@codemirror/view'); S = require('@codemirror/state'); } catch (e) { return null; }
  try { Lang = require('@codemirror/language'); } catch (e) { Lang = null; }
  if (!V || !V.ViewPlugin || !V.Decoration || !S || !S.RangeSetBuilder) return null;
  const deco = Object.fromEntries(Object.entries(MARK_CLASS).map(([k, c]) => [k, V.Decoration.line({ class: c })]));
  const inCode = (state, pos) => {
    if (!Lang || !Lang.syntaxTree) return false;
    for (let n = Lang.syntaxTree(state).resolveInner(pos, 1); n; n = n.parent) if (/codeblock|code-block|fenced/i.test(n.type.name)) return true;
    return false;
  };
  const build = (view) => {
    const b = new S.RangeSetBuilder();
    if (!view.dom.closest('.lined-paper')) return b.finish();
    let seen = -1;
    for (const { from, to } of view.visibleRanges) {
      for (let pos = from; pos <= to;) {
        const line = view.state.doc.lineAt(pos);
        pos = line.to + 1;
        if (line.from <= seen) continue;
        seen = line.from;
        const m = BULLET_LINE.exec(line.text);
        if (m && !RULE_LINE.test(line.text) && !inCode(view.state, line.from)) b.add(line.from, line.from, deco[m[1]]);
      }
    }
    return b.finish();
  };
  return V.ViewPlugin.fromClass(class {
    constructor(view) { this.decorations = build(view); }
    update(u) { if (u.docChanged || u.viewportChanged) this.decorations = build(u.view); }
  }, { decorations: (v) => v.decorations });
}

// ---------- arrows: ->  <-  <->  =>  <=>  -->  <--  ~> ----------
// Typed in a note, each is drawn as an arrow (lined-paper.css "ARROWS"): in reading view and the PDF
// the text is put in a <span class="lp-arrow"> holding the drawing and, hidden, the typed text (so it
// still copies as typed); while editing, an editor extension shows the same drawing. Never in code.
const ARROW_RE = /<=>|<->|<--|-->|<-|->|=>|~>/g;
const ARROW_KIND = { '->': 'r', '<-': 'l', '<->': 'lr', '=>': 'dr', '<=>': 'dlr', '-->': 'long', '<--': 'longl', '~>': 'wave' };
const ARROW_SKIP = 'code, pre, kbd, samp, script, style, textarea, svg, .math, mjx-container, .lp-arrow, .cm-editor, .metadata-container, .frontmatter-container';
function arrowEl(src) {
  const kind = ARROW_KIND[src];
  const s = document.createElement('span');
  s.className = 'lp-arrow';
  s.dataset.arrow = kind;
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', /long/.test(kind) ? '0 0 36 12' : '0 0 24 12');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  for (const c of ['lp-a1', 'lp-a2', 'lp-a3']) {
    const p = document.createElementNS(svgNS, 'path');
    p.setAttribute('class', c);
    svg.appendChild(p);
  }
  const t = document.createElement('span');
  t.className = 'lp-arrow-src';
  t.textContent = src;
  s.append(svg, t);
  return s;
}
function drawArrows(root) {
  const nodes = [];
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    ARROW_RE.lastIndex = 0;
    if (!ARROW_RE.test(n.data)) continue;
    const p = n.parentElement;
    if (!p || p.closest(ARROW_SKIP)) continue;
    nodes.push(n);
  }
  for (const n of nodes) {
    const frag = document.createDocumentFragment();
    let last = 0;
    ARROW_RE.lastIndex = 0;
    for (let m; (m = ARROW_RE.exec(n.data));) {
      if (m.index > last) frag.appendChild(document.createTextNode(n.data.slice(last, m.index)));
      frag.appendChild(arrowEl(m[0]));
      last = m.index + m[0].length;
    }
    if (last < n.data.length) frag.appendChild(document.createTextNode(n.data.slice(last)));
    n.replaceWith(frag);
  }
}
// editing view: each arrow shown drawn, its text again while the cursor is on it (not in code)
function arrowEditorExtension() {
  let V, S, Lang;
  try { V = require('@codemirror/view'); S = require('@codemirror/state'); } catch (e) { return null; }
  try { Lang = require('@codemirror/language'); } catch (e) { Lang = null; }
  if (!V || !V.ViewPlugin || !V.Decoration || !V.WidgetType || !S || !S.RangeSetBuilder) return null;
  class ArrowWidget extends V.WidgetType {
    constructor(src) { super(); this.src = src; }
    eq(o) { return o.src === this.src; }
    toDOM() { return arrowEl(this.src); }
  }
  const inCode = (state, pos) => {
    if (!Lang || !Lang.syntaxTree) return false;
    for (let n = Lang.syntaxTree(state).resolveInner(pos, 1); n; n = n.parent) if (/code|math|comment|url|html/i.test(n.type.name)) return true;
    return false;
  };
  const off = () => document.body.classList.contains('lp-arrows-off');
  const build = (view) => {
    const b = new S.RangeSetBuilder();
    if (off() || !view.dom.closest('.lined-paper') || !view.dom.closest('.is-live-preview')) return b.finish();
    const sel = view.state.selection.ranges;
    let seen = -1;
    for (const { from, to } of view.visibleRanges) {
      for (let pos = from; pos <= to;) {
        const line = view.state.doc.lineAt(pos);
        pos = line.to + 1;
        if (line.from <= seen) continue;
        seen = line.from;
        ARROW_RE.lastIndex = 0;
        for (let m; (m = ARROW_RE.exec(line.text));) {
          const a = line.from + m.index, z = a + m[0].length;
          if (sel.some((r) => r.from <= z && r.to >= a) || inCode(view.state, a)) continue;
          b.add(a, z, V.Decoration.replace({ widget: new ArrowWidget(m[0]) }));
        }
      }
    }
    return b.finish();
  };
  return V.ViewPlugin.fromClass(class {
    constructor(view) { this.off = off(); this.decorations = build(view); }
    update(u) {
      const o = off();
      if (u.docChanged || u.viewportChanged || u.selectionSet || o !== this.off) { this.off = o; this.decorations = build(u.view); }
    }
  }, { decorations: (v) => v.decorations });
}

// ---------- coloured text: <font color="..."> ... </font>, <span style="color: ..."> ... </span> ----------
// Obsidian does not turn a [[link]] inside such a tag into a link everywhere (it can come out as
// plain text, or not at all). The plugin shows the text in its colour with the link working: in
// editing view through an editor extension, in reading view and the PDF by rebuilding the tag.
const COLOUR_RE = /<font\b[^>]*?\bcolor\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>(.*?)<\/font\s*>|<span\b([^>]*)>(.*?)<\/span\s*>|<mark\b([^>]*)>(.*?)<\/mark\s*>/gi;
// a pen mark: <span class="pen-circle"> (box, underline, wavy, scribble)
const PEN_CLASS_RE = /\bclass\s*=\s*(?:"[^"]*?\b(pen-(?:circle|box|underline|wavy|scribble))\b[^"]*"|'[^']*?\b(pen-(?:circle|box|underline|wavy|scribble))\b[^']*')/i;
const SAFE_COLOUR = /^[#\w(),.%\s-]+$/;
// every coloured run in one line of source: where it is, where its text is, its colour
function colourRuns(text) {
  const out = [];
  COLOUR_RE.lastIndex = 0;
  for (let m; (m = COLOUR_RE.exec(text));) {
    let colour = '', inner, mark = '';
    if (m[4] !== undefined) { colour = m[1] ?? m[2] ?? m[3]; inner = m[4]; }
    else if (m[8] !== undefined) {
      // <mark class="hl-pink">: a highlighter of that colour
      const h = /\bclass\s*=\s*["'][^"']*?\b(hl-(?:yellow|green|pink|blue|orange))\b/i.exec(m[7]);
      if (!h) continue;
      mark = 'cm-highlight ' + h[1].toLowerCase(); inner = m[8];
    } else {
      const st = /\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(m[5]);
      const c = st && /(?:^|;)\s*color\s*:\s*([^;]+)/i.exec(st[1] ?? st[2] ?? '');
      const p = PEN_CLASS_RE.exec(m[5]);
      if (!c && !p) continue;
      if (c) colour = c[1].trim();
      if (p) mark = (p[1] || p[2]).toLowerCase();
      inner = m[6];
    }
    if (colour && !SAFE_COLOUR.test(colour)) continue;
    const innerFrom = m.index + m[0].indexOf('>') + 1;
    out.push({ from: m.index, to: m.index + m[0].length, innerFrom, innerTo: innerFrom + inner.length, colour, inner, mark });
  }
  return out;
}
const LINK_RE = /(!?)\[\[([^\[\]|]+?)(?:\|([^\[\]]*))?\]\]/g;
// what Obsidian shows for a link: its alias, or "note > heading"
function linkLabel(target, alias) {
  if (alias) return alias;
  const [file, ...sub] = target.split('#');
  return sub.length ? [file, ...sub.filter(Boolean)].filter(Boolean).join(' > ') : file;
}
// fill `parent` with `inner` (the source between the tags): text, **bold**, and [[links]]
function fillColoured(parent, inner, open) {
  const text = (str) => {
    str.split(/(\*\*[^*]+\*\*)/).forEach((part) => {
      if (!part) return;
      if (/^\*\*[^*]+\*\*$/.test(part)) {
        const b = document.createElement('strong');
        b.textContent = part.slice(2, -2);
        parent.appendChild(b);
      } else parent.appendChild(document.createTextNode(part));
    });
  };
  let last = 0;
  LINK_RE.lastIndex = 0;
  for (let m; (m = LINK_RE.exec(inner));) {
    text(inner.slice(last, m.index));
    last = m.index + m[0].length;
    if (m[1]) { text(m[0]); continue; } // (an embed: left as it is)
    const a = document.createElement('a');
    a.className = 'internal-link';
    a.setAttribute('data-href', m[2]);
    a.setAttribute('href', m[2]);
    a.textContent = linkLabel(m[2], m[3]);
    if (open) {
      // (mousedown: in editing view the editor would otherwise move the cursor into the tag first)
      a.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); });
      a.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); open(m[2], e); });
    }
    parent.appendChild(a);
  }
  text(inner.slice(last));
  drawArrows(parent);   // (an arrow in a colour: drawn, in that colour)
}
// reading view / PDF: a coloured tag whose [[link]] did not come out as a link is rebuilt from the
// note's source (or from its own text, when the link was left there as plain text)
function fixColouredLinks(el, ctx, open) {
  const tags = Array.from(el.querySelectorAll('font[color], span[style*="color"]'));
  if (!tags.length) return;
  let runs = [];
  try {
    const info = ctx && ctx.getSectionInfo && ctx.getSectionInfo(el);
    if (info) runs = colourRuns(info.text.split('\n').slice(info.lineStart, info.lineEnd + 1).join('\n')).filter((r) => r.colour);
  } catch (e) { /* no source: use the tag's own text */ }
  tags.forEach((tag, i) => {
    if (tag._lpFixed || tag.querySelector('a, .internal-embed')) return;
    const run = runs.length === tags.length ? runs[i] : null;
    let inner = run && /\[\[/.test(run.inner) ? run.inner : null;
    if (inner === null && /\[\[[^\]]+\]\]/.test(tag.textContent)) inner = tag.textContent;
    if (inner === null || /!\[\[/.test(inner)) return;
    tag.textContent = '';
    fillColoured(tag, inner, open);
    tag._lpFixed = true;
  });
}
// editing view: an editor extension (CodeMirror 6) that shows each coloured tag as its coloured
// text, links working, and the source again while the cursor is in it
function colourEditorExtension(plugin) {
  let V, S;
  try { V = require('@codemirror/view'); S = require('@codemirror/state'); } catch (e) { return null; }
  if (!V || !V.ViewPlugin || !V.Decoration || !V.WidgetType || !S || !S.RangeSetBuilder || !S.Prec) return null;
  let infoField = null;
  try { infoField = require('obsidian').editorInfoField || null; } catch (e) { /* older Obsidian */ }
  const open = (view) => (href, e) => {
    let path = '';
    try { const info = infoField && view.state.field(infoField, false); path = (info && info.file && info.file.path) || ''; } catch (err) { /* */ }
    plugin.app.workspace.openLinkText(href, path, !!(e && (e.ctrlKey || e.metaKey)));
  };
  class ColourWidget extends V.WidgetType {
    constructor(run, opener) { super(); this.run = run; this.opener = opener; }
    eq(o) { return o.run.colour === this.run.colour && o.run.inner === this.run.inner && o.run.mark === this.run.mark; }
    toDOM() {
      const s = document.createElement('span');
      s.className = 'lp-colour' + (this.run.mark ? ' ' + this.run.mark : '');
      if (this.run.colour) s.style.color = PEN_VAR[this.run.colour.toLowerCase()] || this.run.colour;
      fillColoured(s, this.run.inner, this.opener);
      return s;
    }
    ignoreEvent(e) { return !!(e.target && e.target.closest && e.target.closest('a')); }
  }
  const build = (view) => {
    const b = new S.RangeSetBuilder();
    if (!view.dom.closest('.lined-paper')) return b.finish();
    const live = !!view.dom.closest('.is-live-preview');
    const sel = view.state.selection.ranges;
    const opener = open(view);
    let seen = -1;
    for (const { from, to } of view.visibleRanges) {
      for (let pos = from; pos <= to;) {
        const line = view.state.doc.lineAt(pos);
        pos = line.to + 1;
        if (line.from <= seen) continue;
        seen = line.from;
        for (const r of colourRuns(line.text)) {
          const a = line.from + r.from, z = line.from + r.to;
          if (live && !sel.some((s) => s.from <= z && s.to >= a)) {
            b.add(a, z, V.Decoration.replace({ widget: new ColourWidget(r, opener) }));
          } else if (r.innerTo > r.innerFrom) {
            b.add(line.from + r.innerFrom, line.from + r.innerTo, V.Decoration.mark({ class: 'lp-colour' + (r.mark ? ' ' + r.mark : ''), attributes: r.colour ? { style: 'color: ' + r.colour } : {} }));
          }
        }
      }
    }
    return b.finish();
  };
  return S.Prec.highest(V.ViewPlugin.fromClass(class {
    constructor(view) { this.on = !!view.dom.closest('.lined-paper'); this.decorations = build(view); }
    update(u) {
      const on = !!u.view.dom.closest('.lined-paper');
      if (u.docChanged || u.viewportChanged || u.selectionSet || on !== this.on) { this.on = on; this.decorations = build(u.view); }
    }
  }, { decorations: (v) => v.decorations }));
}

// whether a batch of DOM changes changed the note (not just moved blocks that are already there)
function changedNote(recs) {
  const added = new Set(), removed = new Set();
  for (const r of recs) {
    if (r.type !== 'childList') return true;
    for (const n of r.removedNodes) { if (added.has(n)) added.delete(n); else removed.add(n); }
    for (const n of r.addedNodes) { if (removed.has(n)) removed.delete(n); else added.add(n); }
  }
  // what is left: nodes that really came or went (a node moved within the note shows up in both)
  const real = (n) => !(n.nodeType === 3 && !n.textContent.trim()) && !(n.nodeType === 1 && n.matches('.lp-sheet, .lp-hdr, .lp-auto-break, .lp-probe, .lp-prop-date'));
  return [...added].some(real) || [...removed].some(real);
}

// Obsidian puts its blocks back next to each other as it builds and rebuilds a long note: the rest
// of a block continued on the next sheet (.lp-cont) can end up further down, after other blocks,
// which would shift everything after it (and as a block only moved, no new layout comes). Each
// continuation goes straight back right after the block it continues.
function keepOrder(view) {
  const top = view.scrollTop;
  let moved = false;
  for (const w of view.querySelectorAll('.lp-cont')) {
    if (w._lpAfter && w._lpAfter.isConnected && w.parentNode === w._lpAfter.parentNode && w.previousElementSibling !== w._lpAfter) { w._lpAfter.after(w); moved = true; }
  }
  // (putting it back changes nothing on the page; the browser must not scroll for it)
  if (moved && view.scrollTop !== top) view.scrollTop = top;
}

// the first block at the top of the screen in a reading view (to keep it where it is)
function screenAnchor(scroller) {
  const sizer = scroller.querySelector('.markdown-preview-sizer');
  if (!sizer) return null;
  const top = scroller.getBoundingClientRect().top;
  for (const b of sizer.children) {
    if (b.matches('.markdown-preview-pusher, .mod-header, .lp-sheet, .lp-hdr, .lp-cont')) continue;   // (one of Obsidian's own blocks)
    const r = b.getBoundingClientRect();
    if (r.height && r.bottom > top) return b;
  }
  return null;
}
// put back the sections Obsidian took off the page, in their places (only ones it has already
// built, and not ones it now uses elsewhere); the spacer then holds no room any more
function putSectionsBack(r) {
  const secs = r.sections, sizer = r.sizerEl;
  if (!Array.isArray(secs) || !sizer) return;
  let prev = (r.header && r.header.el && r.header.el.parentNode === sizer && r.header.el) ||
    (r.pusherEl && r.pusherEl.parentNode === sizer && r.pusherEl) || null;
  let all = true;
  // (a folded heading: the sections under it, down to the next heading as big or bigger, are folded
  // away by Obsidian, and stay away)
  const level = (el) => { const h = el.querySelector(':scope > :is(h1, h2, h3, h4, h5, h6)'); return h ? +h.tagName[1] : 0; };
  const folded = (el) => el.classList.contains('is-collapsed') || !!el.querySelector(':scope > :is(h1, h2, h3, h4, h5, h6).is-collapsed');
  let fold = 0;
  for (const s of secs) {
    const el = s && s.el;
    if (!el) continue;
    const lv = level(el);
    if (fold && (!lv || lv > fold)) continue;
    fold = lv && folded(el) ? lv : 0;
    if (el.parentNode === sizer) { prev = el; continue; }
    if (el.parentNode || !el.childNodes.length) { all = false; continue; }
    if (prev) prev.after(el); else sizer.prepend(el);
    prev = el;
  }
  if (all && r.pusherEl) r.pusherEl.style.marginBottom = '0px';
}

// ---------- commands ----------
// Commands for the command palette; give them hotkeys in Settings → Hotkeys (search "Lined Paper").
// Two kinds: ones that make the open note lined paper / Cornell notes (its cssclasses property), and
// ones that type a block at the cursor ("|" in a template is where the cursor goes).

// the note's cssclasses with lined paper set to `kind` ('lined', 'cornell' or 'off'); other classes kept.
// (cssclasses may be a list, a single word or "a, b"; the old `cssclass` property is folded in)
function paperClasses(fm, kind) {
  const list = [];
  for (const v of [fm.cssclasses, fm.cssclass]) {
    for (const c of Array.isArray(v) ? v : typeof v === 'string' ? v.split(/[,\s]+/) : []) {
      if (c && !list.includes(String(c))) list.push(String(c));
    }
  }
  const rest = list.filter((c) => c !== 'lined-paper' && c !== 'cornell');
  const paper = kind === 'cornell' ? ['lined-paper', 'cornell'] : kind === 'lined' ? ['lined-paper'] : [];
  return [...paper, ...rest];
}

// a note's cssclasses with dark-paper or light-paper (the other one taken away), the rest kept
function noteThemeClasses(fm, theme) {
  const raw = fm.cssclasses !== undefined ? fm.cssclasses : fm.cssclass;
  const list = (Array.isArray(raw) ? raw : String(raw || '').split(/[\s,]+/)).map(String).filter(Boolean);
  return [...list.filter((c) => c !== 'dark-paper' && c !== 'light-paper'), theme + '-paper'];
}

// today, written like "26 Oct 2026" (moment comes with Obsidian)
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const today = () => {
  if (globalThis.moment) return globalThis.moment().locale('en').format('D MMM YYYY');
  const d = new Date();
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};
// a date property, written like "26 Oct 2026" (a date as 2026-10-26, with or without a time;
// anything else is shown as written)
function formatDate(v) {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) v = v[0];
  const str = String(v).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T ])/.exec(str);
  if (m && +m[2] >= 1 && +m[2] <= 12) return `${+m[3]} ${MONTHS[+m[2] - 1]} ${m[1]}`;
  return str.slice(0, 40);
}
// the date of a note: its `date` property (any capitals), else `created`
function dateKey(fm) {
  if (!fm || typeof fm !== 'object') return null;
  const keys = Object.keys(fm);
  return keys.find((x) => /^date$/i.test(x)) || keys.find((x) => /^created([ _-]?(at|on))?$/i.test(x)) || null;
}
function frontmatterDate(fm) {
  const k = dateKey(fm);
  return k ? formatDate(fm[k]) : '';
}
// a date property's value as YYYY-MM-DD for the date picker ('' when it is not a date like that)
function isoDate(v) {
  if (Array.isArray(v)) v = v[0];
  const m = /^(\d{4}-\d{2}-\d{2})(?:$|[T ])/.exec(String(v === null || v === undefined ? '' : v).trim());
  return m ? m[1] : '';
}
// The date in a title bar's corner comes from the note's properties: the note's title (page 1)
// shows its `date`, and the title of every later page (a # title that starts a new page) its own
// date from the `page-dates` list (the 2nd # title the 1st date, the 3rd # title the 2nd ...), or
// the note's date when it has none. The plugin puts it into the title on the page, never into the
// note, so the title line stays just `# Title`. A date written in a title
// (<span class="paper-date">) is used as it is. Idempotent.
const noteTitles = (root) => Array.from(root.querySelectorAll('h1')).filter((h) => !h.closest('.markdown-embed, .internal-embed, .callout'));
function showDates(root, first, pages) {
  const titles = noteTitles(root);
  const want = new Map();
  titles.forEach((h, i) => {
    const b = h.parentElement;
    const page = i === 0 || (b && (breaksBefore(b) || nextPageBlock(b.previousElementSibling)));
    const date = page ? ((i > 0 && formatDate((pages || [])[i - 1])) || first) : '';
    if (date && !h.querySelector('.paper-date:not(.lp-prop-date)')) want.set(h, [date, i]);
  });
  for (const d of root.querySelectorAll('.lp-prop-date')) if (!want.has(d.parentElement)) d.remove();
  for (const [h, [date, i]] of want) {
    let d = h.querySelector(':scope > .lp-prop-date');
    if (!d) {
      d = document.createElement('span');
      d.className = 'paper-date lp-prop-date';
      d.setAttribute('contenteditable', 'false');
      h.appendChild(d);
    }
    if (d.textContent !== date) d.textContent = date;
    if (d.dataset.lpPage !== String(i)) d.dataset.lpPage = String(i);
  }
}
const showDate = (root, date) => showDates(root, date, []);
// The PDF export: Obsidian renders the note bit by bit and prints it straight away, so each part gets
// its date as it is rendered (a markdown post-processor), from the note's properties Obsidian hands
// over (ctx.frontmatter) and the note's source (ctx.getSectionInfo): which # title of the note this
// is, and whether it starts a page (every # title after the first, with "Start a new page at every
// # title" on, or one under a [!nextpage]).
function sectionDates(el, ctx, fm) {
  const hs = noteTitles(el);
  if (!hs.length || !fm) return;
  const first = frontmatterDate(fm), pages = listValue(fm['page-dates']);
  let lines = null, start = 0;
  try {
    const info = ctx && ctx.getSectionInfo && ctx.getSectionInfo(el);
    if (info && typeof info.text === 'string') { lines = info.text.split('\n'); start = info.lineStart; }
  } catch (e) { /* no source */ }
  if (!lines) {
    // no source: the whole export, once this part is in it (which titles start a page is on the page
    // then); a part not in it yet: its title gets the note's date (put right with the rest later)
    const pr = el.closest('.print');
    if (pr) { autoBreaks(pr); showDates(pr, first, pages); return; }
    for (const h of hs) sectionDates(h.parentElement || h, { getSectionInfo: () => ({ text: '# x', lineStart: 0 }) }, { date: fm[dateKey(fm)] });
    return;
  }
  // the # titles of the note, in order, with whether each starts a page
  const titles = [];
  let i = 0, fence = false;
  if (lines[0] === '---') { for (i = 1; i < lines.length && !/^(---|\.\.\.)\s*$/.test(lines[i]); i++); i++; }
  const auto = !document.body.classList.contains('lp-no-auto-break');
  for (let prev = ''; i < lines.length; i++) {
    const l = lines[i];
    if (/^\s*(```|~~~)/.test(l)) fence = !fence;
    else if (!fence && /^# /.test(l)) titles.push({ line: i, page: !titles.length || auto || /\[!nextpage\]/i.test(prev) });
    if (l.trim()) prev = l;
  }
  const mine = titles.filter((t) => t.line >= start);
  hs.forEach((h, k) => {
    const t = mine[k];
    if (!t || h.querySelector('.paper-date:not(.lp-prop-date)')) return;
    const n = titles.indexOf(t);
    const date = t.page ? ((n > 0 && formatDate(pages[n - 1])) || first) : '';
    let d = h.querySelector(':scope > .lp-prop-date');
    if (!date) { if (d) d.remove(); return; }
    if (!d) {
      d = document.createElement('span');
      d.className = 'paper-date lp-prop-date';
      d.setAttribute('contenteditable', 'false');
      h.appendChild(d);
    }
    if (d.textContent !== date) d.textContent = date;
    d.dataset.lpPage = String(n);
  });
}
// a list property's items ('' for none)
const listValue = (v) => (Array.isArray(v) ? v : v === null || v === undefined || v === '' ? [] : [v]).map((x) => (x === null || x === undefined ? '' : String(x)));

// the note's date property, set to today (YYYY-MM-DD) if it has none, through the editor (the
// cursor stays where it was)
function setDateProperty(editor) {
  const iso = globalThis.moment ? globalThis.moment().format('YYYY-MM-DD') : new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const cur = editor.getCursor();
  const n = editor.lineCount();
  if (editor.getLine(0) === '---') {
    let end = -1;
    for (let i = 1; i < n; i++) if (/^(---|\.\.\.)\s*$/.test(editor.getLine(i))) { end = i; break; }
    if (end > 0) {
      for (let i = 1; i < end; i++) if (/^(date|created)\s*:/i.test(editor.getLine(i))) return;
      editor.replaceRange(`date: ${iso}\n`, { line: end, ch: 0 });
      editor.setCursor({ line: cur.line + (cur.line >= end ? 1 : 0), ch: cur.ch });
      return;
    }
  }
  editor.replaceRange(`---\ndate: ${iso}\n---\n`, { line: 0, ch: 0 });
  editor.setCursor({ line: cur.line + 3, ch: cur.ch });
}
// a new page's own date: today into the note's `page-dates` list, at the place of the # title
// written at the cursor (the list keeps the dates of the pages after it with their pages). Through
// the editor; the cursor stays where it was.
function addPageDate(editor) {
  const iso = globalThis.moment ? globalThis.moment().format('YYYY-MM-DD') : new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const cur = editor.getCursor();
  const n = editor.lineCount();
  // the frontmatter (setDateProperty has made one)
  if (editor.getLine(0) !== '---') return;
  let end = -1;
  for (let i = 1; i < n; i++) if (/^(---|\.\.\.)\s*$/.test(editor.getLine(i))) { end = i; break; }
  if (end < 0) return;
  // # titles above the cursor (not in code)
  let titles = 0, fence = false;
  for (let i = end + 1; i < cur.line && i < n; i++) {
    const l = editor.getLine(i);
    if (/^\s*(```|~~~)/.test(l)) fence = !fence;
    else if (!fence && /^# /.test(l)) titles++;
  }
  if (titles < 1) return;   // (the note's own title: its date is the date property)
  // the list as it is: `page-dates: [a, b]` or a `- a` line for each
  let from = -1, to = -1, list = [];
  for (let i = 1; i < end; i++) {
    const m = /^page-dates\s*:\s*(.*)$/i.exec(editor.getLine(i));
    if (!m) continue;
    from = i; to = i + 1;
    const inline = m[1].trim();
    if (inline.startsWith('[')) list = inline.replace(/^\[|\]$/g, '').split(',').map((x) => x.trim().replace(/^["']|["']$/g, '')).filter((x, k, a) => x || a.length > 1);
    else if (inline) list = [inline.replace(/^["']|["']$/g, '')];
    while (to < end && /^\s+-\s*/.test(editor.getLine(to))) { list.push(editor.getLine(to).replace(/^\s+-\s*/, '').trim().replace(/^["']|["']$/g, '')); to++; }
    break;
  }
  const k = titles - 1;
  while (list.length < k) list.push('');
  list.splice(k, 0, iso);
  const lines = ['page-dates:', ...list.map((x) => '  - ' + (x || '""'))];
  const text = lines.join('\n') + '\n';
  if (from < 0) { editor.replaceRange(text, { line: end, ch: 0 }); from = end; to = end; }
  else editor.replaceRange(text, { line: from, ch: 0 }, { line: to, ch: 0 });
  editor.setCursor({ line: cur.line + lines.length - (to - from), ch: cur.ch });
}
// (every block written in a quote of its own, `>> [!…]`, like the cue / notes groups)
const TEMPLATES = {
  title: (title) => `# ${title}\n|`,
  cornell: (title) => `# ${title}\n\n>> [!question] Question\n>> |\n\n>> [!cue]\n>> \n>\n>> [!notes]\n>> \n\n>> [!summary] Summary\n>> \n`,
  group: () => '>> [!cue]\n>> |\n>\n>> [!notes]\n>> \n',
  question: () => '>> [!question] Question\n>> |\n',
  summary: () => '>> [!summary] Summary\n>> |\n',
  wide: () => '>> [!wide]\n>> |\n',
  divider: () => '>> [!divider]\n\n|',
  nextpage: () => '>> [!nextpage]\n\n|',
};
// the pens (lined-paper.css "PEN COLOURS": each shown as var(--pen-…), lighter in dark theme)
const COLOURS = [['blue', '#1e4fbf'], ['red', '#c62828'], ['green', '#2e7d32'], ['purple', '#6a1b9a'], ['orange', '#d84315']];
// the highlighters of the "Highlighter: …" commands, <mark class="hl-…">
const HIGHLIGHTERS = ['yellow', 'green', 'pink', 'blue', 'orange'];
// the marks of the "Pen: …" commands, <span class="pen-…">
const PEN_MARKS = [['circle', 'circle'], ['box', 'box'], ['underline', 'underline'], ['wavy', 'wavy underline'], ['scribble', 'scribble out']];
const PEN_VAR = Object.fromEntries(COLOURS.map(([name, hex]) => [hex, `var(--pen-${name}, ${hex})`]));

// type a block on lines of its own at the cursor (a blank line before it where needed; every template
// ends with a line break, which leaves the blank line after it), and put the cursor at its "|"
function insertBlock(editor, template) {
  const cur = editor.getCursor();
  const line = editor.getLine(cur.line);
  let text = template;
  let at = { line: cur.line, ch: line.length };
  if (line.trim() === '') {
    at = { line: cur.line, ch: 0 };
    if (cur.line > 0 && editor.getLine(cur.line - 1).trim() !== '') text = '\n' + text;
    editor.replaceRange('', at, { line: cur.line, ch: line.length });
  } else {
    text = '\n\n' + text;
  }
  const mark = text.indexOf('|');
  text = text.replace('|', '');
  editor.replaceRange(text, at);
  const before = text.slice(0, mark).split('\n');
  editor.setCursor({ line: at.line + before.length - 1, ch: (before.length === 1 ? at.ch : 0) + before[before.length - 1].length });
}

// write the selected text with a pen (or type an empty pen span to write in)
// ---------- pen colours, highlighters and pen marks: put on, change, take off ----------
// The styled runs in one line of source: <font color>, <span style="color">  (colour),
// <span class="pen-…">  (mark), <mark …> and ==…==  (highlight). Where each is, and its tags.
function styledRuns(text) {
  const out = [];
  // (==…== may hold an `=`, as in ==<mark class="hl-blue">…</mark>==)
  const re = /<(font|span|mark)\b([^>]*)>([\s\S]*?)<\/\1\s*>|==(?![=\s])([^\n]*?[^\s=])==/gi;
  for (let m; (m = re.exec(text));) {
    let kind = null;
    if (m[4] !== undefined) kind = 'highlight';
    else {
      const tag = m[1].toLowerCase(), attrs = m[2];
      if (tag === 'mark') kind = 'highlight';
      else if (tag === 'span' && PEN_CLASS_RE.test(attrs)) kind = 'mark';
      else if ((tag === 'font' && /\bcolor\s*=/i.test(attrs)) || (tag === 'span' && /\bstyle\s*=\s*["'][^"']*\bcolor\s*:/i.test(attrs))) kind = 'colour';
    }
    if (!kind) continue;
    const open = m[4] !== undefined ? '==' : m[0].slice(0, m[0].indexOf('>') + 1);
    const close = m[4] !== undefined ? '==' : m[0].slice(m[0].lastIndexOf('</'));
    out.push({ kind, from: m.index, to: m.index + m[0].length, innerFrom: m.index + open.length, innerTo: m.index + m[0].length - close.length, open, close });
  }
  return out;
}
// One line: the runs of `kinds` over [a, b) taken off (the parts of a run outside [a, b) keep their
// style), then [a, b) styled with `wrap` ({ open, close }; none: only taken off). Without a selection
// (a === b), the run the cursor is in is changed (or taken off) as a whole; outside one, an empty
// `wrap` is put at the cursor to write in. Spaces at either end of the selection stay outside.
// Returns { text, a, b }: the new line and the styled text's place in it.
function restyleLine(line, a, b, kinds, wrap) {
  const of = (r) => kinds.includes(r.kind);
  if (a === b) {
    const r = styledRuns(line).find((x) => of(x) && a >= x.from && a <= x.to);
    // (the cursor on an arrow, -> => ~> …, outside any run: that arrow)
    let arrow = null;
    if (!r) { ARROW_RE.lastIndex = 0; for (let m; (m = ARROW_RE.exec(line));) if (a >= m.index && a <= m.index + m[0].length) { arrow = m; break; } }
    if (arrow) { a = arrow.index; b = arrow.index + arrow[0].length; } else if (!r) {
      if (!wrap) return { text: line, a, b };
      return { text: line.slice(0, a) + wrap.open + wrap.close + line.slice(a), a: a + wrap.open.length, b: a + wrap.open.length };
    } else { a = r.innerFrom; b = r.innerTo; }
  }
  while (a < b && /\s/.test(line[a])) a++;
  while (b > a && /\s/.test(line[b - 1])) b--;
  if (a === b) return { text: line, a, b };
  // take the runs off one at a time, the innermost / rightmost first, looking again after each (one may
  // be inside another; what is left of a run outside the selection keeps its style)
  for (let guard = 0; guard < 50; guard++) {
    const all = [];
    // (runs inside a run: found by looking inside it too)
    const find = (text, base) => {
      for (const r of styledRuns(text)) {
        const run = { ...r, from: r.from + base, to: r.to + base, innerFrom: r.innerFrom + base, innerTo: r.innerTo + base };
        all.push(run);
        find(text.slice(r.innerFrom, r.innerTo), run.innerFrom);
      }
    };
    find(line, 0);
    const r = all.filter((x) => of(x) && x.from < b && x.to > a).sort((x, y) => (y.from - x.from) || (x.to - y.to))[0];
    if (!r) break;
    const inner = line.slice(r.innerFrom, r.innerTo);
    const s = Math.min(Math.max(a - r.innerFrom, 0), inner.length), e = Math.min(Math.max(b - r.innerFrom, 0), inner.length);
    const keep = (part) => {
      if (!part.trim()) return part;
      const lead = part.match(/^\s*/)[0], trail = part.match(/\s*$/)[0];
      return lead + r.open + part.trim() + r.close + trail;
    };
    const left = keep(inner.slice(0, s)), mid = inner.slice(s, e), right = keep(inner.slice(e));
    const rep = left + mid + right;
    const delta = rep.length - (r.to - r.from);
    line = line.slice(0, r.from) + rep + line.slice(r.to);
    const midStart = r.from + left.length;
    if (a >= r.from) a = midStart; 
    if (b <= r.to) b = midStart + mid.length; else b += delta;
  }
  while (a < b && /\s/.test(line[a])) a++;
  while (b > a && /\s/.test(line[b - 1])) b--;
  if (!wrap || a === b) return { text: line, a, b };
  const mid = line.slice(a, b);
  return { text: line.slice(0, a) + wrap.open + mid + wrap.close + line.slice(b), a: a + wrap.open.length, b: a + wrap.open.length + mid.length };
}
// the editor: each selected line (or the cursor's run) restyled, the styled text selected after
function restyleSelection(editor, kinds, wrap) {
  const from = editor.getCursor('from'), to = editor.getCursor('to');
  let sel = null;
  for (let l = from.line; l <= to.line; l++) {
    const line = editor.getLine(l);
    const a = l === from.line ? from.ch : 0;
    const b = l === to.line ? to.ch : line.length;
    if (from.line !== to.line && a === b) continue;
    const r = restyleLine(line, a, b, kinds, wrap);
    if (r.text !== line) editor.replaceRange(r.text, { line: l, ch: 0 }, { line: l, ch: line.length });
    if (!sel) sel = { anchor: { line: l, ch: r.a } };
    sel.head = { line: l, ch: r.b };
  }
  if (sel && editor.setSelection) editor.setSelection(sel.anchor, sel.head);
}

// write the selected text with a pen or highlighter (or type an empty one to write in)
function wrapSelection(editor, open, close) {
  const sel = editor.getSelection();
  // (spaces selected at either end stay outside: the mark covers the words and the spaces between
  // them, never the space next to a word that isn't marked)
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(sel || '');
  if (sel && m[2]) editor.replaceSelection(m[1] + open + m[2] + close + m[3]);
  else if (sel) editor.replaceSelection(sel);
  else {
    const cur = editor.getCursor();
    editor.replaceRange(open + close, cur);
    editor.setCursor({ line: cur.line, ch: cur.ch + open.length });
  }
}

function addPaperCommands(plugin) {
  const app = plugin.app;
  const setPaper = (kind, label) => (checking) => {
    const file = app && app.workspace && app.workspace.getActiveFile && app.workspace.getActiveFile();
    if (!file || file.extension !== 'md') return false;
    if (!checking) {
      app.fileManager.processFrontMatter(file, (fm) => {
        const cls = paperClasses(fm, kind);
        delete fm.cssclass;
        if (cls.length) fm.cssclasses = cls; else delete fm.cssclasses;
      }).then(() => new Notice('Lined Paper Pages: ' + label));
    }
    return true;
  };
  plugin.addCommand({ id: 'make-lined-paper', name: 'Make this note lined paper', checkCallback: setPaper('lined', 'lined paper') });
  plugin.addCommand({ id: 'make-cornell', name: 'Make this note Cornell notes', checkCallback: setPaper('cornell', 'Cornell notes') });
  plugin.addCommand({ id: 'make-plain', name: 'Make this note a plain note again', checkCallback: setPaper('off', 'plain note') });

  // light / dark paper: for every note (the setting), or for this note (its cssclasses)
  const activePage = () => {
    const leaf = app && app.workspace && app.workspace.activeLeaf;
    const el = leaf && leaf.view && leaf.view.containerEl;
    return el && el.querySelector('.lined-paper:not(.lined-paper .lined-paper)');
  };
  const isDark = () => { const el = activePage(); return el ? plugin.paperTheme(el) === 'dark' : document.body.classList.contains('theme-dark'); };
  plugin.togglePaperTheme = async () => {
    const set = plugin.settings['paper-theme'];
    const dark = !(set === 'dark' || set === 'light' ? set === 'dark' : document.body.classList.contains('theme-dark'));
    await plugin.setSetting('paper-theme', dark ? 'dark' : 'light');
    new Notice('Lined Paper Pages: ' + (dark ? 'dark' : 'light') + ' paper');
  };
  plugin.addCommand({ id: 'toggle-paper-theme', name: 'Switch the paper between light and dark', callback: () => plugin.togglePaperTheme() });
  plugin.addCommand({ id: 'paper-theme-auto', name: 'Paper follows Obsidian\'s light / dark theme again', callback: () => plugin.setSetting('paper-theme', undefined) });
  plugin.addCommand({
    id: 'toggle-note-paper-theme', name: 'Switch this note\'s paper between light and dark',
    checkCallback: (checking) => {
      const file = app && app.workspace && app.workspace.getActiveFile && app.workspace.getActiveFile();
      if (!file || file.extension !== 'md') return false;
      if (!checking) {
        const dark = !isDark();
        app.fileManager.processFrontMatter(file, (fm) => {
          const cls = noteThemeClasses(fm, dark ? 'dark' : 'light');
          delete fm.cssclass;
          if (cls.length) fm.cssclasses = cls; else delete fm.cssclasses;
        }).then(() => new Notice('Lined Paper Pages: ' + (dark ? 'dark' : 'light') + ' paper for this note'));
      }
      return true;
    },
  });
  plugin.addCommand({
    id: 'set-date', name: 'Set this note\'s date',
    checkCallback: (checking) => {
      const file = app && app.workspace && app.workspace.getActiveFile && app.workspace.getActiveFile();
      if (!file || file.extension !== 'md') return false;
      if (!checking) {
        const page = activePage();
        const at = page && (page.querySelector('.lp-prop-date') || page.querySelector('h1') || page.querySelector('.metadata-container'));
        plugin.editDate(page || document.body, at);
      }
      return true;
    },
  });
  if (plugin.addRibbonIcon) plugin.addRibbonIcon('sun-moon', 'Lined Paper: light / dark paper', () => plugin.togglePaperTheme());

  const insert = (id, name, key) => plugin.addCommand({
    id, name,
    editorCallback: (editor, view) => {
      // (a title's date goes in the note's date property, shown in the title bar's corner)
      if (key === 'title' || key === 'cornell') { setDateProperty(editor); addPageDate(editor); }
      insertBlock(editor, TEMPLATES[key]((view && view.file && view.file.basename) || 'Title'));
    },
  });
  insert('insert-title', 'Insert title (and today\'s date as the date property)', 'title');
  insert('insert-cornell-page', 'Insert Cornell page (title, question, cue + notes, summary; today\'s date as the date property)', 'cornell');
  insert('insert-cue-notes', 'Insert cue + notes', 'group');
  insert('insert-question', 'Insert essential question', 'question');
  insert('insert-summary', 'Insert summary', 'summary');
  insert('insert-wide', 'Insert full-width lines ([!wide])', 'wide');
  insert('insert-divider', 'Insert divider line', 'divider');
  insert('insert-nextpage', 'Insert page break', 'nextpage');

  const wrap = wrapSelection;

  // (a new colour, highlighter or mark takes the place of the one there: never one inside another)
  for (const [name, hex] of COLOURS) {
    plugin.addCommand({
      id: 'colour-' + name, name: `Pen: ${name}`,
      editorCallback: (editor) => restyleSelection(editor, ['colour'], { open: `<font color="${hex}">`, close: '</font>' }),
    });
  }
  plugin.addCommand({ id: 'highlighter', name: 'Pen: highlighter', editorCallback: (editor) => restyleSelection(editor, ['highlight'], { open: '==', close: '==' }) });
  // highlighters of other colours, in the same note
  for (const c of HIGHLIGHTERS) {
    plugin.addCommand({ id: 'highlighter-' + c, name: 'Highlighter: ' + c, editorCallback: (editor) => restyleSelection(editor, ['highlight'], { open: `<mark class="hl-${c}">`, close: '</mark>' }) });
  }
  // marks drawn over the writing with the marking pen (lined-paper.css "PEN AND PAPER")
  for (const [id, name] of PEN_MARKS) {
    plugin.addCommand({ id: 'pen-' + id, name: 'Pen: ' + name, editorCallback: (editor) => restyleSelection(editor, ['mark'], { open: `<span class="pen-${id}">`, close: '</span>' }) });
  }
  // arrows (drawn by the plugin: Settings → Pen and paper → Arrows)
  for (const [id, name, text] of [['insert-arrow', 'Insert arrow (->)', '->'], ['insert-arrow-double', 'Insert double arrow (=>)', '=>'], ['insert-arrow-wavy', 'Insert wavy arrow (~>)', '~>']]) {
    plugin.addCommand({ id, name, editorCallback: (editor) => {
      const cur = editor.getCursor();
      const line = editor.getLine(cur.line);
      const before = cur.ch > 0 && !/\s/.test(line[cur.ch - 1]) ? ' ' : '';
      const ins = before + text + ' ';
      editor.replaceRange(ins, cur);
      editor.setCursor({ line: cur.line, ch: cur.ch + ins.length });
    } });
  }
  // taking them off again: of the selection, or of the run the cursor is in
  plugin.addCommand({ id: 'remove-colour', name: 'Remove pen colour', editorCallback: (editor) => restyleSelection(editor, ['colour'], null) });
  plugin.addCommand({ id: 'remove-highlight', name: 'Remove highlight', editorCallback: (editor) => restyleSelection(editor, ['highlight'], null) });
  plugin.addCommand({ id: 'remove-marks', name: 'Remove pen marks (circle, box, underline …)', editorCallback: (editor) => restyleSelection(editor, ['mark'], null) });
  plugin.addCommand({ id: 'remove-all-styles', name: 'Remove all colours, highlights and marks', editorCallback: (editor) => restyleSelection(editor, ['colour', 'highlight', 'mark'], null) });
  plugin.addCommand({ id: 'cross-out', name: 'Pen: cross out', editorCallback: (editor) => wrap(editor, '~~', '~~') });
  plugin.addCommand({ id: 'insert-task', name: 'Insert checkbox (task)', editorCallback: (editor) => {
    const cur = editor.getCursor();
    const line = editor.getLine(cur.line);
    if (/^\s*[-*+] \[.\] /.test(line)) return;
    const m = /^(\s*(?:>+\s*)*)(?:[-*+] )?/.exec(line);
    editor.replaceRange(m[1] + '- [ ] ', { line: cur.line, ch: 0 }, { line: cur.line, ch: m[0].length });
    editor.setCursor({ line: cur.line, ch: editor.getLine(cur.line).length });
  } });
}

module.exports = class LinedPaperPages extends Plugin {
  onload() {
    this.states = new WeakMap();
    this.patchedRenderers = [];
    this.scan = this.scan.bind(this);
    this.settings = {};
    this.ownClasses = new Set();
    this.loadData().then((d) => {
      this.settings = d || {};
      this.applySettings();
      const ws = this.app.workspace;
      if (ws.onLayoutReady) ws.onLayoutReady(() => { this.hintOldSnippets().catch(() => {}); });
    });
    this.addSettingTab(new LinedPaperSettingTab(this.app, this));

    const again = () => this.scheduleScan(true);
    this.registerEvent(this.app.workspace.on('layout-change', again));
    this.registerEvent(this.app.workspace.on('active-leaf-change', again));
    this.registerEvent(this.app.workspace.on('file-open', again));
    this.registerEvent(this.app.workspace.on('css-change', () => { this.applyPaperThemes(); again(); }));
    // (the date property changed: the date in the title bar follows)
    if (this.app.metadataCache && this.app.metadataCache.on) this.registerEvent(this.app.metadataCache.on('changed', again));
    // coloured text with links: editing view
    const colourExt = colourEditorExtension(this);
    if (colourExt && this.registerEditorExtension) this.registerEditorExtension(colourExt);
    const bulletExt = bulletEditorExtension();
    if (bulletExt && this.registerEditorExtension) this.registerEditorExtension(bulletExt);
    const arrowExt = arrowEditorExtension();
    if (arrowExt && this.registerEditorExtension) this.registerEditorExtension(arrowExt);
    this.registerMarkdownPostProcessor((el, ctx) => {
      // coloured text with links: reading view and PDF
      const openLink = (href, e) => this.app.workspace.openLinkText(href, (ctx && ctx.sourcePath) || '', !!(e && (e.ctrlKey || e.metaKey)));
      fixColouredLinks(el, ctx, openLink);
      window.setTimeout(() => fixColouredLinks(el, ctx, openLink), 0);
      // (also runs for PDF export; the callout may only be built after this, so look again shortly)
      // (reading view unwraps embeds in layout(), where it can be undone when the note changes)
      // (the PDF export: the date in each title bar, from the note's properties)
      if (ctx && ctx.frontmatter) this.exportFm = ctx.frontmatter;
      if (!el.closest('.markdown-reading-view')) sectionDates(el, ctx, (ctx && ctx.frontmatter) || this.exportFm);
      const prep = () => { drawArrows(el); markBullets(el, ctx); if (!el.closest('.markdown-reading-view')) { unwrapQuotedBlocks(el); liftSummaries(el); unwrapCalloutEmbeds(el); tidyEmbedLines(el); markEmptyHeads(el); alignEmbeds(el); alignEmbedCopies(el); fitTitles(el); } addSummarySizer(el); const v = el.closest('.print, .markdown-preview-view'); if (v && !el.closest('.markdown-reading-view')) { autoBreaks(v); anchorMidSummaries(v); } };
      prep();
      // (embeds fill in later still: look again whenever something inside changes, for a while)
      window.setTimeout(prep, 0);
      const obs = new MutationObserver(() => { obs.disconnect(); prep(); obs.observe(el, { childList: true, subtree: true }); });
      obs.observe(el, { childList: true, subtree: true });
      window.setTimeout(() => obs.disconnect(), 20000);
      this.scheduleScan(false);
    });
    // the screen's pixel ratio (display scaling x zoom): the CSS makes every row whole screen pixels
    this.setDpr = () => {
      const r = String(window.devicePixelRatio || 1);
      if (document.body.style.getPropertyValue('--lp-dpr') !== r) { document.body.style.setProperty('--lp-dpr', r); return true; }
      return false;
    };
    this.setDpr();
    this.registerDomEvent(window, 'resize', () => { this.setDpr(); again(); });
    // the handwriting fonts load from the web: once they are in, titles are measured again
    if (document.fonts && document.fonts.addEventListener) {
      const fonts = () => { for (const pr of document.querySelectorAll('.print')) fitTitles(pr); again(); };
      document.fonts.addEventListener('loadingdone', fonts);
      this.register(() => document.fonts.removeEventListener('loadingdone', fonts));
    }
    // a picture's size is only known once it has loaded: lay the pages out again then
    // folding a heading in reading view (its arrow in the margin): the pages are laid out again for
    // what is left (Obsidian takes the folded blocks away, or hides them)
    this.registerDomEvent(document, 'click', (e) => {
      const arrow = e.target && e.target.closest && e.target.closest('.heading-collapse-indicator');
      const view = arrow && arrow.closest(SEL_VIEW);
      const st = view && this.states.get(view);
      if (st) window.setTimeout(() => this.queue(view, st), 30);
    }, true);
    // the date in the title bar (reading view): click it to change it
    this.registerDomEvent(document, 'click', (e) => this.onDateClick(e), true);
    this.registerDomEvent(document, 'load', (e) => {
      const view = e.target && e.target.tagName === 'IMG' && e.target.closest(SEL_VIEW);
      const st = view && this.states.get(view);
      if (st) this.queue(view, st);
    }, true);
    // PDF export: make sure every summary has its copy before the page is printed
    this.registerDomEvent(window, 'beforeprint', () => { this.applyPaperThemes(); for (const pr of document.querySelectorAll('.print')) { autoBreaks(pr); this.showNoteDates(pr); } unwrapQuotedBlocks(document.body); liftSummaries(document.body); unwrapCalloutEmbeds(document.body); fitTitles(document.body); addSummarySizer(document.body); for (const pr of document.querySelectorAll('.print')) { autoBreaks(pr); anchorMidSummaries(pr); } });
    this.registerInterval(window.setInterval(() => {
      if (this.setDpr()) again(); // (moved to a screen with other display scaling)
      this.scan(false);
      // PDF export: an embed that filled in late
      this.applyPaperThemes(); for (const pr of document.querySelectorAll('.print')) { drawArrows(pr); autoBreaks(pr); this.showNoteDates(pr); unwrapQuotedBlocks(pr); liftSummaries(pr); unwrapCalloutEmbeds(pr); tidyEmbedLines(pr); markEmptyHeads(pr); alignEmbeds(pr); alignEmbedCopies(pr); fitTitles(pr); addSummarySizer(pr); autoBreaks(pr); anchorMidSummaries(pr); }
    }, 1500));

    // Style Settings / snippets change CSS variables without touching the note's DOM
    // (only stylesheets: not the window title and such, which change all the time)
    const isStyle = (n) => n && (n.nodeName === 'STYLE' || (n.nodeName === 'LINK' && /stylesheet/i.test(n.rel || '')) ||
      (n.nodeType === 3 && n.parentNode && n.parentNode.nodeName === 'STYLE'));
    this.headObs = new MutationObserver((recs) => {
      if (recs.some((r) => isStyle(r.target) || Array.from(r.addedNodes).some(isStyle) || Array.from(r.removedNodes).some(isStyle))) again();
    });
    this.headObs.observe(document.head, { childList: true, subtree: true, characterData: true });
    const watched = /(^|\s)(lp-no-pages|cn-hide-page-labels|theme-dark|theme-light|css-settings-manager)(\s|$)/g;
    const sig = () => (document.body.className.match(watched) || []).join(' ');
    this.bodySig = sig();
    this.bodyObs = new MutationObserver(() => {
      const s = sig();
      if (s !== this.bodySig) { this.bodySig = s; again(); }
    });
    this.bodyObs.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    this.addCommand({
      id: 'repaginate',
      name: 'Re-paginate reading view',
      callback: () => { this.scheduleScan(true); new Notice('Lined Paper Pages: re-paginating'); },
    });
    // a report of how the open note is laid out, to send when something looks wrong (nothing is changed)
    this.addCommand({
      id: 'copy-layout-report',
      name: 'Copy layout report (to send when the pages look wrong)',
      callback: async () => {
        const report = this.layoutReport();
        try { report.snippets = await this.oldSnippets(); } catch (e) { /* the list without the check */ }
        const text = JSON.stringify(report, null, 1);
        const done = () => new Notice('Lined Paper Pages: layout report copied. Paste it into your message.');
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => console.log(text));
        else console.log(text);
      },
    });
    addPaperCommands(this);
    console.log('[lined-paper-pages] loaded, version ' + ((this.manifest && this.manifest.version) || '?'));

    if (document.fonts && document.fonts.ready) document.fonts.ready.then(again);
    this.errorShown = false;
    this.scheduleScan(true);
  }

  // put every stored setting on <body> (and take off the ones that were reset)
  // The two CSS snippets are now part of the plugin (styles.css). Snippets left switched on from an
  // earlier install do no harm (every rule is just there twice), but they can go: say so, once.
  // the switched-on CSS snippets, and which of them are old copies of the plugin's styles
  async oldSnippets() {
    const css = this.app.customCss;
    const on = css && css.enabledSnippets;
    const enabled = !on ? [] : on.has ? Array.from(on) : Array.isArray(on) ? on : [];
    const adapter = this.app.vault && this.app.vault.adapter;
    const dir = ((this.app.vault && this.app.vault.configDir) || '.obsidian') + '/snippets/';
    const out = [];
    for (const n of enabled) {
      if (n === 'lined-paper' || n === 'cornell-notes') { out.push({ name: n, old: true }); continue; }
      try {
        const text = adapter && typeof adapter.read === 'function' ? await adapter.read(dir + n + '.css') : '';
        out.push({ name: n, old: /\.lined-paper\b|\.cornell\b|data-callout="(?:cue|notes)"/.test(text), size: text.length });
      } catch (e) { out.push({ name: n, old: false, error: String(e && e.message || e) }); }
    }
    return out;
  }

  async hintOldSnippets() {
    // Old copies of the plugin's styles, kept as CSS snippets (the lined-paper / cornell-notes
    // snippets from before 1.9, under any name: "cornell", "lined-paper-print-a4", ...), load after the
    // plugin's styles, so their older rules win: an empty row under the question, the title's old
    // place, pages not laid out at all. Every switched-on snippet whose CSS is for lined paper is
    // switched off, and said so. (The files stay: switch them on again in Appearance → CSS snippets.)
    const css = this.app.customCss;
    const on = css && css.enabledSnippets;
    if (!on) return;
    const names = (await this.oldSnippets()).filter((x) => x.old).map((x) => x.name);
    if (!names.length) return;
    const list = names.map((n) => `"${n}"`).join(', ');
    if (typeof css.setCssEnabledStatus === 'function') {
      for (const n of names) css.setCssEnabledStatus(n, false);
      new Notice(`Lined Paper Pages: switched off the CSS snippet${names.length > 1 ? 's' : ''} ${list}: ${names.length > 1 ? 'they are' : 'it is'} an older copy of the plugin's own styles and ` +
        `overrode them. (The file${names.length > 1 ? 's are' : ' is'} kept: Settings → Appearance → CSS snippets.)`, 15000);
      this.scheduleScan(true);
    } else if (!this.settings.oldSnippetsHinted) {
      new Notice(`Lined Paper Pages now includes its own styles. Switch off the snippet${names.length > 1 ? 's' : ''} ` +
        `${list} in Settings → Appearance → CSS snippets.`, 20000);
      this.settings.oldSnippetsHinted = true;
      this.saveData(this.settings);
    }
  }



  applySettings() {
    const b = document.body;
    for (const def of SETTINGS) {
      if (!def.key) continue;
      const v = this.settings[def.key];
      if (def.type === 'select') {
        // one class per choice (lp-ink-pencil, ...); none at the default (and, as for a toggle, a
        // class it did not add itself is left alone)
        const want = v !== undefined && v !== def.def && def.options[v] ? def.cls + v : null;
        for (const o of Object.keys(def.options)) {
          const c = def.cls + o;
          if (c !== want && this.ownClasses.has(c)) { b.classList.remove(c); this.ownClasses.delete(c); }
        }
        if (want) { b.classList.add(want); this.ownClasses.add(want); }
      } else if (def.type === 'toggle') {
        // (at its default it leaves the class alone, so a Style Settings toggle still works)
        if (v !== undefined) { b.classList.toggle(def.cls, def.invert ? !v : v); this.ownClasses.add(def.cls); }
        else if (this.ownClasses.has(def.cls)) { b.classList.remove(def.cls); this.ownClasses.delete(def.cls); }
      } else if (v === undefined || v === '') {
        b.style.removeProperty('--' + def.key);
      } else {
        b.style.setProperty('--' + def.key, cssValue(def, v));
      }
    }
    this.applyPaperThemes();
    // (editors redraw their arrows: drawn, or as typed)
    try { if (this.app && this.app.workspace && this.app.workspace.updateOptions) this.app.workspace.updateOptions(); } catch (e) { /* */ }
    this.scheduleScan(true);
  }

  // light or dark paper, for one page (a reading view, an editor, the PDF): the note's own choice
  // (cssclasses: dark-paper / light-paper), else the setting, else Obsidian's theme
  paperTheme(el) {
    if (el.classList.contains('dark-paper')) return 'dark';
    if (el.classList.contains('light-paper')) return 'light';
    const s = this.settings['paper-theme'];
    if (s === 'dark' || s === 'light') return s;
    return document.body.classList.contains('theme-dark') ? 'dark' : 'light';
  }
  // each page marked lp-dark or lp-light (lined-paper.css), and, when that differs from Obsidian's
  // theme, given that theme's class too, so Obsidian's own colours inside it (callouts, tables,
  // properties) match the paper
  applyPaperThemes() {
    const bodyDark = document.body.classList.contains('theme-dark');
    for (const el of document.querySelectorAll('.lined-paper')) {
      if (el.parentElement && el.parentElement.closest('.lined-paper')) continue;
      const dark = this.paperTheme(el) === 'dark';
      const set = (cls, on) => { if (el.classList.contains(cls) !== on) el.classList.toggle(cls, on); };
      set('lp-dark', dark);
      set('lp-light', !dark);
      set('theme-dark', dark && !bodyDark);
      set('theme-light', !dark && bodyDark);
    }
  }

  async setSetting(key, v) {
    if (v === undefined) delete this.settings[key]; else this.settings[key] = v;
    await this.saveData(this.settings);
    this.applySettings();
  }

  onunload() {
    document.querySelectorAll('.lp-pending').forEach((v) => v.classList.remove('lp-pending'));
    for (const def of SETTINGS) {
      if (!def.key || this.settings[def.key] === undefined) continue;
      if (def.type === 'toggle') { if (this.ownClasses.has(def.cls)) document.body.classList.remove(def.cls); }
      else if (def.type === 'select') { for (const o of Object.keys(def.options)) if (this.ownClasses.has(def.cls + o)) document.body.classList.remove(def.cls + o); }
      else document.body.style.removeProperty('--' + def.key);
    }
    document.body.style.removeProperty('--lp-dpr');
    for (const el of document.querySelectorAll('.lp-dark, .lp-light')) el.classList.remove('lp-dark', 'lp-light', ...(el.classList.contains('lined-paper') && el.classList.contains('theme-dark') !== document.body.classList.contains('theme-dark') ? ['theme-dark', 'theme-light'] : []));
    if (this.headObs) this.headObs.disconnect();
    if (this.bodyObs) this.bodyObs.disconnect();
    for (const r of this.patchedRenderers || []) { r.updateVirtualDisplay = r._lpAll; delete r._lpAll; }
    document.querySelectorAll(SEL_VIEW).forEach((view) => {
      const st = this.states.get(view);
      if (!st) return;
      st.busy = true;
      st.obs.disconnect();
      if (st.onScroll) view.removeEventListener('scroll', st.onScroll);
      if (st.sheetRo) st.sheetRo.disconnect();
      view.querySelectorAll('.lp-sheet, .lp-hdr').forEach((e) => e.remove());
      if (st.ro) st.ro.disconnect();
      this.undoAll(st);
    });
  }

  scheduleScan(force) {
    window.clearTimeout(this._t);
    this._t = window.setTimeout(() => this.scan(force), 30);
  }

  // Obsidian builds a long note in reading view "virtually": only the sections near the screen are
  // on the page, the others are taken out as you scroll (a spacer keeps their room). The pages can't
  // be laid out from part of a note, and every section taken out or put back moved the pages while
  // scrolling. So on lined paper the whole note is kept on the page: while Obsidian works out what
  // to show, it is told the screen is very tall (so it shows everything below), the sections it
  // still takes out above are put straight back, and whatever is on screen is kept exactly where
  // it was. The scroll position Obsidian is given is always the real one. (Obsidian internals: if
  // they are not there, nothing is changed.)
  keepAllSections() {
    const leaves = (this.app.workspace.getLeavesOfType && this.app.workspace.getLeavesOfType('markdown')) || [];
    for (const leaf of leaves) {
      const r = leaf.view && leaf.view.previewMode && leaf.view.previewMode.renderer;
      if (!r || r._lpAll || typeof r.updateVirtualDisplay !== 'function' || !r.previewEl) continue;
      const orig = r.updateVirtualDisplay;
      r.updateVirtualDisplay = function (...args) {
        const el = this.previewEl;
        if (!el || !el.classList.contains('lined-paper') || document.body.classList.contains('lp-no-pages')) return orig.apply(this, args);
        const top = el.scrollTop;
        const anchor = screenAnchor(el);
        const anchorTop = anchor && anchor.getBoundingClientRect().top;
        // while Obsidian works out what to show: the screen is very tall and at the top of the note,
        // so it keeps everything; a scroll back to that pretend top is ignored (any other scroll
        // Obsidian asks for still happens)
        const tall = 1e7;
        const proto = Element.prototype;
        const real = Object.getOwnPropertyDescriptor(proto, 'scrollTop');
        const props = {
          clientHeight: { configurable: true, get: () => tall },
          offsetHeight: { configurable: true, get: () => tall },
          getBoundingClientRect: { configurable: true, value: () => { const b = proto.getBoundingClientRect.call(el); return { x: b.x, y: b.y, left: b.left, right: b.right, width: b.width, top: b.top, bottom: b.top + tall, height: tall, toJSON() { return this; } }; } },
          scrollTop: { configurable: true, get: () => 0, set: (v) => { if (Math.abs(v) > 0.5) real.set.call(el, v); } },
          scrollTo: { configurable: true, value: (...a) => { const y = typeof a[0] === 'object' ? a[0] && a[0].top : a[1]; if (y && Math.abs(y) > 0.5) proto.scrollTo.apply(el, a); } },
        };
        let res;
        try {
          Object.defineProperties(el, props);
          res = orig.call(this, 0);
        } finally {
          for (const k of Object.keys(props)) delete el[k];
          if (typeof this.lastScroll === 'number') this.lastScroll = el.scrollTop;
        }
        putSectionsBack(this);
        keepOrder(el);   // (the rest of a continued block back after it, before measuring what moved)
        // nothing on screen moves
        if (anchor && anchor.isConnected) {
          const d = anchor.getBoundingClientRect().top - anchorTop;
          if (Math.abs(d) > 0.5) el.scrollTop += d;
        }
        return res;
      };
      r._lpAll = orig;
      this.patchedRenderers.push(r);
      try { r.updateVirtualDisplay(); } catch (e) { /* the next scroll will do it */ }
    }
  }

  scan(force) {
    try { this.keepAllSections(); } catch (e) { /* Obsidian internals changed: leave them */ }
    this.applyPaperThemes();
    document.querySelectorAll(SEL_VIEW).forEach((view) => {
      let st = this.states.get(view);
      if (!st) {
        st = { undo: [], busy: false, timer: 0, scrollAt: 0 };
        // lay the pages out again only when the note really changed: not when Obsidian just moves
        // a block that is already there, takes one off and puts it straight back, etc.
        st.obs = new MutationObserver((recs) => {
          if (st.busy) return;
          keepOrder(view);
          // the note changed (also: opened, or shown again in reading view after editing): until it
          // is laid out again, only the paper shows, not its blocks half in their old places
          if (changedNote(recs)) { view.classList.add('lp-pending'); this.queue(view, st); }
        });
        // (and never while scrolling: see queue())
        st.onScroll = () => { st.scrollAt = performance.now(); };
        view.addEventListener('scroll', st.onScroll, { passive: true });
        st.obs.observe(view, { childList: true, subtree: true });
        st.ro = new ResizeObserver(() => { if (!st.busy) this.queue(view, st); });
        st.ro.observe(view);
        // (the page shadows and labels follow the note's height at once, without waiting for a layout)
        const sizer = view.querySelector('.markdown-preview-sizer');
        st.sheetRo = new ResizeObserver(() => this.syncSheets(view));
        if (sizer) st.sheetRo.observe(sizer);
        this.states.set(view, st);
        view.classList.add('lp-pending');
        this.queue(view, st);
      } else if (force) {
        this.queue(view, st);
      }
    });
  }

  queue(view, st) {
    window.clearTimeout(st.timer);
    // a layout takes a moment on a long note: wait until scrolling has stopped, so it never
    // interrupts it
    const run = () => {
      if (performance.now() - st.scrollAt < 300) { st.timer = window.setTimeout(run, 150); return; }
      this.layout(view, st);
    };
    // a note just opened or changed (only its paper shows meanwhile): laid out at once, on the next
    // frame (the changes Obsidian makes together are in by then); anything else after a short pause
    if (view.classList.contains('lp-pending') && performance.now() - st.scrollAt >= 300) {
      window.cancelAnimationFrame(st.frame);
      st.frame = window.requestAnimationFrame(() => { window.clearTimeout(st.timer); run(); });
      return;
    }
    st.timer = window.setTimeout(run, 120);
  }

  layout(view, st) {
    if (!view.isConnected || st.busy) return;
    st.busy = true;
    const started = performance.now();   // (how often and how long: the layout report shows it)
    const sc = view.scrollTop;
    // (what is at the top of the screen stays exactly there)
    const anchor = sc > 0 ? screenAnchor(view) : null;
    const anchorTop = anchor && anchor.getBoundingClientRect().top;
    try {
      this.undoAll(st);
      drawArrows(view);   // (the arrows, if a part of the note was not drawn yet: kept, nothing to undo)
      if (document.body.classList.contains('lp-no-pages')) { this.showNoteDates(view); return; }
      if (!view.offsetParent) return; // hidden
      unwrapQuotedBlocks(view, st.undo);
      liftSummaries(view, st.undo);
      autoBreaks(view, st.undo);
      this.showNoteDates(view);   // (after autoBreaks: it knows which titles start a page)
      unwrapCalloutEmbeds(view, st.undo);
      tidyEmbedLines(view, st.undo);
      markEmptyHeads(view, st.undo);
      alignEmbeds(view, st.undo);
      alignEmbedCopies(view, st.undo);
      fitTitles(view, st.undo);
      addSummarySizer(view);
      anchorMidSummaries(view, st.undo);
      if (this.cssPaged()) {
        // the browser paginates with CSS (lined-paper.css): only add the sheet shadows + labels
        if (this.decorate(view, st) !== false) {
          view.classList.add('lp-paged');
          st.undo.push({ t: 'cls', el: view, name: 'lp-paged' });
        }
      } else if (this.paginate(view, st) !== false) {
        view.classList.add('lp-paged');
        st.undo.push({ t: 'cls', el: view, name: 'lp-paged' });
      }
    } catch (e) {
      console.error('[lined-paper-pages]', e);
      if (!this.errorShown) {
        this.errorShown = true;
        new Notice('Lined Paper Pages could not lay out this note: ' + (e && e.message ? e.message : e) + ' (details in the developer console)');
      }
    } finally {
      this.syncSheets(view);
      view.scrollTop = sc;
      if (anchor && anchor.isConnected) {
        const d = anchor.getBoundingClientRect().top - anchorTop;
        if (Math.abs(d) > 0.5) view.scrollTop += d;
      }
      st.obs.takeRecords();
      st.busy = false;
      st.layouts = (st.layouts || 0) + 1;
      st.lastMs = Math.round(performance.now() - started);
      // laid out (or nothing to lay out): the note shows again (see lp-pending in lined-paper.css)
      if (view.offsetParent || document.body.classList.contains('lp-no-pages')) view.classList.remove('lp-pending');
    }
  }

  undoAll(st) {
    for (let i = st.undo.length - 1; i >= 0; i--) {
      const u = st.undo[i];
      try {
        switch (u.t) {
          case 'style':
            u.block.style.removeProperty('padding-top');
            u.v.style.removeProperty('margin-top');
            u.block._lpStyled = false;
            u.block._lpTopWide = false;
            break;
          case 'p':
            u.orig.append(...Array.from(u.np.childNodes));
            u.np.remove();
            u.orig.normalize();
            break;
          case 'l':
            u.orig.append(...Array.from(u.nl.children));
            u.nl.remove();
            break;
          case 'move': u.to.append(...u.nodes); break;
          case 'cont': u.w.remove(); break;
          case 'el': u.el.remove(); break;
          case 'grp':
            if (u.cue) u.cb.append(u.cue);
            if (u.notes) { u.nb.append(u.notes); if (u.nb !== u.cb) u.nb.style.removeProperty('display'); }
            u.bq.remove();
            break;
          case 'prop': u.el.style.removeProperty(u.name); break;
          case 'cls': u.el.classList.remove(u.name); break;
          case 'attr': u.el.removeAttribute(u.name); break;
          case 'unq': u.c.replaceWith(u.bq); u.bq.append(u.c); break;
          case 'lift': if (u.mark.isConnected) u.mark.replaceWith(u.sum); break;
          case 'text': u.node.data = u.data; break;
        }
      } catch (e) { /* node was re-rendered by Obsidian: nothing to undo */ }
    }
    st.undo = [];
  }

  // newer Chromium can split the note into page-sized columns itself (column-height + column-wrap);
  // lined-paper.css then does the pagination and this plugin must not move anything
  // the date property of the note shown in `el` (a reading view, or the PDF export: the open note)
  noteDate(el) {
    const info = this.noteDateInfo(el);
    return info ? formatDate(info.value) : '';
  }
  // the dates in the title bars of the note in `root`: page 1 and every later page with a # title
  showNoteDates(root) {
    const info = this.noteDateInfo(root);
    let fm = info ? info.fm : null;
    if (root.closest('.print') || root.matches('.print')) fm = fm || this.exportFm || null;
    // (no note found, as can happen while a PDF is made: the dates already there stay)
    if (!info && !fm) return;
    showDates(root, info ? this.noteDate(root) : frontmatterDate(fm), listValue(fm && fm['page-dates']));
  }
  // the note shown in `el` (a reading view, or the PDF export: the open note), and its date property:
  // { file, key (null: none yet), value }
  noteDateInfo(el) {
    try {
      const app = this.app, ws = app && app.workspace;
      if (!ws || !app.metadataCache) return null;
      let file = null;
      if (el && !el.closest('.print') && ws.getLeavesOfType) {
        const leaf = ws.getLeavesOfType('markdown').find((l) => l.view && l.view.containerEl && l.view.containerEl.contains(el));
        file = leaf && leaf.view.file;
      }
      if (!file && ws.getActiveFile) file = ws.getActiveFile();
      if (!file) return null;
      const cache = app.metadataCache.getFileCache(file);
      const fm = cache && cache.frontmatter;
      const key = dateKey(fm);
      return { file, key, value: key ? fm[key] : '', fm: fm || null };
    } catch (e) { return null; }
  }

  onDateClick(e) {
    const d = e.target && e.target.closest && e.target.closest('.lp-prop-date');
    const view = d && d.closest(SEL_VIEW);
    if (!view) return;
    e.preventDefault();
    e.stopPropagation();
    this.editDate(view, d, parseInt(d.dataset.lpPage || '0', 10) || 0);
  }

  // Change the date: a date picker over the date in the title bar (or, when the note has no date
  // yet, over the title bar's corner); the new date goes into the note's date property
  // (YYYY-MM-DD) on Enter or when the picker is left (Esc: no change). A date property that is not a plain date (free text) is edited as text.
  editDate(el, anchor, page = 0) {
    const info = this.noteDateInfo(el);
    if (!info || !info.file) { new Notice('Lined Paper Pages: open a note first'); return null; }
    document.querySelectorAll('.lp-date-picker').forEach((p) => p.remove());
    // (a later page: its own date in page-dates, else the note's date to start from)
    const own = page > 0 ? (listValue(info.fm && info.fm['page-dates'])[page - 1] || '') : null;
    const current = own || info.value;
    const iso = isoDate(current);
    const text = !iso && String(current || '').trim() !== '';
    const input = document.createElement('input');
    input.type = text ? 'text' : 'date';
    input.className = 'lp-date-picker';
    input.value = text ? String(current) : iso;
    input.setAttribute('aria-label', 'Date of this note');
    const r = anchor ? anchor.getBoundingClientRect() : null;
    const w = text ? 200 : 160;
    input.style.cssText = `position:fixed;z-index:1000;width:${w}px;` +
      (r && r.width ? `top:${Math.max(4, r.top - 2)}px;left:${Math.max(4, r.right - w)}px;` : 'top:80px;right:40px;');
    document.body.appendChild(input);
    let done = false;
    const close = (save) => {
      if (done) return;
      done = true;
      const v = input.value.trim();
      input.remove();
      if (!save || v === (text ? String(current) : iso)) return;
      const app = this.app;
      if (!app.fileManager || !app.fileManager.processFrontMatter) return;
      app.fileManager.processFrontMatter(info.file, (fm) => {
        if (page > 0) {
          const list = listValue(fm['page-dates']);
          while (list.length < page) list.push('');
          list[page - 1] = v;
          while (list.length && !list[list.length - 1]) list.pop();
          if (list.length) fm['page-dates'] = list; else delete fm['page-dates'];
          return;
        }
        const key = dateKey(fm) || 'date';
        if (v) fm[key] = v; else delete fm[key];
      });
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); close(true); }
      else if (e.key === 'Escape') { e.preventDefault(); close(false); }
    });
    input.addEventListener('blur', () => window.setTimeout(() => close(true), 0));
    input.focus();
    try { if (input.type === 'date' && input.showPicker) input.showPicker(); } catch (e) { /* (only from a click) */ }
    return input;
  }

  layoutReport() {
    // (the note on screen: the open tab's reading view)
    const views = Array.from(document.querySelectorAll(SEL_VIEW));
    const view = views.find((v) => v.offsetParent && v.closest('.workspace-leaf.mod-active')) || views.find((v) => v.offsetParent) || views[0];
    const r = {
      plugin: this.manifest && this.manifest.version,
      chrome: (typeof process !== 'undefined' && process.versions && process.versions.chrome) || navigator.userAgent,
      cssPages: this.cssPaged(),
      body: Array.from(document.body.classList).filter((c) => /^(lp-|cn-|theme-)/.test(c)),
      settings: this.settings,
      snippets: (() => { try { return Array.from(this.app.customCss.enabledSnippets); } catch (e) { return null; } })(),
      view: null,
    };
    if (!view) return r;
    const sizer = view.querySelector('.markdown-preview-sizer');
    const top = sizer ? sizer.getBoundingClientRect().top : 0;
    const P = px(view, 'var(--page-h)'), L = px(view, 'var(--line)'), E = px(view, 'var(--body-end)');
    const at = (el) => { const b = el.getBoundingClientRect(); const y = b.top - top; return { page: Math.floor(y / P) + 1, row: +((y - Math.floor(y / P) * P) / L).toFixed(2), rows: +(b.height / L).toFixed(2) }; };
    const st = this.states.get(view);
    r.view = {
      classes: Array.from(view.classList), P, L, bodyEnd: E,
      layouts: st && st.layouts, lastLayoutMs: st && st.lastMs,
      sheets: view.querySelectorAll('.lp-sheet').length,
      sizerHeight: sizer && sizer.getBoundingClientRect().height,
      titles: Array.from(view.querySelectorAll('h1')).map((h) => ({ text: h.textContent.trim().slice(0, 30), block: h.parentElement.className, prev: h.parentElement.previousElementSibling && h.parentElement.previousElementSibling.className, ...at(h) })),
      summaries: Array.from(view.querySelectorAll('.callout[data-callout="summary"]')).map((x) => {
        const brk = breakAfter(topBlock(x));
        const above = brk ? partEnd(brk) : [];
        return {
          text: x.textContent.trim().slice(7, 37), mid: isMidSummary(x), inGroup: !!x.closest('blockquote'), style: x.getAttribute('style'), ...at(x),
          // (where the content above it ends, and the shape of its block: tags and classes, no text)
          above: above.map((a) => ({ cls: (a.getAttribute('data-callout') || a.className || a.tagName).slice(0, 30), bottomRow: +((a.getBoundingClientRect().bottom - top) / L).toFixed(2) })),
          next: brk ? +(((nextPageBlock(brk) ? brk.nextElementSibling : brk).getBoundingClientRect().top - top) / L).toFixed(2) : null,
          shape: (function shape(el, d) { return el.tagName.toLowerCase() + (el.getAttribute('data-callout') ? '[' + el.getAttribute('data-callout') + ']' : el.className ? '.' + String(el.className).split(' ')[0] : '') + (d < 5 && el.children.length ? '(' + Array.from(el.children).slice(0, 8).map((c) => shape(c, d + 1)).join(' ') + ')' : ''); })(topBlock(x), 0),
        };
      }),
      // each block embed: where it is, how far it was pulled up, and the shape of its line (tags,
      // classes and the kind of text: no words of the note)
      embeds: Array.from(view.querySelectorAll('.internal-embed[src*="#^"]')).filter((e) => !e.parentElement.closest('.internal-embed')).slice(0, 20).map((e) => {
        const line = e.parentElement.closest('.callout-content, .markdown-preview-section > div') || e.parentElement;
        const shape = (el, d) => Array.from(el.childNodes).slice(0, 12).map((c) => c.nodeType === 3 ? (VISIBLE.test(c.data) ? 'text' : JSON.stringify(c.data.replace(/[^\s\u200b-\u200d\u2060\ufeff]/g, '')).slice(0, 12)) : c.nodeType !== 1 ? '' :
          c.tagName.toLowerCase() + (c.className && typeof c.className === 'string' ? '.' + c.className.trim().split(/\s+/).slice(0, 2).join('.') : '') + (getComputedStyle(c).display === 'none' ? '!' : '') + (d < 7 && c.childNodes.length ? '(' + shape(c, d + 1) + ')' : '')).filter(Boolean).join(' ');
        return { pull: e.style.getPropertyValue('--lp-embed-pull') || '0', ...at(e), line: shape(line, 0).slice(0, 1500) };
      }),
      sections: sizer ? Array.from(sizer.children).map((c) => c.className.slice(0, 40)).slice(0, 200) : [],
    };
    return r;
  }

  cssPaged() {
    if (this._css === undefined) {
      this._css = !!(window.CSS && CSS.supports('column-wrap', 'wrap') && CSS.supports('column-height', '1px'));
      console.debug('[lined-paper-pages] ' + (this._css ? 'CSS pagination (column-wrap) available: plugin only adds sheet shadows + labels'
                                                       : 'no CSS pagination in this Obsidian: plugin paginates reading view'));
    }
    return this._css;
  }

  decorate(view, st) {
    const sizer = view.querySelector('.markdown-preview-sizer');
    if (!sizer) return false;
    const L = px(view, 'var(--line)');
    if (!(L > 4)) return false;
    const B = rows(view, '--bar-lines');
    const P = px(view, 'var(--page-h)');
    this.markPageTops(view, sizer, st, P, B, L);
    if (view.classList.contains('cornell')) this.placePartSummaries(view, sizer, st, P, L);
  }

  // The browser's own pages: a summary of a part (before a new # title or [!nextpage]) goes on the
  // bottom lines of the page that part ends on, worked out from where its notes really are on the
  // pages (as the plugin's own pages do it), not from CSS anchors: on screen, where the browser puts
  // the pages, those landed the summary in the footer. (The PDF keeps its anchors: there they work.)
  placePartSummaries(view, sizer, st, P, L) {
    const E = px(view, 'var(--body-end)');
    const sumRows = rows(view, '--summary-rows'), sumMin = rows(view, '--summary-min-rows');
    const T = 2;
    // (all measured, then all placed, then all checked: one layout of the note for each, not one per summary)
    const t0 = sizer.getBoundingClientRect().top;
    const plans = [];
    for (const sum of view.querySelectorAll('.callout[data-callout="summary"]')) {
      if (sum.closest('.markdown-embed:not(.lp-embed-copy)')) continue;
      const brk = breakAfter(topBlock(sum));
      if (!brk) continue;
      // where the part's writing ends (its last group's cue and notes text, or its last block)
      const above = partEnd(brk);
      if (!above.length) continue;
      const usedEnd = Math.max(...above.map((a) => {
        const c = a.querySelector(':scope > .callout-content');
        return (c || a).getBoundingClientRect().bottom - t0;
      }));
      const copy = topBlock(sum).querySelector('.cn-sum-sizer');
      const need = Math.max(sumMin, copy ? Math.round(copy.getBoundingClientRect().height / L) : 0);
      let j = Math.max(0, Math.floor((usedEnd - T) / P));
      const used = usedEnd > j * P + T ? j * P + Math.ceil((usedEnd - j * P - T) / L) * L : 0;
      if (used && j * P + E - (used + L) < need * L - 0.5) j++;     // + the blank line
      const bodyEnd = j * P + E;
      let top = bodyEnd - Math.max(sumRows, need) * L;
      if (used > j * P) top = Math.min(Math.max(top, used + L), bodyEnd - need * L);
      plans.push({ sum, top, height: bodyEnd - top });
    }
    const set = (sum, name, val) => { if (sum.style.getPropertyValue(name) === '') st.undo.push({ t: 'prop', el: sum, name }); sum.style.setProperty(name, val, 'important'); };
    for (const p of plans) { set(p.sum, 'bottom', 'auto'); set(p.sum, 'min-height', '0px'); set(p.sum, 'height', p.height + 'px'); set(p.sum, 'top', p.top + 'px'); }
    // (where the browser's pages put it may differ from the offset given: measured, and corrected)
    if (!plans.length) return;
    const t1 = sizer.getBoundingClientRect().top;
    const offs = plans.map((p) => (p.sum.getBoundingClientRect().top - t1) - p.top);
    plans.forEach((p, k) => { if (Math.abs(offs[k]) > 0.5) set(p.sum, 'top', p.top - offs[k] + 'px'); });
  }

  // a [!wide] block that starts the body of sheet 2, 3 ... has no red line above it
  markPageTops(view, sizer, st, P, B, L) {
    if (view.classList.contains('cornell')) {
      const top0 = sizer.getBoundingClientRect().top;
      for (const w of sizer.querySelectorAll('.callout[data-callout="wide"]')) {
        const y = w.getBoundingClientRect().top - top0;
        const k = Math.floor((y + L / 2) / P);
        if (k > 0 && Math.abs(y - (k * P + (B + 1) * L)) < L / 3) {
          w.classList.add('cn-page-top');
          st.undo.push({ t: 'cls', el: w, name: 'cn-page-top' });
        }
      }
    }
  }

  // The page furniture: a shadow under every sheet and, from sheet 2, the Cues | Notes labels in
  // its header. Kept up to date on its own, as soon as the note's height changes (a ResizeObserver
  // calls this before the page is drawn), so a new page has its labels in the very frame it
  // appears in; a layout never takes them away and puts them back.
  syncSheets(view) {
    const sizer = view.querySelector('.markdown-preview-sizer');
    if (!sizer) return;
    let n = 0, P = 0, G = 0, B = 0, L = 0;
    if (view.isConnected && view.offsetParent && !document.body.classList.contains('lp-no-pages')) {
      L = px(view, 'var(--line)');
      if (L > 4) {
        B = rows(view, '--bar-lines');
        P = px(view, 'var(--page-h)');
        G = px(view, 'var(--sheet-gap, 0px)');
        n = Math.max(1, Math.round((sizer.getBoundingClientRect().height + G) / P));
      }
    }
    const keep = (cls, count, place) => {
      const have = Array.from(sizer.querySelectorAll(':scope > .' + cls));
      while (have.length > count) have.pop().remove();
      while (have.length < count) { const d = document.createElement('div'); d.className = cls; sizer.appendChild(d); have.push(d); }
      have.forEach((d, k) => {
        for (const [prop, value] of Object.entries(place(k))) if (d.style[prop] !== value) d.style[prop] = value;
      });
    };
    keep('lp-sheet', n, (k) => ({ top: k * P + 'px', height: P - G + 'px' }));
    keep('lp-hdr', view.classList.contains('cornell') ? Math.max(0, n - 1) : 0, (k) => ({ top: (k + 1) * P + B * L + 'px' }));
  }

  paginate(view, st) {
    // In Obsidian the sizer IS the section (<div class="markdown-preview-sizer markdown-preview-section">);
    // some versions / themes nest them. Accept both.
    const sizer = view.querySelector('.markdown-preview-sizer');
    const section = sizer && (sizer.matches('.markdown-preview-section') ? sizer : sizer.querySelector('.markdown-preview-section'));
    if (!section) {
      if (!this.warnedStructure) { this.warnedStructure = true; console.warn('[lined-paper-pages] reading view structure not found (no .markdown-preview-sizer / -section)'); }
      return false;
    }

    const cornell = view.classList.contains('cornell');
    const L = px(view, 'var(--line)');
    if (!(L > 4)) {
      if (!this.warnedLine) { this.warnedLine = true; console.warn('[lined-paper-pages] row height not found: is lined-paper.css enabled?'); }
      return false;
    }
    const B = rows(view, '--bar-lines');
    const N = rows(view, '--body-rows');
    const P = px(view, 'var(--page-h)');                     // one sheet + the gap after it
    const G = px(view, 'var(--sheet-gap, 0px)');               // desk between two sheets
    const c = cornell ? 1 : 0;
    const T = L / 3;                                         // tolerance: boxes are whole rows; ignore sub-pixel rounding
    const E0 = (B + N) * L;                                  // where the writing area of sheet 1 ends
    const sumMin = cornell ? rows(view, '--summary-min-rows') : 0;
    const sumRows = cornell ? rows(view, '--summary-rows') : 0;
    const start = (k) => (k === 0 ? 0 : k * P + (B + c) * L); // first body row of sheet k
    const end = (k) => k * P + E0;                             // end of the body of sheet k

    const sizerTop = () => sizer.getBoundingClientRect().top;
    const relTop = (el) => el.getBoundingClientRect().top - sizerTop();
    const vis = (b) => b.querySelector(':scope > :not(.lp-embed-unwrapped)') || b;
    // a `# Title` right after [!nextpage] is the title of the next sheet (laid out, below); the
    // note's own title, on sheet 1, is not
    const afterBreak = (b) => nextPageBlock(b.previousElementSibling) || breaksBefore(b);
    const pageTitle = (b) => !!b.querySelector(':scope > h1') && afterBreak(b);
    const skip = (b) =>
      b.matches('.metadata-container,.frontmatter-container,.mod-header,.mod-footer,.markdown-preview-pusher,.lp-sheet,.lp-hdr') ||
      (b.querySelector(':scope > h1') && !pageTitle(b)) ||
      b.querySelector(':scope > .callout[data-callout="summary"]') ||
      b.querySelector(':scope > .callout[data-callout="question"]');
    // where a block's writing ends: for a cue/notes group the bottom of its cue and notes (a summary
    // written straight under the last group sits in the group's quote, with its invisible copy in a
    // row of its own below them, which is not writing)
    const bottomOf = (v) => {
      const cols = v.tagName === 'BLOCKQUOTE' ? v.querySelectorAll(':scope > .callout:is([data-callout="cue"], [data-callout="notes"])') : [];
      if (!cols.length) return v.getBoundingClientRect().bottom;
      return Math.max(...Array.from(cols, (c) => c.getBoundingClientRect().bottom));
    };

    const place = (block, v, target) => {
      if (!block._lpStyled) { block._lpStyled = true; st.undo.push({ t: 'style', block, v }); }
      block.style.setProperty('padding-top', '0px', 'important');
      v.style.setProperty('margin-top', '0px', 'important');
      const t = relTop(v);
      block.style.setProperty('padding-top', Math.max(0, target - t) + 'px', 'important');
    };

    // the bottom of the ruled row a glyph box sits in
    const rowBottom = (rc) => (rc.top + rc.bottom) / 2 + L / 2;

    // First character whose row ends below `limit` (document coordinates), or null when all of
    // `el` fits. Works line by line, whether the lines come from <br>, from Enter (pre-line text)
    // or from soft wrapping. `first` = nothing of `el` fits.
    const findBreak = (el, limit) => {
      const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const r = document.createRange();
      const charRect = (n, i) => { r.setStart(n, i); r.setEnd(n, i + 1); return r.getClientRects()[0] || null; };
      let seen = false;
      for (let n = tw.nextNode(); n; n = tw.nextNode()) {
        const s = n.data;
        // whole text node fits? (its last visible character is above the limit)
        let last = s.length - 1;
        while (last >= 0 && /\s/.test(s[last])) last--;
        if (last < 0) continue;
        const lr = charRect(n, last);
        if (lr && rowBottom(lr) <= limit + T) { seen = true; continue; }
        for (let i = 0; i <= last; i++) {
          if (/\s/.test(s[i])) continue;
          const rc = charRect(n, i);
          if (!rc) continue;
          if (rowBottom(rc) > limit + T) return { node: n, offset: i, first: !seen, row: rowBottom(rc) };
          seen = true;
        }
      }
      return null;
    };

    // Split one block of text (a paragraph, a list item) between two lines at `limit`, the way the
    // PDF (Chromium) breaks it with orphans / widows 2 (lined-paper.css section 9): at least 2 lines
    // stay on this sheet, and at least 2 go to the next one, but only when the text has 4 lines or
    // more (with 3 lines Chromium drops the widows rule and moves just the last line). Returns the
    // moved part (a copy of `el` holding the lines that don't fit), or null when `el` moves whole.
    const splitText = (el, limit) => {
      if (el.matches('h1, h2, h3, h4, h5, h6')) return null;
      const top = el.getBoundingClientRect().top;
      const lines = Math.round(el.getBoundingClientRect().height / L);
      const above = (br) => Math.round((br.row - top) / L) - 1;     // whole lines above the break
      let br = findBreak(el, limit);
      if (!br || br.first) return null;
      if (lines >= 4 && lines - above(br) < 2) {                     // keep 2 lines together on the next sheet
        br = findBreak(el, limit - (2 - (lines - above(br))) * L);
        if (!br || br.first) return null;
      }
      if (above(br) < 2) return null;                                // and 2 on this one
      const rg = document.createRange();
      rg.setStart(br.node, br.offset);
      rg.setEndAfter(el.lastChild);
      const np = el.cloneNode(false);
      np.append(rg.extractContents());
      // a line break left at the very start of the moved part would print as an empty row
      while (np.firstChild && (np.firstChild.nodeName === 'BR' ||
             (np.firstChild.nodeType === 3 && !np.firstChild.data.trim()))) np.firstChild.remove();
      return np;
    };

    // Where a container (a block, or the content of a cue / notes callout) has to be cut at
    // `limit`. null = all of it fits. `kept` = something stays on this sheet. Only a cut that
    // keeps something touches the DOM (a paragraph / list is split in two), so a caller that
    // gives up when nothing is kept has nothing to undo. `recs` = undo records, in push order.
    const cut = (content, limit) => {
      const kids = Array.from(content.children);
      const idx = kids.findIndex((el) => el.getBoundingClientRect().bottom > limit + T);
      if (idx < 0) return null;
      const el = kids[idx];
      const after = kids.slice(idx + 1);
      let first = null, recs = [], moveNodes = after;

      if (el.tagName === 'UL' || el.tagName === 'OL') {
        const lis = Array.from(el.children);
        const j = lis.findIndex((li) => li.getBoundingClientRect().bottom > limit + T);
        // the item on the break is split between its lines too; its rest has no bullet / number
        const lj = j >= 0 && lis[j].getBoundingClientRect().top < limit - T ? splitText(lis[j], limit) : null;
        if (j > 0 || lj) {
          const nl = el.cloneNode(false);
          if (el.tagName === 'OL') {
            // (the continued item still takes its number, so the next item keeps the right one)
            nl.setAttribute('start', String((parseInt(el.getAttribute('start') || '1', 10) || 1) + j));
          }
          if (lj) lj.style.setProperty('list-style-type', 'none');
          nl.append(...(lj ? [lj] : []), ...lis.slice(lj ? j + 1 : j));
          recs.push({ t: 'l', orig: el, nl });
          if (lj) recs.push({ t: 'p', orig: lis[j], np: lj });
          first = nl;
        }
      } else if (!el.matches('table, pre, .image-embed, p:has(> img), .callout, blockquote')) {
        const np = splitText(el, limit);
        if (np) { recs.push({ t: 'p', orig: el, np }); first = np; }
      }
      if (!first) {                       // this element moves whole
        first = el;
        moveNodes = [el, ...after];
      }
      return { kept: idx > 0 || recs.length > 0, first, after, moveNodes, recs };
    };
    // undo records for a cut whose moved part now lives in another container
    const pushCut = (k, content) => {
      st.undo.push({ t: 'move', nodes: k.moveNodes.filter((n) => n !== k.first || !k.recs.length), to: content });
      st.undo.push(...k.recs);
    };

    // Split a too-tall cue/notes group at `limit`. Each column is cut on its own: the notes that
    // don't fit continue in the notes column of a copy of the group, and a cue that doesn't fit
    // continues in its cue column (otherwise the continuation's cue is blank). The caller places
    // the copy at the top of the next sheet's body. A group may have no cue (notes on their own).
    const split = (block, v, limit) => {
      const cols = [];
      for (const c of v.querySelectorAll(':scope > .callout:is([data-callout="cue"], [data-callout="notes"])')) {
        const content = c.querySelector(':scope > .callout-content');
        if (content) cols.push({ c, content, k: null });
      }
      if (!cols.some((x) => x.c.dataset.callout === 'notes')) return null;

      for (const x of cols) x.k = cut(x.content, limit);
      if (cols.every((x) => !x.k)) return null;
      // nothing would stay behind: the caller moves the whole group instead
      if (!cols.some((x) => (x.k ? x.k.kept : x.content.children.length > 0))) return null;
      // a column none of which stays (e.g. two lines of notes with only room for one: a paragraph
      // keeps at least 2 lines together) moves whole, and in the PDF it takes the group's row with
      // it: the whole group starts on the next sheet, its cue too
      if (cols.some((x) => x.k && !x.k.kept)) return null;

      const wrapper = block.cloneNode(false);
      wrapper.classList.add('lp-cont');                         // (the rest of a block, on the next sheet)
      wrapper.classList.remove('lp-break-before');
      wrapper._lpAfter = block;                                    // (kept right after it: keepOrder)
      wrapper.style.removeProperty('padding-top');                 // (a pushed block's padding is copied too)
      const g = v.cloneNode(false);
      g.style.removeProperty('margin-top');                        // starts right on the first body row
      for (const x of cols) {
        const cc = x.c.cloneNode(true);
        const ccContent = cc.querySelector(':scope > .callout-content');
        ccContent.replaceChildren(...(x.k ? [x.k.first, ...x.k.after] : []));   // blank column when all of it fits
        g.append(cc);
      }
      wrapper.append(g);
      block.after(wrapper);

      st.undo.push({ t: 'cont', w: wrapper });
      for (const x of cols) if (x.k) pushCut(x.k, x.content);
      return wrapper;
    };

    // ---------- separate [!cue] / [!notes] callouts -> treat each pair as one grouped block ----------
    // A [!notes] callout without a cue in front of it becomes a group of its own (notes only), so it
    // too stays in the notes column and continues there on the next sheet.
    if (cornell) {
      const bl = Array.from(section.children).filter((b) => !b.matches('.lp-sheet, .lp-hdr'));   // (the page furniture isn't a block)
      let prevGroup = false;
      for (let i = 0; i < bl.length; i++) {
        const cb = bl[i];
        const cue = cb.querySelector(':scope > .callout[data-callout="cue"]');
        const lone = !cue && cb.querySelector(':scope > .callout[data-callout="notes"]');
        if (!cue && !lone) { if (cb.getBoundingClientRect().height) prevGroup = false; continue; }
        const bq = document.createElement('blockquote');
        cb.append(bq);
        let notes = lone, nb = null;
        if (cue) {
          bq.append(cue);
          nb = bl[i + 1];
          notes = nb && nb.querySelector(':scope > .callout[data-callout="notes"]');
        }
        if (notes) bq.append(notes);
        if (notes && nb) {
          nb.style.setProperty('display', 'none', 'important');
          i++;
        }
        if (prevGroup) bq.style.setProperty('margin-top', L + 'px', 'important');
        st.undo.push({ t: 'grp', cb, bq, cue, notes, nb: nb || cb });
        prevGroup = true;
      }
    }

    // ---------- walk the blocks ----------
    // A heading is never left at the bottom of a sheet with its text on the next one (the PDF has
    // break-after: avoid on h2-h6): when the block after it starts a new sheet, the heading moves too.
    const keepWithHeading = (prev, k) => {
      if (!prev) return false;
      const pv = vis(prev.block);
      if (!pv.matches('h2, h3, h4, h5, h6')) return false;
      const pt = relTop(pv);
      if (Math.max(0, Math.floor((pt + 0.5) / P)) !== k || pt <= start(k) + 0.5) return false;
      place(prev.block, pv, start(k + 1));
      return true;
    };
    let prev = null;
    const gaps = new Map();
    // > [!nextpage]: what follows starts on the next sheet (lastForced = the last sheet it opened)
    let forceNext = null, lastForced = 0;
    for (let idx = 0; idx < section.children.length; idx++) {
      const block = section.children[idx];
      // (a `# Title` marked to start a new page breaks right where it is, like a [!nextpage] above it)
      const autoBreak = breaksBefore(block);
      if (autoBreak || block.querySelector(':scope > .callout[data-callout="nextpage"]')) {
        const y = block.getBoundingClientRect().top - sizerTop();
        const k = Math.max(0, Math.floor((y + 0.5) / P));
        // (already in the gap before sheet k's body, with nothing of sheet k above it: sheet k is next)
        forceNext = k > 0 && y <= start(k) + 0.5 ? k : k + 1;
        // a summary just before it: on the bottom rows of the sheet the part above ends on (the same
        // rule as the summary at the end of the note), and the next part starts on the sheet after it
        // (the summary of the part this break ends: the last one since the part began, in a block of
        // its own or written inside the part's last group)
        let ms = null;
        if (cornell) {
          for (let p = block.previousElementSibling; p && !nextPageBlock(p); p = p.previousElementSibling) {
            const found = Array.from(p.querySelectorAll('.callout[data-callout="summary"]')).filter((x) => !x.closest('.markdown-embed:not(.lp-embed-copy)')).pop();
            if (found) { ms = found; break; }
            if (breaksBefore(p)) break;
          }
        }
        if (ms) {
          let usedEnd = 0;
          for (let p = block.previousElementSibling; p; p = p.previousElementSibling) {
            if (p.matches('.lp-sheet, .lp-hdr, .markdown-preview-pusher, .mod-header, .metadata-container') || p.querySelector(':scope > .callout[data-callout="summary"]')) continue;
            const v = vis(p);
            if (v.getBoundingClientRect().height) { usedEnd = bottomOf(v) - sizerTop(); break; }
          }
          const copy = ms.parentElement.querySelector(':scope > .cn-sum-sizer');
          const need = Math.max(sumMin, copy ? Math.round(copy.getBoundingClientRect().height / L) : 0);
          let j = Math.max(0, Math.floor((usedEnd - T) / P));
          const used = usedEnd > j * P + T ? j * P + Math.ceil((usedEnd - j * P - T) / L) * L : 0;
          if (used && j * P + E0 - (used + L) < need * L - 0.5) j++;     // + the blank line
          const bodyEnd = j * P + E0;
          let top = bodyEnd - Math.max(sumRows, need) * L;
          if (used > j * P) top = Math.min(Math.max(top, used + L), bodyEnd - need * L);
          for (const [name, val] of [['top', top + 'px'], ['bottom', 'auto'], ['height', bodyEnd - top + 'px'], ['min-height', '0px']]) {
            ms.style.setProperty(name, val, 'important');
            st.undo.push({ t: 'prop', el: ms, name });
          }
          forceNext = j + 1;
        }
        lastForced = Math.max(lastForced, forceNext);
        prev = null;
        if (!autoBreak) continue;
      }
      if (skip(block)) continue;
      if (forceNext != null && vis(block).getBoundingClientRect().height) { block._lpForce = forceNext; forceNext = null; }
      // a [!wide] straight under a sheet's `# Title` sits on the header's Cues | Notes row, as under
      // the note's title on sheet 1
      if (vis(block).matches('.callout[data-callout="wide"]') && block.previousElementSibling && pageTitle(block.previousElementSibling)) block._lpTopWide = true;
      let guard = 0, back = false;
      // (measured once per layout: place() sets the margin to 0, and a block can be placed twice)
      if (!gaps.has(block)) gaps.set(block, parseFloat(getComputedStyle(vis(block)).marginTop) || 0);
      const gap = gaps.get(block);
      const toNext = (v, k, target) => {                     // start `block` on sheet k + 1
        if (keepWithHeading(prev, k)) { back = true; return; }
        place(block, v, target);
      };
      while (guard++ < 40 && !back) {
        const v = vis(block);
        const r = v.getBoundingClientRect();
        if (!r.height) break;
        const t = r.top - sizerTop();
        const b = bottomOf(v) - sizerTop();

        if (block._lpForce != null) {
          // a [!wide] block that starts the page after [!nextpage] sits one row higher, on the header's
          // Cues | Notes row (it draws its own under its red line, like the essential question)
          const topWide = v.matches('.callout[data-callout="wide"]') && afterBreak(block);
          // a `# Title` after [!nextpage] goes in the sheet's title bar, at the very top of the sheet
          // (cornell-notes.css / lined-paper.css draw it there: it is moved up with `top`)
          const title = pageTitle(block);
          const target = title ? block._lpForce * P : start(block._lpForce) - (topWide ? L : 0);
          block._lpTopWide = !!(topWide || title);
          block._lpForce = null;
          place(block, v, target);
          continue;
        }
        const k = Math.max(0, Math.floor((t + 0.5) / P));
        if (k > 0 && t < start(k) - 0.5 && !block._lpTopWide) { place(block, v, start(k)); continue; }   // inside the header band
        // The blank line above a group belongs to the group (in the PDF it is padding on the group's
        // block, and a page never breaks between that padding and the group): a group that starts a
        // new sheet takes its blank line along, so it starts one row below the first body row.
        const next = start(k + 1) + (gap > T && !v.matches('.callout[data-callout="wide"]') ? L : 0);
        if (t >= end(k) - 0.5) { toNext(v, k, next); continue; }                     // inside the footer
        if (b <= end(k) + T) break;                                                  // fits

        // crosses the end of the body
        const isGroup = cornell && v.tagName === 'BLOCKQUOTE' && v.querySelector(':scope > .callout[data-callout="notes"]');
        if (isGroup) {
          const w = split(block, v, sizerTop() + end(k));
          if (w) { w._lpForce = k + 1; continue; }
        } else {
          // any other block (paragraph, list) breaks between its lines, like in the PDF: the lines
          // that don't fit continue at the top of the next sheet's body
          const c = cut(block, sizerTop() + end(k));
          if (c && c.kept) {
            const w = block.cloneNode(false);
            w.classList.add('lp-cont');
            w.classList.remove('lp-break-before');
            w._lpAfter = block;
            w.style.removeProperty('padding-top');
            w.append(c.first, ...c.after);
            block.after(w);
            st.undo.push({ t: 'cont', w });
            pushCut(c, block);
            w._lpForce = k + 1;
            continue;
          }
        }
        // can't be split here: start it on the next sheet. A group is moved even when it is taller
        // than a whole body, because at the top of a sheet it can be split (its notes then fill the
        // rest of that sheet and continue on the next one instead of running into the footer).
        if ((isGroup || b - t <= end(k) - start(k)) && t > start(k) + 0.5) { toNext(v, k, next); continue; }
        break; // taller than a whole body and can't be split: let it run
      }
      if (back) { idx = prev.idx - 1; prev = null; continue; }   // lay out again from the heading
      if (vis(block).getBoundingClientRect().height) prev = { idx, block };
    }

    // ---------- sheet count, summary, header labels ----------
    let maxB = 0;
    for (const block of Array.from(section.children)) {
      if (skip(block)) continue;
      const v = vis(block);
      if (v.getBoundingClientRect().height) maxB = Math.max(maxB, bottomOf(v) - sizerTop());
    }
    let n = Math.max(1, Math.floor((maxB - T) / P) + 1, lastForced + 1);
    // (the summary at the end of the note: not one written before a [!nextpage], placed above)
    const sum = Array.from(sizer.querySelectorAll('.callout[data-callout="summary"]')).filter((x) => !isMidSummary(x)).pop();

    // SUMMARY: always the last rows of the body of the last sheet.
    //   it needs its label row + every line of its text, and never less than --summary-min-rows (3);
    //   always at least ONE blank ruled line between the last notes and the summary;
    //   enough room   -> the full --summary-rows (5) rows at the bottom (more if its text needs them);
    //   a bit less    -> it shrinks to the rows that are left, down to what it needs;
    //   less than that-> a new sheet, where it takes its full rows at the bottom again.
    let sumTop = 0, sumH = 0;
    if (sum) {
      const copy = sum.parentElement && sum.parentElement.querySelector(':scope > .cn-sum-sizer');
      const textRows = copy ? Math.round(copy.getBoundingClientRect().height / L) : 0;
      const need = Math.max(sumMin, textRows);
      const sheetTop = (n - 1) * P;
      const used = maxB > sheetTop + T ? sheetTop + Math.ceil((maxB - sheetTop - T) / L) * L : 0;
      if (used && (n - 1) * P + E0 - (used + L) < need * L - 0.5) n++;     // + the blank line
      const bodyEnd = (n - 1) * P + E0;
      sumTop = bodyEnd - Math.max(sumRows, need) * L;
      if (used > (n - 1) * P) sumTop = Math.min(Math.max(sumTop, used + L), bodyEnd - need * L);
      sumH = bodyEnd - sumTop;
    }

    sizer.style.setProperty('min-height', n * P - G + 'px', 'important');   // no gap after the last sheet
    sizer.style.setProperty('height', n * P - G + 'px', 'important');
    st.undo.push({ t: 'prop', el: sizer, name: 'min-height' });
    st.undo.push({ t: 'prop', el: sizer, name: 'height' });

    if (sum) {
      for (const [name, val] of [['top', sumTop + 'px'], ['bottom', 'auto'], ['height', sumH + 'px'], ['min-height', '0px']]) {
        sum.style.setProperty(name, val, 'important');
        st.undo.push({ t: 'prop', el: sum, name });
      }
    }

    this.markPageTops(view, sizer, st, P, B, L);
  }
};
module.exports.paperClasses = paperClasses;   // (for the tests)
module.exports.insertBlock = insertBlock;
module.exports.TEMPLATES = TEMPLATES;
module.exports.colourRuns = colourRuns;
module.exports.setDateProperty = setDateProperty;
module.exports.formatDate = formatDate;
module.exports.isoDate = isoDate;
module.exports.addPageDate = addPageDate;
module.exports.sectionDates = sectionDates;
module.exports.wrapSelection = wrapSelection;
module.exports.restyleLine = restyleLine;
module.exports.drawArrows = drawArrows;
module.exports.markBullets = markBullets;
module.exports.noteThemeClasses = noteThemeClasses;
module.exports.frontmatterDate = frontmatterDate;
// ---------- the settings page: Settings → Lined Paper Pages ----------
class LinedPaperSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
    this.showAdvanced = false;
  }

  display() {
    const { containerEl } = this;
    const pl = this.plugin;
    containerEl.empty();
    containerEl.createEl('p', {
      text: 'Lined Paper Pages ' + ((pl.manifest && pl.manifest.version) || '') + '. Changes show straight away. Use the ↺ button next to a setting to put it back to its default. '
        + 'Add  cssclasses: [lined-paper, cornell]  to a note\'s properties to use it.',
      cls: 'setting-item-description',
    });
    new Setting(containerEl)
      .setName('Reset everything')
      .setDesc('Put every setting on this page back to its default.')
      .addButton((b) => b.setButtonText('Reset all').setWarning().onClick(async () => {
        pl.settings = {};
        await pl.saveData(pl.settings);
        pl.applySettings();
        this.display();
      }));

    let inAdvanced = false;
    for (const def of SETTINGS) {
      if (def.section) {
        inAdvanced = !!def.advanced;
        if (inAdvanced) {
          new Setting(containerEl).setHeading().setName(def.section);
          new Setting(containerEl)
            .setName('Show advanced settings')
            .setDesc(def.desc)
            .addToggle((t) => t.setValue(this.showAdvanced).onChange((on) => { this.showAdvanced = on; this.display(); }));
        } else {
          const h = new Setting(containerEl).setHeading().setName(def.section);
          if (def.desc) h.setDesc(def.desc);
        }
        continue;
      }
      if (inAdvanced && !this.showAdvanced) continue;
      const stored = pl.settings[def.key];
      const value = stored === undefined ? def.def : stored;
      const row = new Setting(containerEl).setName(def.name);
      if (def.desc) row.setDesc(def.desc);
      if (def.type === 'toggle') {
        row.addToggle((t) => t.setValue(value).onChange((on) => pl.setSetting(def.key, on === def.def ? undefined : on)));
      } else if (def.type === 'slider') {
        const show = (v) => (def.pct ? Math.round(v * 100) + '%' : v + (def.unit || ''));
        let label;
        row.addSlider((sl) => sl.setLimits(def.min, def.max, def.step).setValue(value).setDynamicTooltip()
          .onChange((v) => { label.setText(show(v)); pl.setSetting(def.key, v === def.def ? undefined : v); }));
        label = row.controlEl.createSpan({ text: show(value), cls: 'lp-setting-value' });
        row.controlEl.prepend(label);
      } else if (def.type === 'color') {
        row.addColorPicker((c) => c.setValue(value).onChange((v) => pl.setSetting(def.key, v)));
        if (stored === undefined) row.descEl.createDiv({ text: 'Default (follows the theme)', cls: 'lp-setting-default' });
      } else if (def.type === 'select') {
        row.addDropdown((d) => {
          for (const [o, label] of Object.entries(def.options)) d.addOption(o, label);
          d.setValue(def.options[value] ? value : def.def);
          d.onChange((v) => pl.setSetting(def.key, v === def.def ? undefined : v));
        });
      } else if (def.type === 'font') {
        // a list of fonts, plus any other font installed on the computer
        const other = stored !== undefined && !FONTS.includes(stored);
        row.addDropdown((d) => {
          for (const f of FONTS) d.addOption(f, f + (FONTS.indexOf(f) >= FONTS.length - 3 ? ' (installed)' : ''));
          d.addOption('__other', 'Other (type a name)…');
          d.setValue(other ? '__other' : value);
          d.onChange(async (v) => {
            if (v === '__other') { this.otherFont = def.key; this.display(); return; }
            this.otherFont = null;
            await pl.setSetting(def.key, v === def.def ? undefined : v);
          });
        });
        if (other || this.otherFont === def.key) {
          row.addText((t) => t.setPlaceholder('Font name').setValue(other ? stored : '')
            .onChange((v) => pl.setSetting(def.key, v.trim() ? v.trim() : undefined)));
        }
      } else {   // text
        row.addText((t) => t.setPlaceholder(def.def).setValue(stored || '')
          .onChange((v) => pl.setSetting(def.key, v.trim() ? v.trim() : undefined)));
      }
      row.addExtraButton((b) => b.setIcon('rotate-ccw').setTooltip('Back to default').onClick(async () => {
        await pl.setSetting(def.key, undefined);
        this.display();
      }));
    }
  }
}
