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
