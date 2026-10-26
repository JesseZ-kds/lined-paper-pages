'use strict';
// Reading view looks exactly like the PDF export: every word on the same page, in the same place.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { render, compare, describeMismatch, closeBrowsers } = require('./lib/harness');
const { note } = require('./lib/notes');

after(closeBrowsers);

const MODES = [['plugin pagination', false], ['CSS pagination', true]];
const CASES = [
  ['cornell'], ['short'], ['separate'], ['hello'], ['helloLong'], ['summaryInGroup'], ['whatIsUp'],
  ['plain'], ['plainLong', { fill: 0 }], ['plainLong', { fill: 12 }], ['plainLong', { fill: 27 }],
  ['cornellLong', { fill: 0 }], ['cornellLong', { fill: 15 }], ['cornellLong', { fill: 29 }],
  ['callouts'], ['nextPage'], ['nextPageCornell'], ['wide'], ['wide', { fill: 11 }], ['wideAtTop'],
  ['divider'], ['dividerPlain'], ['pictures'],
];
const label = (name, params) => name + (params ? ' ' + JSON.stringify(params) : '');

for (const [mode, cssPaging] of MODES) {
  for (const [name, params] of CASES) {
    test(`reading view = PDF: ${label(name, params)} (${mode})`, async (t) => {
      const r = await render(note(name, params), { cssPaging });
      if (r.cssPaged === null) return t.skip(`${mode} is not available in this browser`);
      assert.deepEqual(r.errors, []);
      const c = compare(r.reading, r.pdf);
      assert.ok(c.ok, describeMismatch(c));
    });
  }
}

test('reading view = PDF in the dark theme', async () => {
  const r = await render(note('hello'), { theme: 'theme-dark' });
  if (r.cssPaged === null) return;
  const c = compare(r.reading, r.pdf);
  assert.ok(c.ok, describeMismatch(c));
});

// At 125 % / 150 % display scaling every row is a whole number of screen pixels (so the ruled
// lines don't wobble); rows are then a fraction of a pixel taller than in the PDF, so words are
// compared by page and ruled row instead of by pixel.
for (const dpr of [1.25, 1.5]) {
  test(`display scaling ${dpr * 100} %: whole-pixel rows, same page and row as the PDF`, async () => {
    const r = await render(note('hello'), { dpr });
    if (r.cssPaged === null) return;
    const L = r.reading.geometry.line;
    // (Chromium keeps layout positions in 1/64 px, so a row of exactly 39 screen pixels may be stored a hair less)
    assert.ok(Math.abs(L * dpr - Math.round(L * dpr)) < 0.05, `row = ${L}px = ${L * dpr} screen pixels`);
    const PRINT_ROW = (290 / 25.4 * 96) / (3 + 32 + 3 * 0.11);   // the PDF's row: 290mm / 35.33 rows
    // (each word by the ruled row its middle is in, and its x within 4 px)
    const pool = r.pdf.words.map((p) => ({ w: p.w, page: p.page, row: Math.floor((p.y + p.bottom) / 2 / PRINT_ROW), x: p.x }));
    const off = r.reading.words.filter((w) => !w.title && !/^(Cues|Notes)$/.test(w.w)).filter((w) => {
      const row = Math.floor((w.y + w.h / 2) / L);
      const i = pool.findIndex((p) => p.w === w.w && p.page === w.page && p.row === row && Math.abs(p.x - w.x) < 4);
      if (i < 0) return true;
      pool.splice(i, 1);
      return false;
    });
    assert.deepEqual(off.map((w) => w.w), []);
  });
}
