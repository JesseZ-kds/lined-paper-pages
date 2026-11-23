'use strict';
// Subjects: everything in the subjects folder, as the file list (Paper: subjects), a canvas of quick links (a page for each subject, or each topic), a new note in a topic, and the
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

test('Paper: subjects: everything in the subjects folder in the file list\'s own markup (the theme draws it): a section for each subject, folders first', async () => {
  const { page, context } = await open();
  try {
    const r = await page.evaluate(async () => {
      const plugin = window.plugin, { vault, open } = window.made;
      const base = plugin.vaultEntries();
      plugin.vaultEntries = () => base.concat([{ path: 'Subjects/RS/RS.canvas', folder: false }, { path: 'Subjects/RS/Empty topic', folder: true }]);
      plugin.app.workspace.getActiveFile = () => vault.files['Subjects/RS/Plan.md'];
      const host = document.createElement('div');
      document.body.appendChild(host);
      plugin.drawSubjects(host, {});
      const out = {};
      // (as Obsidian's file list: .nav-files-container > div > a spacer, then the folders, for the theme's rainbow folders)
      const list = host.querySelector('.nav-files-container > div');
      out.first = list.firstElementChild.className;
      out.sections = [...list.children].filter((c) => c.matches('.nav-folder')).map((c) => c.querySelector(':scope > .nav-folder-title > .nav-folder-title-content').textContent);
      const rs = list.querySelector(':scope > .nav-folder > .nav-folder-title[data-path="Subjects/RS"]').parentElement;
      out.rs = [...rs.querySelector(':scope > .nav-folder-children').children].slice(1).map((c) => (c.matches('.nav-folder') ? 'folder ' : 'file ') + c.querySelector('.tree-item-inner').textContent + (c.querySelector('.nav-file-tag') ? ' [' + c.querySelector('.nav-file-tag').textContent + ']' : ''));
      out.active = [...host.querySelectorAll('.nav-file-title.is-active')].map((x) => x.dataset.path);
      out.buttons = [...host.querySelectorAll('.nav-header .nav-action-button')].map((b) => b.getAttribute('aria-label'));
      out.notOurs = !host.querySelector('[data-path^="Definitions"], [data-path="Home.md"]');
      // a folder closes and opens; a note opens
      host.querySelector('.nav-folder-title[data-path="Subjects/RS/Beginning of Life"]').click();
      out.closed = [host.querySelector('.nav-folder-title[data-path="Subjects/RS/Beginning of Life"]').parentElement.classList.contains('is-collapsed'), !!host.querySelector('[data-path="Subjects/RS/Beginning of Life/IVF.md"]')];
      host.querySelector('.nav-folder-title[data-path="Subjects/RS/Beginning of Life"]').click();
      host.querySelector('.nav-file-title[data-path="Subjects/RS/Beginning of Life/IVF.md"]').click();
      await new Promise((ok) => setTimeout(ok, 20));
      out.opened = open.slice();
      // collapse all, expand all
      host.querySelector('.nav-action-button[aria-label="Collapse all"]').click();
      out.collapsed = host.querySelectorAll('.nav-folder:not(.is-collapsed)').length;
      host.querySelector('.nav-action-button[aria-label="Expand all"]').click();
      out.expanded = host.querySelectorAll('.nav-folder.is-collapsed').length;
      // no subjects folder
      window.makeVault(plugin, { 'Home.md': '' });
      plugin.vaultEntries = Object.getPrototypeOf(plugin).vaultEntries;
      plugin.drawSubjects(host, {});
      out.none = host.querySelector('.pane-empty').textContent;
      return out;
    });
    assert.equal(r.first, '', 'a spacer first, as in Obsidian\'s file list');
    assert.deepEqual(r.sections, ['Chemistry Higher Tier', 'English', 'History', 'RS'], 'a section for each subject');
    assert.deepEqual(r.rs, ['folder Beginning of Life', 'folder Empty topic', 'folder End of Life', 'file Plan', 'file RS [canvas]'], 'everything in it: folders first, then the files, any kind');
    assert.deepEqual(r.active, ['Subjects/RS/Plan.md'], 'the note open, shown');
    assert.deepEqual(r.buttons, ['New subject', 'Canvas: a page for each subject, with quick links', 'Collapse all']);
    assert.ok(r.notOurs, 'only what is in the subjects folder');
    assert.deepEqual(r.closed, [true, false]);
    assert.deepEqual(r.opened, ['Subjects/RS/Beginning of Life/IVF.md']);
    assert.equal(r.collapsed, 0);
    assert.equal(r.expanded, 0);
    assert.match(r.none, /No "Subjects" folder yet/);
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
