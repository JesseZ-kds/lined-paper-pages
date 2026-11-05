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
        circle: cs('.pen-circle').outlineStyle,
        box: cs('.pen-box').outlineStyle,
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
          colour: getComputedStyle(m).getPropertyValue('--pen-highlight').trim().replace(/rgb\(var\(--pen-highlight-rgb\) \/ var\(--pen-highlight-a\)\)/, () => 'rgb(' + getComputedStyle(m).getPropertyValue('--pen-highlight-rgb').trim() + ' / ' + getComputedStyle(m).getPropertyValue('--pen-highlight-a').trim() + ')'),
          // the stroke's ends: how much of the space beside it is left clear (share of a space)
          clearBefore: +((b.left - before.right) / space(m)).toFixed(2),
          clearAfter: +((after.left - b.right) / space(m)).toFixed(2),
        };
      });
    });
    assert.deepEqual(r.map((x) => x.colour), ['rgb(255 232 26 / 0.55)', 'rgb(255 120 190 / 0.38)', 'rgb(120 220 90 / 0.45)']);
    for (const x of r) {
      // (it runs a little past the words, as a highlighter does: part of the space stays clear)
      assert.ok(x.clearBefore > 0.3 && x.clearAfter > 0.3, 'part of the space next to a highlight stays clear: ' + JSON.stringify(x));
    }
  } finally {
    await context.close();
  }
});

test('the highlighter is never blended with what is behind it, and light paper looks the same in Obsidian\'s dark theme', async () => {
  const { title, block } = require('./lib/notes');
  const n = { name: 'hl2', cornell: false, blocks: [title('H'), block('<p>at <mark>conception</mark> and <mark class="hl-pink">pink</mark></p>')] };
  const look = async (theme, paper) => {
    const { page, context } = await openReading(n, { theme });
    try {
      if (paper) await page.evaluate((p) => window.plugin.setSetting('paper-theme', p), paper);
      return await page.evaluate(() => [...document.querySelectorAll('mark')].map((m) => { const cs = getComputedStyle(m); return [cs.mixBlendMode, cs.backgroundImage, cs.color]; }));
    } finally {
      await context.close();
    }
  };
  const light = await look('theme-light');
  const lightInDark = await look('theme-dark', 'light');
  const dark = await look('theme-dark');
  assert.ok([...light, ...lightInDark, ...dark].every((x) => x[0] === 'normal'), 'no blend');
  assert.deepEqual(lightInDark, light, 'light paper: the same highlighter in either theme');
  assert.deepEqual(dark.map((x) => x[2]), ['rgb(31, 35, 40)', 'rgb(31, 35, 40)'], 'dark paper: dark text on the bright stroke');
});

for (const [mode, cssPaging] of [['plugin pagination', false], ['CSS pagination', true]]) {
  test(`a box and a circle are drawn round the words, which don't move, in reading view and the PDF (${mode})`, async (t) => {
    const { title, block, group } = require('./lib/notes');
    const words = (marked) => [title('B'), block(`<p>Bfirst ${marked ? '<span class="pen-box">Bboxed words</span>' : 'Bboxed words'} Bafter and ${marked ? '<span class="pen-circle">Bcircled</span>' : 'Bcircled'} Bend</p>`),
      group('<p>Bcue</p>', `<p>Bnote ${marked ? '<span class="pen-box">Bkey</span>' : 'Bkey'} Bterm</p>`)];
    const plain = await render({ name: 'box0', cornell: true, blocks: words(false) }, { cssPaging });
    if (plain.cssPaged === null) return t.skip(`${mode} is not available in this browser`);
    const marked = await render({ name: 'box1', cornell: true, blocks: words(true) }, { cssPaging });
    assert.deepEqual(marked.errors, []);
    const at = (r) => r.reading.words.filter((w) => /^B/.test(w.w)).map((w) => `${w.w}@${Math.round(w.x)},${Math.round(w.y)}`);
    assert.deepEqual(at(marked), at(plain), 'every word where it was');
    const c = compare(marked.reading, marked.pdf);
    assert.ok(c.ok, 'reading view = PDF: ' + describeMismatch(c));
  });
}

test('the box and the circle show in reading view (a line round the words, in the marking pen)', async () => {
  const { title, block } = require('./lib/notes');
  const { page, context } = await openReading({ name: 'box', cornell: false, blocks: [title('B'), block('<p>a <span class="pen-box">boxed</span> and <span class="pen-circle">circled</span></p>')] });
  try {
    const r = await page.evaluate(() => [...document.querySelectorAll('.pen-box, .pen-circle')].map((e) => { const cs = getComputedStyle(e); return [cs.outlineStyle, cs.outlineWidth, cs.outlineColor]; }));
    // (the browser draws the 1.6px line as whole screen pixels: 1px here)
    assert.deepEqual(r.map(([style, , colour]) => [style, colour]), [['solid', 'rgb(192, 57, 43)'], ['solid', 'rgb(192, 57, 43)']]);
    assert.ok(r.every(([, w]) => parseFloat(w) >= 1), 'a visible line: ' + JSON.stringify(r));
  } finally {
    await context.close();
  }
});

test('a highlighted [[link]] is written in the colour of the writing, not the link colour', async () => {
  const { title, block } = require('./lib/notes');
  for (const theme of ['theme-light', 'theme-dark']) {
    const n = { name: 'hl-link', cornell: false, blocks: [title('L'), block('<p>see <a class="internal-link" href="x">plain link</a> and <mark><a class="internal-link" href="x">marked link</a></mark> and <mark class="hl-pink">a <a class="internal-link" href="y">pink link</a></mark></p>')] };
    const { page, context } = await openReading(n, { theme });
    try {
      // (Obsidian's link colour)
      await page.addStyleTag({ content: '.markdown-rendered a.internal-link { color: rgb(1, 2, 200); }' });
      const r = await page.evaluate(() => {
        const col = (el) => getComputedStyle(el).color;
        const links = [...document.querySelectorAll('a')];
        return { plain: col(links[0]), marked: col(links[1]), pink: col(links[2]), markText: col(document.querySelector('mark')) };
      });
      assert.equal(r.plain, 'rgb(1, 2, 200)', `${theme}: a link not highlighted keeps its colour`);
      assert.equal(r.marked, r.markText, `${theme}: the writing's colour`);
      assert.equal(r.pink, r.markText, `${theme}: in every highlighter`);
    } finally {
      await context.close();
    }
  }
});

test('a highlight inside another shows only its own colour, not a smudged mix of the two', async () => {
  const { title, block } = require('./lib/notes');
  const n = { name: 'nest', cornell: false, blocks: [title('N'), block('<p>x <mark><mark class="hl-blue">nested blue</mark></mark> y <mark class="hl-blue">single blue</mark> z <mark><mark class="hl-orange">nested orange</mark></mark> w <mark class="hl-orange">single orange</mark></p>')] };
  const { page, context } = await openReading(n, { theme: 'theme-light' });
  try {
    // the colour of the stroke just under each highlight's first letter (paper showing through it)
    // (in the space between its two words: only the stroke there, no letter)
    const boxes = await page.evaluate(() => [...document.querySelectorAll('mark[class]')].map((m) => {
      const t = m.firstChild, i = t.data.indexOf(' '), rg = document.createRange();
      rg.setStart(t, i); rg.setEnd(t, i + 1);
      const b = rg.getBoundingClientRect();
      return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height * 0.6) };
    }));
    const png = await page.screenshot({ fullPage: false });
    const px = await page.evaluate(async ({ data, boxes }) => {
      const img = await createImageBitmap(await (await fetch('data:image/png;base64,' + data)).blob());
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      return boxes.map(({ x, y }) => Array.from(g.getImageData(x, y, 1, 1).data.slice(0, 3)));
    }, { data: png.toString('base64'), boxes });
    const close = (p, q) => p.every((v, i) => Math.abs(v - q[i]) <= 6);
    assert.ok(close(px[0], px[1]), 'nested blue = blue: ' + JSON.stringify(px));
    assert.ok(close(px[2], px[3]), 'nested orange = orange: ' + JSON.stringify(px));
  } finally {
    await context.close();
  }
});

// The PDF: every highlight a solid colour (a see-through gradient is saved with a transparency mask,
// which some PDF viewers draw darker: a grey, smudged highlight)
for (const theme of ['theme-light', 'theme-dark']) {
  test(`the PDF has no see-through highlights: solid colours, no transparency masks (${theme})`, async () => {
    const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
    const { title, block } = require('./lib/notes');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lpp-hl-'));
    try {
      const n = { name: 'hlpdf', cornell: false, blocks: [title('H'), block('<p>a <mark>yellow</mark> b <mark class="hl-green">green</mark> c <mark class="hl-pink">pink</mark> d <mark class="hl-blue">blue</mark> e <mark class="hl-orange">orange</mark> f <mark><mark class="hl-blue">nested</mark></mark></p>')] };
      const r = await render(n, { theme, screenshots: dir });
      assert.deepEqual(r.errors, []);
      const pdf = fs.readFileSync(path.join(dir, 'hlpdf.pdf'), 'latin1');
      assert.equal((pdf.match(/\/SMask/g) || []).length, 0, 'no transparency masks');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
}
