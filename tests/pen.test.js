'use strict';
// Pen and paper (Settings → Pen and paper): the pen, paper, bullets, checkboxes, crossed-out text,
// the highlighter and the pen marks (circle, box, underline ...). They change how the writing looks,
// never where it is: every word stays on its line, and reading view is still the PDF.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { render, openReading, compare, describeMismatch, closeBrowsers } = require('./lib/harness');
const { title, group, block } = require('./lib/notes');

after(closeBrowsers);

const ALL = 'lp-ink-pencil lp-ink-soft lp-wobble lp-paper-legal lp-head-wavy lp-head-ink lp-bullet-arrow lp-strike-scribble lp-hl-pink';
const note = (cornell) => ({
  name: 'pen' + (cornell ? '-cornell' : ''), cornell,
  blocks: [
    title('Pens'),
    block('<h2>Asubheading here</h2>'),
    ...(cornell
      ? [group('<p>Acue <span class="pen-circle">Acircled</span></p>', '<ul><li>Abullet one <span class="pen-box">Aboxed</span> word</li><li>Abullet two <span class="pen-underline">Aunder</span> <span class="pen-wavy">Awavy</span></li></ul><p>Text <del>Agone</del> and <mark>Amarked</mark> <span class="pen-scribble">Ascribbled</span> end.</p>')]
      : [block('<ul><li>Abullet one <span class="pen-circle">Acircled</span> <span class="pen-box">Aboxed</span></li><li>Abullet two <span class="pen-underline">Aunder</span> <span class="pen-wavy">Awavy</span></li></ul>'),
        block('<p>Text <del>Agone</del> and <mark>Amarked</mark> <span class="pen-scribble">Ascribbled</span> end.</p>')]),
    block('<ul class="contains-task-list"><li class="task-list-item"><input type="checkbox" class="task-list-item-checkbox"> Atodo open</li><li class="task-list-item is-checked" data-task="x"><input type="checkbox" class="task-list-item-checkbox" checked> Atodo done</li></ul>'),
    block('<p>Alast line of writing.</p>'),
  ],
});

for (const [mode, cssPaging] of [['plugin pagination', false], ['CSS pagination', true]]) {
  for (const cornell of [false, true]) {
    test(`every pen and paper option on: words on the same lines, reading view = PDF (${cornell ? 'Cornell' : 'lined'}, ${mode})`, async (t) => {
      const plain = await render(note(cornell), { cssPaging });
      if (plain.cssPaged === null) return t.skip(`${mode} is not available in this browser`);
      const pen = await render(note(cornell), { cssPaging, theme: 'theme-light ' + ALL });
      assert.deepEqual(pen.errors, []);
      // (the drawn bullets and ticks are text in the PDF, decoration in reading view: not compared)
      const c = compare(pen.reading, { ...pen.pdf, words: pen.pdf.words.filter((w) => !/^[→✓]$/.test(w.w)) });
      assert.ok(c.ok, 'reading view = PDF: ' + describeMismatch(c));
      // each word on the same line (the same row) as without the options
      const row = (r, w) => { const x = r.reading.words.find((v) => v.w === w); return x && Math.round((x.y + x.h) / r.reading.geometry.line); };
      for (const w of plain.reading.words.map((v) => v.w).filter((w) => /^A/.test(w))) {
        assert.equal(row(pen, w), row(plain, w), `"${w}" on the same line`);
      }
    });
  }
}

test('pen and paper options: the pen, the paper, bullets, checkboxes, marks', async () => {
  const { page, context } = await openReading(note(false), { theme: 'theme-light ' + ALL + ' lp-bullet-dash' });
  try {
    const r = await page.evaluate(() => {
      const view = document.querySelector('.markdown-preview-view');
      const cs = (sel, pseudo) => getComputedStyle(document.querySelector(sel), pseudo || null);
      return {
        ink: getComputedStyle(view).getPropertyValue('--ink').trim(),
        paper: getComputedStyle(view).getPropertyValue('--paper').trim(),
        bullet: cs('ul:not(.contains-task-list) > li').listStyleType,
        task: cs('li.task-list-item').listStyleType,
        heading: cs('h2').textDecorationStyle,
        strike: cs('del').textDecorationStyle,
        circle: cs('.pen-circle', '::before').borderTopStyle,
        box: cs('.pen-box', '::before').borderTopStyle,
        checkbox: cs('input[type="checkbox"]').appearance,
        tick: cs('input[type="checkbox"]:checked', '::after').content,
        untick: cs('input[type="checkbox"]:not(:checked)', '::after').display,
      };
    });
    assert.deepEqual(r, {
      ink: '#4b4f56', paper: '#fdf6c0', bullet: '"→  "', task: 'none', heading: 'wavy', strike: 'wavy',
      circle: 'solid', box: 'solid', checkbox: 'none', tick: '"✓"', untick: 'none',
    });
  } finally {
    await context.close();
  }
});

test('a colour set under Colours wins over the pen and the paper; dark paper stays dark', async () => {
  const { page, context } = await openReading(note(false), { theme: 'theme-dark lp-ink-pencil lp-paper-legal' });
  try {
    const r = await page.evaluate(() => {
      const view = document.querySelector('.markdown-preview-view');
      const v = (n) => getComputedStyle(view).getPropertyValue(n).trim();
      const dark = { ink: v('--ink'), paper: v('--paper') };
      document.body.style.setProperty('--lp-ink', '#123456');
      return { dark, set: v('--ink') };
    });
    assert.deepEqual(r, { dark: { ink: '#b9bdc5', paper: '#1c2130' }, set: '#123456' });
  } finally {
    await context.close();
  }
});

test('highlighters of several colours in one note; the stroke covers the spaces between its words, not the space next to it', async () => {
  const { title, block } = require('./lib/notes');
  const n = { name: 'hl', cornell: false, blocks: [title('H'), block('<p>before <mark>Ayellow words</mark> after <mark class="hl-pink">Apink one</mark> and <mark class="hl-green">Agreen</mark> end</p>')] };
  const { page, context } = await openReading(n, { theme: 'theme-light', fonts: true });
  try {
    const r = await page.evaluate(() => {
      const marks = [...document.querySelectorAll('mark')];
      const word = (m, side) => { const n = side === 'prev' ? m.previousSibling : m.nextSibling; const rg = document.createRange(); const t = n.data; const i = side === 'prev' ? t.trimEnd().length - 1 : t.length - t.trimStart().length; rg.setStart(n, i); rg.setEnd(n, i + 1); return rg.getBoundingClientRect(); };
      const space = (m) => { const n = m.nextSibling; const rg = document.createRange(); rg.setStart(n, 0); rg.setEnd(n, 1); return rg.getBoundingClientRect().width; };
      return marks.map((m) => {
        const b = m.getBoundingClientRect();
        const before = word(m, 'prev'), after = word(m, 'next');
        return {
          colour: getComputedStyle(m).getPropertyValue('--pen-highlight').trim(),
          // the stroke's ends: how much of the space beside it is left clear (share of a space)
          clearBefore: +((b.left - before.right) / space(m)).toFixed(2),
          clearAfter: +((after.left - b.right) / space(m)).toFixed(2),
        };
      });
    });
    assert.deepEqual(r.map((x) => x.colour), ['rgba(255, 221, 0, 0.5)', 'rgba(255, 120, 190, 0.38)', 'rgba(120, 220, 90, 0.45)']);
    for (const x of r) {
      assert.ok(x.clearBefore > 0.5 && x.clearAfter > 0.5, 'the space next to a highlight stays mostly clear: ' + JSON.stringify(x));
    }
  } finally {
    await context.close();
  }
});
