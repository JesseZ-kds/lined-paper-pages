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

test('Paper: subjects: a notebook for each subject, its topics and notes inside, in the theme\'s colours', async () => {
  const { page, context } = await openReading({ name: 'subjects', cornell: true, blocks: [] }, { theme: 'theme-light', src: SRC, viewport: { width: 1000, height: 800 } });
  try {
    await page.evaluate(FAKES);
    const r = await page.evaluate(async () => {
      const plugin = window.plugin;
      const day = 86400000, now = Date.now();
      const list = [['Subjects/RS/Beginning of Life/Abortion.md', 0], ['Subjects/RS/Beginning of Life/IVF.md', 1], ['Subjects/RS/End of Life/Euthanasia.md', 5], ['Subjects/RS/Plan.md', 2],
        ['Subjects/Biology/Cells/Mitosis.md', 3], ['Subjects/Chemistry Higher Tier/Rates/Rates.md', 9], ['Definitions/Foetus.md', 0], ['Home.md', 0]];
      const { vault, open } = window.makeVault(plugin, Object.fromEntries(list.map(([p]) => [p, '# x'])));
      for (const [p, d] of list) vault.files[p].stat = { mtime: now - d * day };
      plugin.settings._srs = {};
      const host = document.createElement('div');
      document.body.appendChild(host);
      const view = {};
      plugin.drawSubjects(host, view);
      const out = {};
      out.books = [...host.querySelectorAll('.lp-sj-book')].map((b) => [b.querySelector('.lp-sj-name').textContent, b.querySelector('.lp-sj-meta').textContent, b.style.getPropertyValue('--lp-sj-c')]);
      out.topicsOnCover = [...host.querySelectorAll('.lp-sj-book')].map((b) => [...b.querySelectorAll('.lp-sj-topiclist > span')].map((s) => s.textContent));
      out.sub = host.querySelector('.lp-sj-sub').textContent;
      // (a long name: smaller, never cut in the middle of a word)
      const long = host.querySelector('.lp-sj-book[data-path="Subjects/Chemistry Higher Tier"] .lp-sj-name');
      out.long = long.className;
      host.querySelector('.lp-sj-book[data-path="Subjects/RS"]').click();
      out.open = view.open;
      out.title = host.querySelector('.lp-sj-title').textContent;
      out.topics = [...host.querySelectorAll('.lp-sj-topic')].map((t) => [t.querySelector('.lp-sj-topic-name').textContent, [...t.querySelectorAll('.lp-sj-note-name')].map((n) => n.textContent)]);
      host.querySelector('.lp-sj-note[data-path="Subjects/RS/End of Life/Euthanasia.md"]').click();
      await new Promise((r) => setTimeout(r, 20));
      out.opened = open.slice();
      host.querySelector('.lp-sj-back').click();
      out.back = [view.open, host.querySelectorAll('.lp-sj-book').length];
      // (no Subjects folder: the vault's own folders, but Definitions, Quotes …)
      const v2 = window.makeVault(plugin, { 'Maths/Algebra/Quadratics.md': '', 'Definitions/x.md': '', 'Templates/t.md': '' });
      plugin.drawSubjects(host, {});
      out.noRoot = [[...host.querySelectorAll('.lp-sj-name')].map((n) => n.textContent), host.querySelector('.lp-sj-sub').textContent];
      return out;
    });
    assert.deepEqual(r.books.map((b) => b[0]), ['Biology', 'Chemistry Higher Tier', 'RS'], 'a notebook for each subject (not Definitions, not a note at the top)');
    assert.deepEqual(r.books.map((b) => b[1]), ['1 topic · 1 note', '1 topic · 1 note', '2 topics · 4 notes']);
    assert.ok(r.books.every((b) => /^var\(--color-\w+, var\(--interactive-accent\)\)$/.test(b[2])), 'each in one of the theme\'s colours');
    assert.deepEqual(r.topicsOnCover, [['Cells'], ['Rates'], ['Beginning of Life', 'End of Life']]);
    assert.equal(r.sub, '3 subjects · 6 notes');
    assert.match(r.long, /lp-sj-longer/);
    assert.equal(r.open, 'Subjects/RS');
    assert.equal(r.title, 'RS');
    assert.deepEqual(r.topics, [['Beginning of Life', ['Abortion', 'IVF']], ['End of Life', ['Euthanasia']], ['Other notes', ['Plan']]], 'its topics, the newest note first; the notes not in a topic after');
    assert.deepEqual(r.opened, ['Subjects/RS/End of Life/Euthanasia.md']);
    assert.deepEqual(r.back, [null, 3]);
    assert.deepEqual(r.noRoot[0], ['Maths']);
    assert.match(r.noRoot[1], /no Subjects folder/);
  } finally {
    await context.close();
  }
});
