'use strict';
// Light or dark paper whatever Obsidian's theme (Settings → Light or dark paper, or a note's own
// cssclasses: dark-paper / light-paper), and the date from the note's date property in the title bar.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { openReading, closeBrowsers } = require('./lib/harness');
const { title, group, block } = require('./lib/notes');

after(closeBrowsers);

const note = { name: 'theme', cornell: true, blocks: [title('Immunity'), group('<p>cue</p>', '<p>notes <font color="#1e4fbf">blue</font></p>'), block('<p>more</p>')] };
const colours = () => {
  const view = document.querySelector('.markdown-preview-view');
  const v = (n) => getComputedStyle(view).getPropertyValue(n).trim();
  return { paper: v('--paper'), ink: v('--ink'), blue: v('--pen-blue'), classes: ['lp-dark', 'lp-light', 'theme-dark', 'theme-light'].filter((c) => view.classList.contains(c)) };
};
const LIGHT = { paper: '#fffffe', ink: '#1f2937', blue: '#1e4fbf' };
const DARK = { paper: '#1c2130', ink: '#d6deee', blue: '#8ab4f8' };

test('the setting: light or dark paper, whatever Obsidian\'s theme', async () => {
  for (const theme of ['theme-light', 'theme-dark']) {
    const { page, context } = await openReading(note, { theme });
    try {
      const r = await page.evaluate(async (c) => {
        const colours = new Function('return (' + c + ')()');
        const out = { auto: colours() };
        for (const v of ['dark', 'light']) { await window.plugin.setSetting('paper-theme', v); out[v] = colours(); }
        await window.plugin.setSetting('paper-theme', undefined);
        out.back = colours();
        return out;
      }, colours.toString());
      const dark = theme === 'theme-dark';
      assert.deepEqual(r.auto, { ...(dark ? DARK : LIGHT), classes: [dark ? 'lp-dark' : 'lp-light'] }, 'follows Obsidian');
      assert.deepEqual(r.dark, { ...DARK, classes: dark ? ['lp-dark'] : ['lp-dark', 'theme-dark'] }, 'always dark');
      assert.deepEqual(r.light, { ...LIGHT, classes: dark ? ['lp-light', 'theme-light'] : ['lp-light'] }, 'always light');
      assert.deepEqual(r.back, r.auto, 'and back');
    } finally {
      await context.close();
    }
  }
});

test('a note\'s own light or dark paper wins (with the plugin, and with the snippets alone)', async () => {
  for (const plugin of [true, false]) {
    const { page, context } = await openReading(note, { theme: 'theme-light', plugin });
    try {
      const r = await page.evaluate(async ({ c, plugin }) => {
        const colours = new Function('return (' + c + ')()');
        const view = document.querySelector('.markdown-preview-view');
        view.classList.add('dark-paper');
        if (plugin) { await window.plugin.setSetting('paper-theme', 'light'); }
        const dark = colours();
        view.classList.remove('dark-paper');
        if (plugin) window.plugin.applyPaperThemes();
        return { dark, light: colours() };
      }, { c: colours.toString(), plugin });
      assert.equal(r.dark.paper, DARK.paper);
      assert.equal(r.dark.blue, DARK.blue);
      assert.equal(r.light.paper, LIGHT.paper);
    } finally {
      await context.close();
    }
  }
});

test('the date property is shown in the title bar\'s corner, not written in the title', async () => {
  const { page, context } = await openReading(note, { theme: 'theme-light' });
  try {
    const r = await page.evaluate(async () => {
      const h = document.querySelector('h1');
      const before = h.getBoundingClientRect();
      window.plugin.noteDate = () => '26 Oct 2026';
      window.plugin.layout(document.querySelector('.markdown-preview-view'), window.plugin.states.get(document.querySelector('.markdown-preview-view')));
      const d = h.querySelector('.paper-date');
      const after = h.getBoundingClientRect(), db = d.getBoundingClientRect();
      const once = h.querySelectorAll('.paper-date').length;
      window.plugin.noteDate = () => '';
      window.plugin.layout(document.querySelector('.markdown-preview-view'), window.plugin.states.get(document.querySelector('.markdown-preview-view')));
      return { text: d.textContent, once, sameTitle: before.top === after.top && before.height === after.height, corner: db.right > after.right - 80 && db.top < after.top + 40, gone: h.querySelectorAll('.paper-date').length };
    });
    assert.deepEqual(r, { text: '26 Oct 2026', once: 1, sameTitle: true, corner: true, gone: 0 });
  } finally {
    await context.close();
  }
});

test('the date can be changed: click it, pick a date, it goes into the date property', async () => {
  const { page, context } = await openReading(note, { theme: 'theme-light' });
  try {
    const r = await page.evaluate(async () => {
      const pl = window.plugin;
      const fm = { cssclasses: ['lined-paper'], Date: '2026-10-26' };
      const file = { path: 'n.md' };
      pl.noteDateInfo = () => ({ file, key: 'Date', value: fm.Date });
      pl.app.fileManager = { processFrontMatter: (f, fn) => { fn(fm); return Promise.resolve(); } };
      document.addEventListener('click', (e) => pl.onDateClick(e), true);   // (registerDomEvent in Obsidian)
      const view = document.querySelector('.markdown-preview-view');
      pl.layout(view, pl.states.get(view));
      const d = view.querySelector('.lp-prop-date');
      const shown = d.textContent;
      d.click();
      const input = document.querySelector('.lp-date-picker');
      const out = { shown, type: input.type, value: input.value };
      input.value = '2026-11-05';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      out.saved = fm.Date;
      out.closed = !document.querySelector('.lp-date-picker');
      // Esc: no change
      view.querySelector('.lp-prop-date').click();
      const again = document.querySelector('.lp-date-picker');
      again.value = '2020-01-01';
      again.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      out.kept = fm.Date;
      // a note without a date yet: the date goes into a new `date` property
      const fm2 = {};
      pl.noteDateInfo = () => ({ file, key: null, value: '' });
      pl.app.fileManager = { processFrontMatter: (f, fn) => { fn(fm2); return Promise.resolve(); } };
      const p = pl.editDate(view, view.querySelector('h1'));
      p.value = '2026-12-24';
      p.blur();
      await new Promise((res) => setTimeout(res, 20));
      out.added = fm2;
      return out;
    });
    assert.deepEqual(r, { shown: '26 Oct 2026', type: 'date', value: '2026-10-26', saved: '2026-11-05', closed: true, kept: '2026-11-05', added: { date: '2026-12-24' } });
  } finally {
    await context.close();
  }
});

// every page that starts with a # title has a date in its title bar: its own (page-dates), or the note's
for (const [mode, cssPaging] of [['plugin pagination', false], ['CSS pagination', true]]) {
  test(`every page's title bar has a date, its own or the note's; click it to change that page's (${mode})`, async (t) => {
    const pages = { name: 'pages', cornell: true, blocks: [title('Part one'), group('<p>cue</p>', '<p>notes</p>'), title('Part two'), group('<p>cue</p>', '<p>notes</p>'), title('Part three'), group('<p>cue</p>', '<p>notes</p>')] };
    const { page, context } = await openReading(pages, { cssPaging });
    if (!page) return t.skip(`${mode} is not available in this browser`);
    try {
      const r = await page.evaluate(async () => {
        const pl = window.plugin;
        const fm = { date: '2026-10-26', 'page-dates': ['2026-10-28'] };
        pl.noteDateInfo = () => ({ file: {}, key: 'date', value: fm.date, fm });
        pl.app.fileManager = { processFrontMatter: (f, fn) => { fn(fm); return Promise.resolve(); } };
        document.addEventListener('click', (e) => pl.onDateClick(e), true);
        const view = document.querySelector('.markdown-preview-view');
        pl.layout(view, pl.states.get(view));
        const P = (() => { const d = document.createElement('div'); d.style.cssText = 'position:absolute;height:var(--page-h)'; view.appendChild(d); const h = d.getBoundingClientRect().height; d.remove(); return h; })();
        const top = view.querySelector('.markdown-preview-sizer').getBoundingClientRect().top;
        const dates = [...view.querySelectorAll('h1')].map((h) => {
          const d = h.querySelector('.paper-date');
          const y = d.getBoundingClientRect().top - top;
          return [d.textContent, Math.floor(y / P), Math.round(y - Math.floor(y / P) * P) < 60];
        });
        // page 3 has no date of its own: click it and pick one
        view.querySelectorAll('h1')[2].querySelector('.lp-prop-date').click();
        const input = document.querySelector('.lp-date-picker');
        const startsFrom = input.value;
        input.value = '2026-11-02';
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        return { dates, startsFrom, list: fm['page-dates'], noteDate: fm.date };
      });
      assert.deepEqual(r.dates, [['26 Oct 2026', 0, true], ['28 Oct 2026', 1, true], ['26 Oct 2026', 2, true]], 'each page\'s date at the top of its page');
      assert.equal(r.startsFrom, '2026-10-26', 'the picker starts from the date shown');
      assert.deepEqual(r.list, ['2026-10-28', '2026-11-02'], 'that page\'s own date');
      assert.equal(r.noteDate, '2026-10-26', 'the note\'s date unchanged');
    } finally {
      await context.close();
    }
  });
}
