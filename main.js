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
  { key: 'lp-body-rows', type: 'slider', min: 20, max: 48, step: 1, def: 32, name: 'Lines per page',
    desc: 'Ruled lines on each A4 page (not counting the title bar and footer). Fewer lines = bigger writing.' },
  { key: 'lp-text', type: 'slider', min: 14, max: 40, step: 1, def: 22, unit: 'px', name: 'Text size' },
  { key: 'lp-title', type: 'slider', min: 24, max: 80, step: 1, def: 48, unit: 'px', name: 'Title size' },
  { key: 'lp-title-drop', type: 'slider', min: 0, max: 1.2, step: 0.05, def: 0.8, name: 'Title position',
    desc: 'How far down the title sits in its bar, in lines. 0.8 = on the double line like handwriting; less lifts it off the line.' },
  { key: 'lp-hand', type: 'font', def: 'Patrick Hand', name: 'Handwriting font',
    desc: 'The writing on the page. The handwriting fonts download automatically; the last three must be installed on your computer.' },
  { key: 'lp-hand-title', type: 'font', def: 'Caveat', name: 'Title font' },
  { key: 'links', type: 'toggle', cls: 'lp-link-underline', def: false, name: 'Underline links',
    desc: 'Links are shown in their colour only, like writing. Switch this on to underline them.' },

  { section: 'Cornell notes' },
  { key: 'cn-cue', type: 'slider', min: 0.15, max: 0.5, step: 0.01, def: 0.3, pct: true, name: 'Cue column width',
    desc: 'Share of the page for the cue column (left of the divider).' },
  { key: 'cn-question-lines', type: 'slider', min: 1, max: 6, step: 1, def: 1, name: 'Essential question lines',
    desc: 'Ruled lines kept for the [!question] at the top of the page.' },
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

function px(view, expr) {
  const d = document.createElement('div');
  d.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;width:0;height:' + expr;
  view.appendChild(d);
  const h = d.getBoundingClientRect().height;
  d.remove();
  return h;
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
function fitTitles(root, undo) {
  for (const h of root.querySelectorAll('h1')) {
    const view = h.closest('.markdown-preview-view.lined-paper');
    if (!view || h.closest('.markdown-embed')) continue;
    const had = h.classList.contains('lp-title-wrap'), hadFit = h.classList.contains('lp-title-fit');
    const hadAdjust = h.style.getPropertyValue('--lp-title-adjust') !== '';
    h.classList.remove('lp-title-wrap', 'lp-title-fit');         // (measured on one line, full size)
    h.style.removeProperty('--lp-title-fit');
    h.style.removeProperty('--lp-title-adjust');
    const range = document.createRange();
    range.selectNodeContents(h);
    const cs = getComputedStyle(h);
    const size = parseFloat(cs.fontSize);
    if (!size || !h.textContent.trim()) continue;
    let ratio;
    if (document.body.classList.contains('lp-no-pages') && view.closest('.markdown-reading-view')) {
      // (no A4 pages: the bar is the pane's width)
      ratio = (h.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) / range.getBoundingClientRect().width;
    } else {
      const room = px(view, '210mm') - px(view, 'var(--pad-x)') - px(view, 'var(--pad-r)');
      ratio = room / ((range.getBoundingClientRect().width / size) * px(view, 'calc(var(--lp-title, 48px) * var(--print-scale))'));
    }
    if (ratio >= 1) { /* fits */ }
    else if (ratio >= TITLE_MIN) {
      h.classList.add('lp-title-fit');
      h.style.setProperty('--lp-title-fit', String(Math.floor(ratio * 100) / 100));
      if (undo && !hadFit) undo.push({ t: 'cls', el: h, name: 'lp-title-fit' }, { t: 'prop', el: h, name: '--lp-title-fit' });
    } else {
      h.classList.add('lp-title-wrap');
      if (undo && !had) undo.push({ t: 'cls', el: h, name: 'lp-title-wrap' });
    }
    // onto the line: the (last line's) baseline on the top of the double line, 7px above the bar's end.
    // (Measured on the first line, the title held on one line: an export is prepared in a window that
    // is not A4 wide, so how it wraps there says nothing. A two-line title's last line is one line lower.)
    const probe = document.createElement('span');
    probe.style.cssText = 'display:inline-block;width:0;height:0;';
    h.style.setProperty('white-space', 'nowrap', 'important');
    h.appendChild(probe);
    let base = probe.getBoundingClientRect().bottom - h.getBoundingClientRect().top;
    probe.remove();
    h.style.removeProperty('white-space');
    if (h.classList.contains('lp-title-wrap')) base += parseFloat(getComputedStyle(h).lineHeight);
    const want = px(view, 'calc(var(--line) * (var(--bar-lines) - 0.8 + var(--lp-title-drop, 0.8)))') - 7;
    h.style.setProperty('--lp-title-adjust', (Math.round((want - base) * 4) / 4) + 'px');
    if (undo && !hadAdjust) undo.push({ t: 'prop', el: h, name: '--lp-title-adjust' });
  }
  fitQuestions(root, undo);
}

// The [!question]'s text is ONE line: it never wraps (lined-paper.css / cornell-notes.css), and a
// question too long for the line is made smaller until it fits (--lp-q-fit).
function fitQuestions(root, undo) {
  for (const c of root.querySelectorAll('.lined-paper .callout[data-callout="question"] > .callout-content')) {
    if (c.closest('.markdown-embed:not(.lp-embed-copy)')) continue;
    const had = c.style.getPropertyValue('--lp-q-fit') !== '';
    c.style.removeProperty('--lp-q-fit');
    let ratio = 1;
    for (const b of c.children) {
      const range = document.createRange();
      range.selectNodeContents(b);
      const w = range.getBoundingClientRect().width, room = b.clientWidth;
      if (w && room) ratio = Math.min(ratio, room / w);
    }
    if (ratio < 1) {
      c.style.setProperty('--lp-q-fit', String(Math.floor(ratio * 100) / 100));
      if (undo && !had) undo.push({ t: 'prop', el: c, name: '--lp-q-fit' });
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

// ---------- coloured text: <font color="..."> ... </font>, <span style="color: ..."> ... </span> ----------
// Obsidian does not turn a [[link]] inside such a tag into a link everywhere (it can come out as
// plain text, or not at all). The plugin shows the text in its colour with the link working: in
// editing view through an editor extension, in reading view and the PDF by rebuilding the tag.
const COLOUR_RE = /<font\b[^>]*?\bcolor\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>(.*?)<\/font\s*>|<span\b[^>]*?\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>(.*?)<\/span\s*>/gi;
const SAFE_COLOUR = /^[#\w(),.%\s-]+$/;
// every coloured run in one line of source: where it is, where its text is, its colour
function colourRuns(text) {
  const out = [];
  COLOUR_RE.lastIndex = 0;
  for (let m; (m = COLOUR_RE.exec(text));) {
    let colour, inner;
    if (m[4] !== undefined) { colour = m[1] ?? m[2] ?? m[3]; inner = m[4]; }
    else {
      const c = /(?:^|;)\s*color\s*:\s*([^;]+)/i.exec(m[5] ?? m[6] ?? '');
      if (!c) continue;
      colour = c[1].trim(); inner = m[7];
    }
    if (!SAFE_COLOUR.test(colour)) continue;
    const innerFrom = m.index + m[0].indexOf('>') + 1;
    out.push({ from: m.index, to: m.index + m[0].length, innerFrom, innerTo: innerFrom + inner.length, colour, inner });
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
}
// reading view / PDF: a coloured tag whose [[link]] did not come out as a link is rebuilt from the
// note's source (or from its own text, when the link was left there as plain text)
function fixColouredLinks(el, ctx, open) {
  const tags = Array.from(el.querySelectorAll('font[color], span[style*="color"]'));
  if (!tags.length) return;
  let runs = [];
  try {
    const info = ctx && ctx.getSectionInfo && ctx.getSectionInfo(el);
    if (info) runs = colourRuns(info.text.split('\n').slice(info.lineStart, info.lineEnd + 1).join('\n'));
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
    eq(o) { return o.run.colour === this.run.colour && o.run.inner === this.run.inner; }
    toDOM() {
      const s = document.createElement('span');
      s.className = 'lp-colour';
      s.style.color = this.run.colour;
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
            b.add(line.from + r.innerFrom, line.from + r.innerTo, V.Decoration.mark({ class: 'lp-colour', attributes: { style: 'color: ' + r.colour } }));
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
  const real = (n) => !(n.nodeType === 3 && !n.textContent.trim()) && !(n.nodeType === 1 && n.matches('.lp-sheet, .lp-hdr'));
  return [...added].some(real) || [...removed].some(real);
}

// the first block at the top of the screen in a reading view (to keep it where it is)
function screenAnchor(scroller) {
  const sizer = scroller.querySelector('.markdown-preview-sizer');
  if (!sizer) return null;
  const top = scroller.getBoundingClientRect().top;
  for (const b of sizer.children) {
    if (b.matches('.markdown-preview-pusher, .mod-header, .lp-sheet, .lp-hdr')) continue;
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
  for (const s of secs) {
    const el = s && s.el;
    if (!el) continue;
    if (el.parentNode === sizer) { prev = el; continue; }
    if (el.parentNode || !el.childNodes.length) { all = false; continue; }
    if (prev) prev.after(el); else sizer.prepend(el);
    prev = el;
  }
  if (all && r.pusherEl) r.pusherEl.style.marginBottom = '0px';
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
      if (ws.onLayoutReady) ws.onLayoutReady(() => this.hintOldSnippets());
    });
    this.addSettingTab(new LinedPaperSettingTab(this.app, this));

    const again = () => this.scheduleScan(true);
    this.registerEvent(this.app.workspace.on('layout-change', again));
    this.registerEvent(this.app.workspace.on('active-leaf-change', again));
    this.registerEvent(this.app.workspace.on('file-open', again));
    // coloured text with links: editing view
    const colourExt = colourEditorExtension(this);
    if (colourExt && this.registerEditorExtension) this.registerEditorExtension(colourExt);
    this.registerMarkdownPostProcessor((el, ctx) => {
      // coloured text with links: reading view and PDF
      const openLink = (href, e) => this.app.workspace.openLinkText(href, (ctx && ctx.sourcePath) || '', !!(e && (e.ctrlKey || e.metaKey)));
      fixColouredLinks(el, ctx, openLink);
      window.setTimeout(() => fixColouredLinks(el, ctx, openLink), 0);
      // (also runs for PDF export; the callout may only be built after this, so look again shortly)
      // (reading view unwraps embeds in layout(), where it can be undone when the note changes)
      const prep = () => { if (!el.closest('.markdown-reading-view')) { unwrapCalloutEmbeds(el); fitTitles(el); } addSummarySizer(el); };
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
    this.registerDomEvent(document, 'load', (e) => {
      const view = e.target && e.target.tagName === 'IMG' && e.target.closest(SEL_VIEW);
      const st = view && this.states.get(view);
      if (st) this.queue(view, st);
    }, true);
    // PDF export: make sure every summary has its copy before the page is printed
    this.registerDomEvent(window, 'beforeprint', () => { unwrapCalloutEmbeds(document.body); fitTitles(document.body); addSummarySizer(document.body); });
    this.registerInterval(window.setInterval(() => {
      if (this.setDpr()) again(); // (moved to a screen with other display scaling)
      this.scan(false);
      // PDF export: an embed that filled in late
      for (const pr of document.querySelectorAll('.print')) { unwrapCalloutEmbeds(pr); fitTitles(pr); addSummarySizer(pr); }
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
    console.debug('[lined-paper-pages] loaded');

    if (document.fonts && document.fonts.ready) document.fonts.ready.then(again);
    this.errorShown = false;
    this.scheduleScan(true);
  }

  // put every stored setting on <body> (and take off the ones that were reset)
  // The two CSS snippets are now part of the plugin (styles.css). Snippets left switched on from an
  // earlier install do no harm (every rule is just there twice), but they can go: say so, once.
  hintOldSnippets() {
    const css = this.app.customCss;
    const on = css && css.enabledSnippets;
    if (!on || this.settings.oldSnippetsHinted) return;
    const names = ['lined-paper', 'cornell-notes'].filter((n) => (on.has ? on.has(n) : Array.isArray(on) && on.includes(n)));
    if (!names.length) return;
    new Notice(`Lined Paper Pages now includes its own styles. You can switch off the snippet${names.length > 1 ? 's' : ''} ` +
      `${names.map((n) => `"${n}"`).join(' and ')} in Settings → Appearance → CSS snippets.`, 20000);
    this.settings.oldSnippetsHinted = true;
    this.saveData(this.settings);
  }

  applySettings() {
    const b = document.body;
    for (const def of SETTINGS) {
      if (!def.key) continue;
      const v = this.settings[def.key];
      if (def.type === 'toggle') {
        // (at its default it leaves the class alone, so a Style Settings toggle still works)
        if (v !== undefined) { b.classList.toggle(def.cls, def.invert ? !v : v); this.ownClasses.add(def.cls); }
        else if (this.ownClasses.has(def.cls)) { b.classList.remove(def.cls); this.ownClasses.delete(def.cls); }
      } else if (v === undefined || v === '') {
        b.style.removeProperty('--' + def.key);
      } else {
        b.style.setProperty('--' + def.key, cssValue(def, v));
      }
    }
    this.scheduleScan(true);
  }

  async setSetting(key, v) {
    if (v === undefined) delete this.settings[key]; else this.settings[key] = v;
    await this.saveData(this.settings);
    this.applySettings();
  }

  onunload() {
    for (const def of SETTINGS) {
      if (!def.key || this.settings[def.key] === undefined) continue;
      if (def.type === 'toggle') { if (this.ownClasses.has(def.cls)) document.body.classList.remove(def.cls); }
      else document.body.style.removeProperty('--' + def.key);
    }
    document.body.style.removeProperty('--lp-dpr');
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
    this._t = window.setTimeout(() => this.scan(force), 150);
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
    document.querySelectorAll(SEL_VIEW).forEach((view) => {
      let st = this.states.get(view);
      if (!st) {
        st = { undo: [], busy: false, timer: 0, scrollAt: 0 };
        // lay the pages out again only when the note really changed: not when Obsidian just moves
        // a block that is already there, takes one off and puts it straight back, etc.
        st.obs = new MutationObserver((recs) => { if (!st.busy && changedNote(recs)) this.queue(view, st); });
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
    st.timer = window.setTimeout(run, 120);
  }

  layout(view, st) {
    if (!view.isConnected || st.busy) return;
    st.busy = true;
    const sc = view.scrollTop;
    // (what is at the top of the screen stays exactly there)
    const anchor = sc > 0 ? screenAnchor(view) : null;
    const anchorTop = anchor && anchor.getBoundingClientRect().top;
    try {
      this.undoAll(st);
      if (document.body.classList.contains('lp-no-pages')) return;
      if (!view.offsetParent) return; // hidden
      unwrapCalloutEmbeds(view, st.undo);
      fitTitles(view, st.undo);
      addSummarySizer(view);
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
        }
      } catch (e) { /* node was re-rendered by Obsidian: nothing to undo */ }
    }
    st.undo = [];
  }

  // newer Chromium can split the note into page-sized columns itself (column-height + column-wrap);
  // lined-paper.css then does the pagination and this plugin must not move anything
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
    const skip = (b) =>
      b.matches('.metadata-container,.frontmatter-container,.mod-header,.mod-footer,.markdown-preview-pusher,.lp-sheet,.lp-hdr') ||
      b.querySelector(':scope > h1') ||
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

      const wrapper = block.cloneNode(false);
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
      if (block.querySelector(':scope > .callout[data-callout="nextpage"]')) {
        const y = block.getBoundingClientRect().top - sizerTop();
        const k = Math.max(0, Math.floor((y + 0.5) / P));
        // (already in the gap before sheet k's body, with nothing of sheet k above it: sheet k is next)
        forceNext = k > 0 && y <= start(k) + 0.5 ? k : k + 1;
        lastForced = Math.max(lastForced, forceNext);
        prev = null;
        continue;
      }
      if (skip(block)) continue;
      if (forceNext != null && vis(block).getBoundingClientRect().height) { block._lpForce = forceNext; forceNext = null; }
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
          const topWide = v.matches('.callout[data-callout="wide"]') && block.previousElementSibling &&
            block.previousElementSibling.querySelector(':scope > .callout[data-callout="nextpage"]');
          const target = start(block._lpForce) - (topWide ? L : 0);
          block._lpTopWide = !!topWide;
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
    const sum = sizer.querySelector('.callout[data-callout="summary"]');

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
