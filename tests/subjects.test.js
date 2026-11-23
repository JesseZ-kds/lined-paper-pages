'use strict';
// Subjects: every subject's folder as a notebook (Paper: subjects), only the subjects in the sidebar,
// a canvas of quick links (a page for each subject, or each topic), a new note in a topic, and the
// study vault's subjects (no example note any more).
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { openReading, closeBrowsers } = require('./lib/harness');
const { SRC, FAKES } = require('./lib/fakes');

after(closeBrowsers);

const NOTES = [['Subjects/RS/Beginning of Life/Abortion.md', 0], ['Subjects/RS/Beginning of Life/IVF.md', 1], ['Subjects/RS/End of Life/Euthanasia.md', 5], ['Subjects/RS/Plan.md', 2],
  ['Subjects/English/Macbeth/Act 1.md', 3], ['Subjects/History/Cold War/Berlin.md', 9], ['Subjects/Chemistry Higher Tier/Rates/Rates.md', 12], ['Definitions/Foetus.md', 0], ['Home.md', 0]];

const open = async () => {
  const r = await openReading({ name: 'subjects', cornell: true, blocks: [] }, { theme: 'theme-light', src: SRC, viewport: { width: 1100, height: 800 } });
  await r.page.evaluate(FAKES);
  await r.page.evaluate((notes) => {
    const plugin = window.plugin;
    const day = 86400000, now = Date.now();
    const made = window.makeVault(plugin, Object.fromEntries(notes.map(([p]) => [p, '# x'])));
    for (const [p, d] of notes) made.vault.files[p].stat = { mtime: now - d * day - 1000 };
    plugin.settings._srs = {};
    window.made = made;
  }, NOTES);
  return r;
};

test('the shelf: a notebook for each subject in the theme\'s colours, with its sign; the notes written last; a subject opens to its topics', async () => {
  const { page, context } = await open();
  try {
    const r = await page.evaluate(async () => {
      const plugin = window.plugin, { open } = window.made;
      const host = document.createElement('div');
      document.body.appendChild(host);
      const view = {};
      plugin.drawSubjects(host, view);
      const books = () => [...host.querySelectorAll('.lp-sj-book:not(.lp-sj-addbook)')];
      const out = {};
      out.books = books().map((b) => [b.querySelector('.lp-sj-name').textContent, b.querySelector('.lp-sj-meta').textContent, b.style.getPropertyValue('--lp-sj-c')]);
      out.topicsOnCover = books().map((b) => [...b.querySelectorAll('.lp-sj-topiclist > span')].map((s) => s.textContent));
      out.sub = host.querySelector('.lp-sj-sub').textContent;
      out.recent = [...host.querySelectorAll('.lp-sj-recent-note')].map((n) => [n.querySelector('.lp-sj-recent-top').textContent, n.querySelector('.lp-sj-recent-name').textContent]);
      out.add = !!host.querySelector('.lp-sj-addbook');
      out.canvasBtn = books().every((b) => b.querySelector('.lp-sj-canvasbtn'));
      out.long = host.querySelector('.lp-sj-book[data-path="Subjects/Chemistry Higher Tier"] .lp-sj-name').className;
      host.querySelector('.lp-sj-recent-note').click();
      host.querySelector('.lp-sj-book[data-path="Subjects/RS"]').click();
      out.open = view.open;
      out.title = host.querySelector('.lp-sj-title').textContent;
      out.topics = [...host.querySelectorAll('.lp-sj-topic')].map((t) => [t.querySelector('.lp-sj-topic-name').textContent, [...t.querySelectorAll('.lp-sj-note-name')].map((n) => n.textContent), !!t.querySelector('.lp-sj-newnote')]);
      host.querySelector('.lp-sj-note[data-path="Subjects/RS/End of Life/Euthanasia.md"]').click();
      await new Promise((ok) => setTimeout(ok, 20));
      out.opened = open.slice();
      host.querySelector('.lp-sj-back').click();
      out.back = [view.open, books().length];
      return out;
    });
    assert.deepEqual(r.books.map((b) => b[0]), ['Chemistry Higher Tier', 'English', 'History', 'RS'], 'a notebook for each subject (not Definitions, not a note at the top)');
    assert.deepEqual(r.books.map((b) => b[1]), ['1 topic · 1 note', '1 topic · 1 note', '1 topic · 1 note', '2 topics · 4 notes']);
    assert.deepEqual(r.books.map((b) => b[2]), ['var(--color-cyan, var(--interactive-accent))', 'var(--color-purple, var(--interactive-accent))', 'var(--color-orange, var(--interactive-accent))', 'var(--color-yellow, var(--interactive-accent))'], 'the theme\'s colours: a known subject its own');
    assert.deepEqual(r.topicsOnCover, [['Rates'], ['Macbeth'], ['Cold War'], ['Beginning of Life', 'End of Life']]);
    assert.equal(r.sub, '4 subjects · 7 notes');
    assert.deepEqual(r.recent, [['RS · Beginning of Life', 'Abortion'], ['RS · Beginning of Life', 'IVF'], ['RS', 'Plan'], ['English · Macbeth', 'Act 1']], 'the notes written last, newest first');
    assert.ok(r.add && r.canvasBtn, 'a New subject notebook; a canvas quick link on each');
    assert.match(r.long, /lp-sj-longer/);
    assert.equal(r.open, 'Subjects/RS');
    assert.equal(r.title, 'RS');
    assert.deepEqual(r.topics, [['Beginning of Life', ['Abortion', 'IVF'], true], ['End of Life', ['Euthanasia'], true], ['Other notes', ['Plan'], true]], 'its topics, the newest note first, each with New note');
    assert.deepEqual(r.opened, ['Subjects/RS/Beginning of Life/Abortion.md', 'Subjects/RS/End of Life/Euthanasia.md']);
    assert.deepEqual(r.back, [null, 4]);
  } finally {
    await context.close();
  }
});

test('only the subjects, in the sidebar: each opens to its topics, a topic to its notes', async () => {
  const { page, context } = await open();
  try {
    const r = await page.evaluate(async () => {
      const plugin = window.plugin, { open } = window.made;
      const host = document.createElement('div');
      document.body.appendChild(host);
      const view = {};
      plugin.drawSubjectsSide(host, view);
      const rows = () => [...host.querySelectorAll('.lp-ss-row')].map((x) => x.querySelector('.lp-ss-name').textContent);
      const out = { closed: rows() };
      host.querySelector('.lp-ss-fold[data-path="Subjects/RS"]').click();
      out.subject = rows();
      host.querySelector('.lp-ss-fold[data-path="Subjects/RS/End of Life"]').click();
      out.topic = rows();
      host.querySelector('.lp-ss-note[data-path="Subjects/RS/End of Life/Euthanasia.md"]').click();
      await new Promise((ok) => setTimeout(ok, 20));
      out.opened = open.slice();
      return out;
    });
    assert.deepEqual(r.closed, ['Chemistry Higher Tier', 'English', 'History', 'RS'], 'only the subjects');
    assert.deepEqual(r.subject, ['Chemistry Higher Tier', 'English', 'History', 'RS', 'Beginning of Life', 'End of Life', 'Plan']);
    assert.deepEqual(r.topic, ['Chemistry Higher Tier', 'English', 'History', 'RS', 'Beginning of Life', 'End of Life', 'Euthanasia', 'Plan']);
    assert.deepEqual(r.opened, ['Subjects/RS/End of Life/Euthanasia.md']);
  } finally {
    await context.close();
  }
});

test('canvases of quick links: a page for each subject (its topics, notes and its own canvas), a page for each topic of one; what you add is kept', async () => {
  const { page, context } = await open();
  try {
    const r = await page.evaluate(async () => {
      const plugin = window.plugin, { vault, open } = window.made;
      await plugin.subjectsCanvas(null);
      const all = JSON.parse(vault.files['Subjects/Subjects.canvas'].text);
      const rs = JSON.parse(vault.files['Subjects/RS/RS.canvas'].text);
      // (a card of your own, joined to a page: kept when the canvas is made again)
      all.nodes.push({ id: 'mine', type: 'text', text: 'My plan', x: -400, y: 0, width: 200, height: 60 });
      all.edges = [{ id: 'e1', fromNode: 'mine', toNode: 'lp-page-0', fromSide: 'right', toSide: 'left' }, { id: 'e2', fromNode: 'mine', toNode: 'gone' }];
      vault.files['Subjects/Subjects.canvas'].text = JSON.stringify(all);
      await plugin.subjectsCanvas(null);
      const again = JSON.parse(vault.files['Subjects/Subjects.canvas'].text);
      return {
        files: Object.keys(vault.files).filter((p) => p.endsWith('.canvas')).sort(), open: open.slice(),
        pages: all.nodes.filter((n) => n.type === 'group').map((n) => [n.label, n.color || '', n.width, n.height]),
        rsPage: all.nodes.filter((n) => n.id.startsWith('lp-page-3')).map((n) => n.text || ''),
        rsTopics: rs.nodes.filter((n) => n.type === 'group').map((n) => n.label),
        rsLinks: rs.nodes.filter((n) => n.type === 'text' && /\[\[/.test(n.text)).map((n) => n.text),
        kept: again.nodes.filter((n) => !n.id.startsWith('lp-')).map((n) => n.id), edges: again.edges.map((e) => e.id),
        overlap: (() => { const g = again.nodes.filter((n) => n.type === 'group'); return g.some((a, i) => g.some((b, j) => i !== j && a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height)); })(),
      };
    });
    assert.deepEqual(r.files, ['Subjects/Chemistry Higher Tier/Chemistry Higher Tier.canvas', 'Subjects/English/English.canvas', 'Subjects/History/History.canvas', 'Subjects/RS/RS.canvas', 'Subjects/Subjects.canvas'], 'the subjects\' canvas, and each subject\'s own');
    assert.deepEqual(r.open, ['Subjects/Subjects.canvas', 'Subjects/Subjects.canvas']);
    assert.deepEqual(r.pages.map((p) => p[0]), ['Chemistry Higher Tier', 'English', 'History', 'RS'], 'a page for each subject');
    assert.deepEqual(r.pages.map((p) => p[1]), ['5', '6', '2', '3'], 'in the theme\'s canvas colours');
    assert.ok(r.pages.every((p) => p[2] === 640 && p[3] >= 900), 'each the shape of a page');
    assert.equal(r.overlap, false, 'the pages side by side, none over another');
    assert.deepEqual(r.rsPage, ['', '# RS\n2 topics · 4 notes · [[Subjects/RS/RS.canvas|RS canvas →]]', '## Beginning of Life\n- [[Subjects/RS/Beginning of Life/Abortion|Abortion]]\n- [[Subjects/RS/Beginning of Life/IVF|IVF]]', '## End of Life\n- [[Subjects/RS/End of Life/Euthanasia|Euthanasia]]', '## Other notes\n- [[Subjects/RS/Plan|Plan]]']);
    assert.deepEqual(r.rsTopics, ['Beginning of Life', 'End of Life', 'Other notes'], 'one subject\'s canvas: a page for each topic');
    assert.equal(r.rsLinks.length, 3);
    assert.deepEqual(r.kept, ['mine'], 'your own card kept');
    assert.deepEqual(r.edges, ['e1'], 'its line to a page kept (one to a card no longer there, not)');
  } finally {
    await context.close();
  }
});

test('New note in a topic: the Cornell template, today\'s date, opened; the study vault: the subjects chosen, no example note; an old example note taken away unless changed', async () => {
  const { page, context } = await open();
  try {
    const r = await page.evaluate(async () => {
      const plugin = window.plugin, { vault, open } = window.made;
      const f = await plugin.newNoteIn('Subjects/RS/End of Life');
      const f2 = await plugin.newNoteIn('Subjects/RS/End of Life');
      const out = { note: f.path, note2: f2.path, text: vault.files[f.path].text, open: open.slice() };
      // the study vault
      const v2 = window.makeVault(plugin, {});
      v2.vault.createFolder = async (p) => { v2.vault.files[p + '/.folder'] = { path: p + '/.folder', text: '' }; };
      plugin.showCardPanel = async () => {};
      await plugin.makeStudyVault(false, ['English', 'History', 'Science']);
      out.vault = Object.keys(v2.vault.files).sort();
      // an example note from an earlier version: as it was made (taken away), changed (kept)
      const P = window.plugin.constructor;
      const v3 = window.makeVault(plugin, { 'Subjects/Example/Beginning of Life (example).md': P.EXAMPLE_NOTE });
      out.removed = [await plugin.removeExample(), Object.keys(v3.vault.files)];
      const v4 = window.makeVault(plugin, { 'Subjects/Example/Beginning of Life (example).md': P.EXAMPLE_NOTE + '\nmy own line' });
      out.changed = [await plugin.removeExample(), Object.keys(v4.vault.files)];
      return out;
    });
    const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    assert.equal(r.note, `Subjects/RS/End of Life/${today} New note.md`);
    assert.equal(r.note2, `Subjects/RS/End of Life/${today} New note 2.md`, 'never over one there');
    assert.match(r.text, new RegExp(`^---\\ncssclasses:\\n  - lined-paper\\n  - cornell\\ndate: ${today}\\n---\\n# ${today} New note\\n`));
    assert.deepEqual(r.open, [r.note, r.note2]);
    for (const s of ['English', 'History', 'Science']) assert.ok(r.vault.includes(`Subjects/${s}/.folder`), s);
    assert.ok(!r.vault.some((p) => /Example|example/.test(p)), 'no example note: ' + r.vault.join(', '));
    assert.deepEqual(r.removed, [true, []], 'the example, as it was made: taken away');
    assert.deepEqual(r.changed, [false, ['Subjects/Example/Beginning of Life (example).md']], 'changed: yours, kept');
  } finally {
    await context.close();
  }
});
