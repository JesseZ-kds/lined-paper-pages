'use strict';
// Text sizes (Settings → Text sizes, and a few words small / big / huge): each kind of writing its own
// size, never moving a line. Every block stays where it was, the same number of rows high.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { openReading, closeBrowsers } = require('./lib/harness');
const { SRC, FAKES } = require('./lib/fakes');
const { title, group, block } = require('./lib/notes');

after(closeBrowsers);

const note = {
  name: 'sizes', cornell: true,
  blocks: [
    title('Sizes'),
    block('<h2>Ahead two</h2>'),
    block('<h3>Ahead three</h3>'),
    block('<h4>Ahead four</h4>'),
    block('<p>Some <span class="lp-small">Asmall</span> and <span class="lp-big">Abig</span> and <span class="lp-huge">Ahuge</span> <span class="lp-big"><span class="pen-circle">Acircled</span></span> words.</p>'),
    block('<ul><li>Alist one</li><li>Alist two</li></ul>'),
    block('<blockquote><p>Aquoted</p></blockquote>'),
    block('<table><thead><tr><th>Ahead</th></tr></thead><tbody><tr><td>Acell</td></tr></tbody></table>'),
    group('<p>Acue here?</p>', '<ul><li>Anote one</li></ul><p>Anote para</p>'),
  ],
};

const SIZES = { h2: 1.4, h3: 1.2, h4: 0.9, list: 0.85, quote: 1.15, table: 0.8, cue: 1.3, notes: 0.9 };

test('text sizes: each kind of writing its own size, on the same lines as before', async () => {
  const { page, context } = await openReading(note, { theme: 'theme-light', viewport: { width: 1000, height: 1400 } });
  try {
    const measure = () => page.evaluate(() => {
      const fs = (sel) => parseFloat(getComputedStyle(document.querySelector(sel)).fontSize);
      const blocks = [...document.querySelectorAll('.markdown-preview-section > div')].map((d) => { const r = d.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.height)]; });
      const p = document.querySelector('p:has(.lp-big)');
      return {
        text: fs('p:has(.lp-big)'), h2: fs('h2'), h3: fs('h3'), h4: fs('h4'), list: fs('.el-div > ul li'), quote: fs('blockquote > p'), table: fs('td'),
        cue: fs('.callout[data-callout="cue"] .callout-content p'), notes: fs('.callout[data-callout="notes"] .callout-content p'), notesList: fs('.callout[data-callout="notes"] li'),
        small: fs('.lp-small'), big: fs('.lp-big'), huge: fs('.lp-huge'), circled: fs('.pen-circle'),
        line: parseFloat(getComputedStyle(p).lineHeight), pHeight: Math.round(p.getBoundingClientRect().height), blocks,
      };
    });
    const before = await measure();
    // (every kind the same size at first: the text size)
    for (const k of ['h2', 'h3', 'h4', 'list', 'quote', 'table']) assert.equal(before[k], before.text, `${k} starts at the text size`);
    await page.evaluate((S) => { for (const [k, v] of Object.entries(S)) document.body.style.setProperty('--lp-size-' + k, String(v)); }, SIZES);
    const after = await measure();
    const near = (a, b, what) => assert.ok(Math.abs(a - b) < 0.6, `${what}: ${a} (want ${b.toFixed(2)})`);
    near(after.h2, before.h2 * SIZES.h2, 'h2');
    near(after.h3, before.h3 * SIZES.h3, 'h3');
    near(after.h4, before.h4 * SIZES.h4, 'h4');
    near(after.list, before.list * SIZES.list, 'list');
    near(after.quote, before.quote * SIZES.quote, 'quote');
    near(after.table, before.table * SIZES.table, 'table');
    near(after.cue, before.cue * SIZES.cue, 'cue column');
    near(after.notes, before.notes * SIZES.notes, 'notes column');
    near(after.notesList, before.notesList * SIZES.notes * SIZES.list, 'a list in the notes column');
    // a few words: small, big, huge, and a circled word in big writing
    near(after.small, after.text * 0.8, 'small');
    near(after.big, after.text * 1.25, 'big');
    near(after.huge, after.text * 1.5, 'huge');
    near(after.circled, after.text * 1.25, 'a mark inside big writing');
    // nothing moved: the line with big and huge words is one row, every block where it was
    assert.equal(after.pHeight, Math.round(after.line), 'the line with big words is one row');
    assert.deepEqual(after.blocks, before.blocks, 'every block where it was, as high as it was');
  } finally {
    await context.close();
  }
});

test('Aa on the toolbar and Mark: text … put a size on the selection, and take it off', async () => {
  const { page, context } = await openReading({ name: 'size-cmds', cornell: true, blocks: [] }, { theme: 'theme-light', src: SRC });
  try {
    await page.evaluate(FAKES);
    const r = await page.evaluate(() => {
      const plugin = window.plugin;
      const cmds = {};
      plugin.addCommand = (c) => { cmds[c.id] = c; };
      plugin.constructor.addPaperCommands(plugin);
      const run = (id, ed) => (cmds[id].editorCallback ? cmds[id].editorCallback(ed) : cmds[id].editorCheckCallback(false, ed));
      const out = {};
      const ed = window.makeEditor('a few words here', { line: 0, ch: 2 }, { line: 0, ch: 11 });
      run('size-big', ed); out.big = ed.text;
      run('size-huge', ed); out.huge = ed.text;
      run('size-normal', ed); out.normal = ed.text;
      const ed2 = window.makeEditor('a <span class="pen-circle">circled</span> word', { line: 0, ch: 0 }, { line: 0, ch: 46 });
      run('size-small', ed2); out.nested = ed2.text;
      run('remove-all-styles', ed2); out.cleared = ed2.text;
      const bar = plugin.toolbarFor({ getMode: () => 'source' });
      out.menu = [...bar.querySelectorAll('.lp-tb-menuwrap')].filter((w) => w.querySelector('.lp-tb-size')).map((w) => [...w.querySelectorAll('.lp-tb-item')].map((i) => i.dataset.cmd));
      out.hotkeys = ['size-small', 'size-big', 'size-huge', 'size-normal'].map((id) => plugin.hotkeyLabel(id));
      return out;
    });
    assert.equal(r.big, 'a <span class="lp-big">few words</span> here');
    assert.equal(r.huge, 'a <span class="lp-huge">few words</span> here');
    assert.equal(r.normal, 'a few words here');
    assert.equal(r.nested, '<span class="lp-small">a <span class="pen-circle">circled</span> word</span>');
    assert.equal(r.cleared, 'a circled word');
    assert.deepEqual(r.menu, [['size-small', 'size-big', 'size-huge', 'size-normal']]);
    assert.ok(r.hotkeys.every(Boolean), 'each size has a hotkey: ' + r.hotkeys);
  } finally {
    await context.close();
  }
});

test('text sizes while writing (Live Preview): the same sizes, each line one row', async () => {
  const { browser, CSS, SIM } = require('./lib/harness');
  const b = await browser(false);
  const context = await b.newContext({ viewport: { width: 900, height: 800 } });
  try {
    const page = await context.newPage();
    const line = (id, cls, html) => `<div class="cm-line ${cls}" id="${id}">${html}</div>`;
    await page.setContent(`<!doctype html><html><head><style>html,body{margin:0}</style><style>${SIM}</style><style>${CSS}</style></head><body class="theme-light">
<div class="markdown-source-view cm-s-obsidian mod-cm6 is-live-preview lined-paper cornell"><div class="cm-editor"><div class="cm-scroller"><div class="cm-sizer"><div class="cm-contentContainer"><div class="cm-content">
<div class="cm-line HyperMD-header HyperMD-header-1">Title</div>
${line('p', '', 'Plain <span class="lp-colour lp-huge">Ahuge</span> and <span class="lp-colour lp-big">Abig</span>')}
${line('h2', 'HyperMD-header HyperMD-header-2', '<span class="cm-formatting cm-formatting-header cm-header cm-header-2">## </span><span class="cm-header cm-header-2">Ahead</span>')}
${line('li', 'HyperMD-list-line HyperMD-list-line-1', '<span class="cm-formatting cm-formatting-list">- </span><span class="cm-list-1">Alist</span>')}
${line('q', 'HyperMD-quote HyperMD-quote-1', '<span class="cm-formatting cm-formatting-quote">&gt; </span><span class="cm-quote">Aquote</span>')}
${line('c', 'HyperMD-quote HyperMD-quote-2 HyperMD-callout', '<span class="cm-quote">&gt;&gt; [!cue]</span>')}
</div></div></div></div></div></div></body></html>`);
    await page.evaluate(() => { for (const [k, v] of Object.entries({ h2: 1.4, list: 0.8, quote: 1.2 })) document.body.style.setProperty('--lp-size-' + k, String(v)); });
    const r = await page.evaluate(() => {
      const d = document.createElement('div'); d.style.cssText = 'position:absolute;height:var(--line)';
      document.querySelector('.lined-paper').appendChild(d); const L = d.getBoundingClientRect().height; d.remove();
      const fs = (sel) => parseFloat(getComputedStyle(document.querySelector(sel)).fontSize);
      const ids = ['p', 'h2', 'li', 'q', 'c'];
      return { L, heights: ids.map((id) => Math.round(document.getElementById(id).getBoundingClientRect().height)), text: fs('#p'), huge: fs('#p .lp-huge'), h2: fs('#h2 .cm-header-2:last-child'), li: fs('#li .cm-list-1'), q: fs('#q .cm-quote'), c: fs('#c .cm-quote') };
    });
    assert.deepEqual(r.heights, Array(5).fill(Math.round(r.L)), 'each line one row');
    const near = (a, b, what) => assert.ok(Math.abs(a - b) < 0.6, `${what}: ${a} (want ${b.toFixed(2)})`);
    near(r.huge, r.text * 1.5, 'huge');
    near(r.h2, r.text * 1.4, '## heading');
    near(r.li, r.text * 0.8, 'list');
    near(r.q, r.text * 1.2, 'quote');
    near(r.c, r.text, 'a callout\'s line (>> [!cue]) is not a quote');
  } finally {
    await context.close();
  }
});
