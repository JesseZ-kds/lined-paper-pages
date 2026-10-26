'use strict';
// Reading view looks exactly like the PDF export: every word on the same page, in the same place.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { render, openReading, compare, describeMismatch, closeBrowsers } = require('./lib/harness');
const { note } = require('./lib/notes');

after(closeBrowsers);

const MODES = [['plugin pagination', false], ['CSS pagination', true]];
const CASES = [
  ['cornell'], ['short'], ['separate'], ['hello'], ['helloLong'], ['summaryInGroup'], ['whatIsUp'],
  ['plain'], ['plainLong', { fill: 0 }], ['plainLong', { fill: 12 }], ['plainLong', { fill: 27 }],
  ['cornellLong', { fill: 0 }], ['cornellLong', { fill: 15 }], ['cornellLong', { fill: 29 }],
  ['callouts'], ['nextPage'], ['nextPageCornell'], ['wide'], ['wide', { fill: 11 }], ['wideAtTop'],
  ['divider'], ['dividerPlain'], ['pictures'], ['calloutAtBreak', { fill: 28 }], ['longTitles'],
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

// A callout is never split between two pages: when it doesn't fit, it moves to the next page whole
// (here: a quote in the notes, with the notes growing line by line until it lands on the break)
for (const [mode, cssPaging] of MODES) {
  test(`a callout on a page break moves to the next page whole (${mode})`, async (t) => {
    for (let fill = 24; fill <= 31; fill++) {
      const r = await render(note('calloutAtBreak', { fill }), { cssPaging });
      if (r.cssPaged === null) return t.skip(`${mode} is not available in this browser`);
      for (const [where, words] of [['reading view', r.reading.words], ['PDF', r.pdf.words]]) {
        const pages = new Set(words.filter((w) => ['QUOTETITLE', 'QUOTETEXT', 'cell.'].includes(w.w)).map((w) => w.page));
        assert.equal(pages.size, 1, `${where}, ${fill} lines of notes: the callout is split over pages ${[...pages]}`);
      }
      const c = compare(r.reading, r.pdf);
      assert.ok(c.ok, `${fill} lines of notes: ` + describeMismatch(c));
    }
  });
}

// Long titles go on to a new line instead of being cut off with "…"; a note title too long for the
// title bar goes on two lines inside it
for (const [mode, cssPaging] of MODES) {
  test(`long titles wrap instead of being cut off (${mode})`, async (t) => {
    const { page, context } = await openReading(note('longTitles'), { cssPaging });
    if (!page) return t.skip(`${mode} is not available in this browser`);
    try {
      const r = await page.evaluate(() => {
        const h = document.querySelector('h1');
        const inner = document.querySelector('.callout[data-callout="quote"] .callout-title-inner');
        const cut = (el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
        const box = inner.closest('.callout').getBoundingClientRect();
        const text = inner.closest('.callout').querySelector('.callout-content p').getBoundingClientRect();
        return { twoLines: h.classList.contains('lp-title-wrap'), titleCut: cut(h), calloutTitleCut: cut(inner),
          calloutTitleWraps: inner.getBoundingClientRect().height > 1.5 * parseFloat(getComputedStyle(inner).lineHeight),
          calloutHoldsAll: inner.getBoundingClientRect().top >= box.top - 1 && text.bottom <= box.bottom + 1 };
      });
      assert.deepEqual(r, { twoLines: true, titleCut: false, calloutTitleCut: false, calloutTitleWraps: true, calloutHoldsAll: true });
    } finally {
      await context.close();
    }
    // in the PDF the whole title is in the title bar of page 1
    const pdf = (await render(note('longTitles'), { cssPaging })).pdf;
    for (const w of ['Moral', 'Embryo:', 'Human', 'Begin?']) {
      assert.ok(pdf.words.some((p) => p.w === w && p.page === 1 && p.bottom < 120), `"${w}" in the PDF's title bar`);
    }
  });
}

test('a short title stays on one line, at full size', async () => {
  const { page, context } = await openReading(note('short'));
  try {
    assert.equal(await page.evaluate(() => document.querySelector('h1').classList.contains('lp-title-wrap')), false);
  } finally {
    await context.close();
  }
});

// Inside the notes, the next line comes right under a callout: no blank line after it
for (const [mode, cssPaging] of MODES) {
  test(`no blank line after a callout in the notes (${mode})`, async (t) => {
    const { page, context } = await openReading(note('calloutAtBreak', { fill: 10 }), { cssPaging });
    if (!page) return t.skip(`${mode} is not available in this browser`);
    try {
      const gap = await page.evaluate(() => {
        const box = document.querySelector('.callout[data-callout="quote"]').getBoundingClientRect();
        const next = [...document.querySelectorAll('li')].find((li) => li.textContent.includes('AFTERQUOTE')).getBoundingClientRect();
        const line = parseFloat(getComputedStyle(document.querySelector('.callout-content p')).lineHeight);
        return { gap: Math.round(next.top - box.bottom), line };
      });
      // (the box is drawn a few pixels up, onto the ruled lines: less than half a line is no blank line)
      assert.ok(gap.gap >= 0 && gap.gap < gap.line / 2, `${gap.gap}px between the callout and the next line (a line is ${gap.line}px)`);
    } finally {
      await context.close();
    }
  });
}

// A title that fits stays on one line at full size, in the same place as always
test('a title that fits stays on one line at full size', async () => {
  const { title, para } = require('./lib/notes');
  const { page, context } = await openReading({ name: 'title', cornell: true, blocks: [title('Immunity'), para('x')] });
  try {
    const r = await page.evaluate(() => {
      const h = document.querySelector('h1'), cs = getComputedStyle(h);
      return { wrap: h.classList.contains('lp-title-wrap'), size: cs.fontSize, padRight: cs.paddingRight, white: cs.whiteSpace };
    });
    assert.deepEqual(r, { wrap: false, size: r.size, padRight: '200px', white: 'nowrap' });
  } finally {
    await context.close();
  }
});
