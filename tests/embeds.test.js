'use strict';
// `![[Note#^callout]]` shows the callout exactly as if it were typed in; coloured links work.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { render, openReading, compare, describeMismatch, closeBrowsers } = require('./lib/harness');
const { note } = require('./lib/notes');

after(closeBrowsers);

const MODES = [['plugin pagination', false], ['CSS pagination', true]];
const layout = (r) => r.reading.words.map((w) => `${w.w}@${w.page}:${Math.round(w.x)},${Math.round(w.y)}`);

// the embedded version and the typed version of a note put every word in the same place
async function sameAsTyped(t, name, params, options) {
  const embedded = await render(note(name, params), options);
  if (embedded.cssPaged === null) return t.skip('this pagination mode is not available in this browser');
  const typed = await render(note(name, { ...params, typed: true }), options);
  assert.deepEqual(embedded.errors, []);
  assert.deepEqual(layout(embedded), layout(typed));
  return embedded;
}

for (const [mode, cssPaging] of MODES) {
  test(`embedded question, group, [!wide], callout and summary = typed (${mode})`, async (t) => {
    const r = await sameAsTyped(t, 'embeds', {}, { cssPaging });
    if (!r) return;
    const c = compare(r.reading, r.pdf);
    assert.ok(c.ok, 'reading view = PDF: ' + describeMismatch(c));
  });

  for (const variant of ['', 'empty-p', 'wrapper', 'bare']) {
    for (const plugin of [true, false]) {
      test(`embedded callout in the notes = typed (embed shape "${variant || 'standard'}", ${plugin ? 'plugin' : 'no plugin'}, ${mode})`, (t) =>
        sameAsTyped(t, 'embedsInNotes', { variant }, { cssPaging, plugin }));
    }
    test(`embedded callout in [!wide] = typed (embed shape "${variant || 'standard'}", ${mode})`, (t) =>
      sameAsTyped(t, 'embedsInWide', { variant }, { cssPaging }));
  }
}

test('an embedded callout updates when its note changes', async () => {
  const { page, context } = await openReading(note('embeds'));
  try {
    const copies = () => page.evaluate(() => [...document.querySelectorAll('.lp-embed-copy')].map((c) => c.textContent.replace(/\s+/g, ' ').trim()));
    const before = await copies();
    assert.equal(before.length, 5);
    // Obsidian re-renders the embed with the new text
    await page.evaluate(() => {
      const p = [...document.querySelectorAll('.lp-embed-unwrapped .callout-content p')].find((x) => /EMBWIDE/.test(x.textContent));
      p.textContent = 'CHANGED wide text';
    });
    await page.waitForTimeout(800);
    const after = await copies();
    assert.equal(after.length, 5, 'every embed is still shown as a callout (the summary too)');
    assert.ok(after.some((t) => t.includes('CHANGED wide text')), 'the copy shows the new text');
    assert.equal(await page.evaluate(() => document.querySelectorAll('.lp-embed-unwrapped').length), 5);
  } finally {
    await context.close();
  }
});

// <font color="…">[[note#^id|alias]]</font>: Obsidian may leave the link out, or as plain text;
// the plugin rebuilds it from the note's source as a working, coloured link
test('a link inside <font color> is a working, coloured link in reading view and the PDF', async () => {
  const src = '>> [!cue]\n>> What is <font color="#4bacc6">[[pathogen#^pathogen|pathogen]]</font>?\n>\n>> [!notes]\n>> notes';
  const cue = (inner) => `<div class="el-blockquote"><blockquote><div class="callout" data-callout="cue"><div class="callout-content"><p>What is <font color="#4bacc6">${inner}</font>?</p></div></div></blockquote></div>`;
  const shapes = { dropped: '', 'plain text': '[[pathogen#^pathogen|pathogen]]', rendered: '<a class="internal-link" data-href="pathogen#^pathogen" href="pathogen#^pathogen">pathogen</a>' };
  const { page, context } = await openReading({ name: 'colours', cornell: true, blocks: Object.values(shapes).map(cue) });
  try {
    const result = await page.evaluate((source) => {
      // run the plugin's post-processor as Obsidian does, with the note's source
      const opened = [];
      window.plugin.app.workspace.openLinkText = (href) => opened.push(href);
      const ctx = { sourcePath: 'Note.md', getSectionInfo: () => ({ text: source, lineStart: 0, lineEnd: 4 }) };
      const pp = window.__processors;
      document.querySelectorAll('.el-blockquote').forEach((el) => pp.forEach((f) => f(el, ctx)));
      const out = [...document.querySelectorAll('.el-blockquote')].map((el) => {
        const a = el.querySelector('font a');
        return { text: el.querySelector('p').textContent, href: a && a.getAttribute('data-href'), colour: a && getComputedStyle(a).color, underline: a && getComputedStyle(a).textDecorationLine };
      });
      document.querySelector('font a').click();
      return { out, opened };
    }, src);
    for (const r of result.out) {
      assert.deepEqual(r, { text: 'What is pathogen?', href: 'pathogen#^pathogen', colour: 'rgb(75, 172, 198)', underline: 'none' });
    }
    assert.deepEqual(result.opened, ['pathogen#^pathogen']);
  } finally {
    await context.close();
  }
});
