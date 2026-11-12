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
  const { page, context } = await openReading(note(false), { theme: 'theme-light ' + ALL.replace('lp-bullet-arrow', 'lp-bullet-dash') });
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
      ink: '#4b4f56', paper: '#fdf6c0', bullet: '"–  "', task: 'none', heading: 'wavy', strike: 'wavy',
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
  assert.deepEqual(dark.map((x) => x[2]), ['rgb(214, 222, 238)', 'rgb(214, 222, 238)'], 'dark paper: the light writing stays light on the see-through stroke');
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

for (const [mode, cssPaging] of [['plugin pagination', false], ['CSS pagination', true]]) {
  test(`arrows (-> <- <-> => <=> --> <-- ~>) are drawn, not in code, reading view = PDF (${mode})`, async (t) => {
    const { title, group, block } = require('./lib/notes');
    const blocks = [title('Arrows'), group('<p>Acause -> Aeffect</p>', '<ul><li>Aa -> Ab => Ac ~> Ad</li><li>Ae <- Af <-> Ag <=> Ah --> Ai <-- Aj</li></ul>'), block('<p>Acode <code>x -> y</code> Aend</p>'), block('<pre><code>a -> b</code></pre>')];
    const r = await render({ name: 'arrows', cornell: true, blocks }, { cssPaging, prepare: '1' });
    if (r.cssPaged === null) return t.skip(`${mode} is not available in this browser`);
    assert.deepEqual(r.errors, []);
    // (the arrows are drawings: no word of the PDF but the code's own -> )
    const c = compare(r.reading, r.pdf);
    assert.ok(c.ok, 'reading view = PDF: ' + describeMismatch(c));
  });
}

test('arrows: each kind drawn, the typed text kept (it copies as typed), code left alone, "As typed" shows the text', async () => {
  const { title, block } = require('./lib/notes');
  const n = { name: 'arrows2', cornell: false, blocks: [title('A'), block('<p>a -> b <- c <-> d => e <=> f --> g <-- h ~> i</p>'), block('<p>x <code>p -> q</code> y</p>')] };
  const { page, context } = await openReading(n, { theme: 'theme-light' });
  try {
    const r = await page.evaluate(() => {
      const p = document.querySelectorAll('p')[0];
      const out = {
        kinds: [...p.querySelectorAll('.lp-arrow')].map((a) => a.dataset.arrow),
        text: p.textContent,
        code: document.querySelector('code').textContent + ':' + document.querySelectorAll('code .lp-arrow').length,
        drawnWidth: Math.round(p.querySelector('.lp-arrow svg').getBoundingClientRect().width),
      };
      document.body.classList.add('lp-arrows-off');
      out.offSvg = getComputedStyle(p.querySelector('.lp-arrow svg')).display;
      out.offText = getComputedStyle(p.querySelector('.lp-arrow-src')).fontSize !== '0px';
      return out;
    });
    assert.deepEqual(r.kinds, ['r', 'l', 'lr', 'dr', 'dlr', 'long', 'longl', 'wave']);
    assert.equal(r.text, 'a -> b <- c <-> d => e <=> f --> g <-- h ~> i', 'the typed text, as typed');
    assert.equal(r.code, 'p -> q:0', 'not in code');
    assert.ok(r.drawnWidth > 10, 'drawn');
    assert.equal(r.offSvg, 'none');
    assert.ok(r.offText, 'as typed: the text shows');
  } finally {
    await context.close();
  }
});

test('an arrow in a pen colour is drawn in that colour, even with an Arrow colour set', async () => {
  const { title, block } = require('./lib/notes');
  const n = { name: 'arrow-colour', cornell: false, blocks: [title('C'), block('<p>a -> b <font color="#c62828">-></font> c <span style="color: #2e7d32">=></span> d</p>')] };
  const { page, context } = await openReading(n, { theme: 'theme-light' });
  try {
    const r = await page.evaluate(() => {
      document.body.style.setProperty('--lp-arrow-ink', '#123456');
      // (each arrow, and the colour of the pen it is written in)
      return [...document.querySelectorAll('.lp-arrow svg')].map((s) => [getComputedStyle(s).stroke, getComputedStyle(s.closest('font, span[style]') || s).color]);
    });
    assert.equal(r[0][0], 'rgb(18, 52, 86)', 'Arrow colour');
    assert.equal(r[1][0], r[1][1], 'the red pen');
    assert.equal(r[2][0], r[2][1], 'the green pen');
    assert.notEqual(r[1][0], r[0][0]);
  } finally {
    await context.close();
  }
});

for (const [mode, cssPaging] of [['plugin pagination', false], ['CSS pagination', true]]) {
  test(`↳ bullets: drawn from the line above, for every point or only sub-points; no word moves, reading view = PDF (${mode})`, async (t) => {
    const { title, group } = require('./lib/notes');
    const blocks = [title('Hooks'), group('<p>Hcue</p>', '<ul><li>Htop one<ul><li>Hsub one</li><li>Hsub two</li></ul></li><li>Htop two</li></ul>')];
    const plain = await render({ name: 'hook0', cornell: true, blocks }, { cssPaging });
    if (plain.cssPaged === null) return t.skip(`${mode} is not available in this browser`);
    for (const cls of ['lp-sub-hook', 'lp-bullet-hook', 'lp-bullet-hook lp-sub-dash']) {
      const r = await render({ name: 'hook1', cornell: true, blocks }, { cssPaging, theme: 'theme-light ' + cls });
      assert.deepEqual(r.errors, []);
      const at = (x) => x.reading.words.filter((w) => /^H/.test(w.w)).map((w) => `${w.w}@${Math.round(w.x)},${Math.round(w.y)}`);
      assert.deepEqual(at(r), at(plain), `${cls}: every word where it was`);
      // (a dash bullet is text in the PDF, a list marker in reading view: not compared)
      const c = compare(r.reading, { ...r.pdf, words: r.pdf.words.filter((w) => w.w !== '–') });
      assert.ok(c.ok, `${cls}: reading view = PDF: ` + describeMismatch(c));
    }
  });
}

test('↳ bullets: on the points chosen, coming down from the line above', async () => {
  const { title, block } = require('./lib/notes');
  const n = { name: 'hook', cornell: false, blocks: [title('H'), block('<ul><li>top<ul><li>sub</li></ul></li></ul>')] };
  for (const [cls, want] of [['lp-sub-hook', [false, true]], ['lp-bullet-hook', [true, true]], ['lp-bullet-hook lp-sub-dash', [true, false]]]) {
    const { page, context } = await openReading(n, { theme: 'theme-light ' + cls });
    try {
      const r = await page.evaluate(() => [...document.querySelectorAll('li')].map((li) => {
        const cs = getComputedStyle(li, '::before');
        return { hook: cs.content !== 'none' && cs.borderLeftStyle === 'solid', up: parseFloat(cs.top) < 0 };
      }));
      assert.deepEqual(r.map((x) => x.hook), want, cls);
      assert.ok(r.filter((x) => x.hook).every((x) => x.up), 'it starts above its own line');
    } finally {
      await context.close();
    }
  }
});

// a point's bullet by the character it was typed with: - (Bullets), * and + (their own settings)
const MARK_SRC = ['>> [!cue]', '>> Mcue', '>', '>> [!notes]', '>> - Mjudaism birth', '>>   + Mspecial foetus', '>>   * Mforty water', '>> ---', '>> ```', '>> - not a point', '>> ```', '>> - Mchristianity conception', '>>   + Mnew soul'].join('\n');
const MARK_HTML = '<ul><li>Mjudaism birth<ul><li>Mspecial foetus</li><li>Mforty water</li></ul></li></ul><hr><pre><code>- not a point</code></pre><ul><li>Mchristianity conception<ul><li>Mnew soul</li></ul></li></ul>';
const markPrepare = (src) => `(() => { const src = ${JSON.stringify(src)}; const el = document.querySelector('blockquote').closest('.markdown-preview-sizer > div'); for (const f of window.__processors) f(el, { getSectionInfo: () => ({ text: src, lineStart: 0, lineEnd: src.split('\\n').length - 1 }) }); const v = document.querySelector('.markdown-preview-view'); window.plugin.layout(v, window.plugin.states.get(v)); })()`;

test('bullets by the character typed: each point marked -, * or + from the note source (not a rule, not code)', async () => {
  const { title, group } = require('./lib/notes');
  const { page, context } = await openReading({ name: 'marks', cornell: true, blocks: [title('M'), group('<p>Mcue</p>', MARK_HTML)] }, { theme: 'theme-light lp-star-arrow lp-plus-hook' });
  try {
    await page.evaluate(markPrepare(MARK_SRC));
    const r = await page.evaluate(() => [...document.querySelectorAll('li')].map((li) => {
      const b = getComputedStyle(li, '::before');
      return [li.className, getComputedStyle(li).listStyleType, b.content === 'none' ? '' : (b.borderLeftStyle === 'solid' ? 'hook' : 'arrow')];
    }));
    assert.deepEqual(r, [
      ['lp-mark-dash', 'disc', ''],
      ['lp-mark-plus', 'none', 'hook'],
      ['lp-mark-star', 'none', 'arrow'],
      ['lp-mark-dash', 'disc', ''],
      ['lp-mark-plus', 'none', 'hook'],
    ]);
  } finally {
    await context.close();
  }
});

for (const [mode, cssPaging] of [['plugin pagination', false], ['CSS pagination', true]]) {
  test(`bullets by the character typed: no word moves, reading view = PDF (${mode})`, async (t) => {
    const { title, group } = require('./lib/notes');
    const blocks = [title('M'), group('<p>Mcue</p>', MARK_HTML)];
    const lines = [0, 0, 0];   // (the title, then the group: its source is MARK_SRC)
    const plain = await render({ name: 'marks0', cornell: true, blocks }, { cssPaging });
    if (plain.cssPaged === null) return t.skip(`${mode} is not available in this browser`);
    const r = await render({ name: 'marks1', cornell: true, blocks }, {
      cssPaging, theme: 'theme-light lp-bullet-arrow lp-star-hook lp-plus-circle',
      prepare: markPrepare(MARK_SRC), exportCtx: { text: MARK_SRC, lines },
    });
    assert.deepEqual(r.errors, []);
    const at = (x) => x.reading.words.filter((w) => /^M/.test(w.w)).map((w) => `${w.w}@${Math.round(w.x)},${Math.round(w.y)}`);
    assert.deepEqual(at(r), at(plain), 'every word where it was');
    // (a bullet drawn as a character is text in the PDF, a list marker in reading view: not compared)
    const c = compare(r.reading, { ...r.pdf, words: r.pdf.words.filter((w) => !/^[∘–•✱]$/.test(w.w)) });
    assert.ok(c.ok, 'reading view = PDF: ' + describeMismatch(c));
  });
}

// Obsidian draws each bullet itself (a .list-bullet in the item): every point shows one bullet, the one
// chosen, whatever the settings
test('bullets with Obsidian\'s own bullet element: one bullet per point, the one chosen', async () => {
  const { title, group } = require('./lib/notes');
  const li = (cls, text, sub = '') => `<li class="${cls}"><span class="list-bullet"></span>${text}${sub}</li>`;
  const html = `<ul class="has-list-bullet">${li('lp-mark-star', 'The stage of pregnancy deems if and how', `<ul class="has-list-bullet">${li('lp-mark-star', 's')}${li('lp-mark-plus', 'd')}</ul>`)}${li('lp-mark-dash', 'a dash point')}</ul>`;
  const n = { name: 'obs-bullets', cornell: true, blocks: [title('B'), group('<p>cue</p>', html)] };
  const cases = [
    ['', ['obsidian', 'obsidian', 'obsidian', 'obsidian']],
    ['lp-star-hook', ['drawn', 'drawn', 'obsidian', 'obsidian']],
    ['lp-star-arrow lp-plus-hook', ['drawn', 'drawn', 'drawn', 'obsidian']],
    ['lp-star-dash lp-plus-circle', ['–', '–', '∘', 'obsidian']],
    ['lp-sub-hook', ['obsidian', 'drawn', 'drawn', 'obsidian']],
    ['lp-bullet-hook lp-sub-dash', ['drawn', '–', '–', 'drawn']],
    ['lp-bullet-dash lp-star-hook', ['drawn', 'drawn', '–', '–']],
  ];
  for (const [cls, want] of cases) {
    const { page, context } = await openReading(n, { theme: 'theme-light ' + cls });
    try {
      const r = await page.evaluate(() => [...document.querySelectorAll('li')].map((li) => {
        const shown = [];
        if (getComputedStyle(li).listStyleType !== 'none') shown.push('marker');
        const b = li.querySelector(':scope > .list-bullet');
        if (b && getComputedStyle(b).visibility === 'visible') {
          const a = getComputedStyle(b, '::after');
          shown.push(a.content === '"\\u200b"' || a.content === '"​"' ? 'obsidian' : a.content.replace(/"/g, ''));
        }
        if (getComputedStyle(li, '::before').content !== 'none') shown.push('drawn');
        return shown.join('+');
      }));
      assert.deepEqual(r, want, cls || '(defaults)');
    } finally {
      await context.close();
    }
  }
});

test('review mode: the notes covered (nothing moves), the cues shown; a click reveals a notes column, another covers it', async () => {
  const { title, group } = require('./lib/notes');
  const n = { name: 'review', cornell: true, blocks: [title('R'), group('<p>Rcue one?</p>', '<p>Rnotes one</p>'), group('<p>Rcue two?</p>', '<p>Rnotes two</p>')] };
  const { page, context } = await openReading(n, { theme: 'theme-light' });
  try {
    const r = await page.evaluate(() => {
      const v = document.querySelector('.markdown-preview-view');
      const pos = () => [...document.querySelectorAll('p')].map((p) => Math.round(p.getBoundingClientRect().top));
      const seen = (re) => { const p = [...document.querySelectorAll('p')].find((x) => re.test(x.textContent)); return getComputedStyle(p).visibility === 'visible'; };
      const before = pos();
      v.classList.add('lp-review');
      const out = { moved: pos().join() !== before.join(), cue: seen(/^Rcue one/), notes: seen(/^Rnotes one/) };
      const notes = document.querySelectorAll('.callout[data-callout="notes"]');
      const click = (el) => window.plugin.onReviewClick({ target: el, preventDefault() {}, stopPropagation() {} });
      click(notes[0].querySelector('p'));
      out.revealed = [seen(/^Rnotes one/), seen(/^Rnotes two/)];
      click(notes[0]);
      out.again = seen(/^Rnotes one/);
      return out;
    });
    assert.deepEqual(r, { moved: false, cue: true, notes: false, revealed: [true, false], again: false });
  } finally {
    await context.close();
  }
});

test('the toolbar: on lined-paper notes, its buttons run the commands (the cursor stays in the note); in reading view only Review', async () => {
  const { page, context } = await openReading({ name: 'tb', cornell: true, blocks: [] }, { theme: 'theme-light' });
  try {
    const r = await page.evaluate(() => {
      const pl = window.plugin;
      const ran = [];
      pl.app.commands = { executeCommandById: (id) => ran.push(id) };
      const mk = (mode, lined) => {
        const c = document.createElement('div');
        c.innerHTML = `<div class="view-content"><div class="${mode === 'source' ? 'markdown-source-view' : 'markdown-reading-view'}"><div class="${lined ? 'lined-paper ' : ''}inner"></div></div></div>`;
        document.body.appendChild(c);
        return { view: { containerEl: c, getMode: () => mode } };
      };
      const editing = mk('source', true), reading = mk('preview', true), plain = mk('source', false);
      pl.app.workspace.getLeavesOfType = () => [editing, reading, plain];
      pl.syncToolbars();
      const bar = editing.view.containerEl.querySelector('.lp-toolbar');
      const btn = (cmd) => bar.querySelector(`[data-cmd="${cmd}"]`);
      const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
      btn('colour-red').dispatchEvent(down);
      btn('colour-red').click(); btn('highlighter-pink').click(); btn('pen-circle').click(); btn('insert-cue-notes').click();
      const shown = (b) => [...b.querySelectorAll('.lp-tb-group')].filter((g) => getComputedStyle(g).display !== 'none').map((g) => g.getAttribute('aria-label'));
      const out = {
        ran, keepsCursor: down.defaultPrevented,
        editing: shown(bar), reading: shown(reading.view.containerEl.querySelector('.lp-toolbar')),
        plain: !!plain.view.containerEl.querySelector('.lp-toolbar'),
      };
      document.body.classList.add('lp-no-toolbar');
      pl.syncToolbars();
      out.off = document.querySelectorAll('.lp-toolbar').length;
      return out;
    });
    assert.deepEqual(r.ran, ['lined-paper-pages:colour-red', 'lined-paper-pages:highlighter-pink', 'lined-paper-pages:pen-circle', 'lined-paper-pages:insert-cue-notes']);
    assert.equal(r.keepsCursor, true, 'a button does not take the cursor out of the note');
    assert.deepEqual(r.editing, ['Insert', 'Pen', 'Highlight', 'Mark', 'Review']);
    assert.deepEqual(r.reading, ['Review']);
    assert.equal(r.plain, false, 'not on a plain note');
    assert.equal(r.off, 0, 'none with the setting off');
  } finally {
    await context.close();
  }
});

// Cue cards: the cues that are questions with their notes, laid out on A4 sheets (one sheet = one
// printed page), answers behind their questions; long text made smaller to fit its card
const CUE_MD = '# Life\n> [!cue]\n> At which point does Judaism hold life begins?\n\n> [!notes]\n> CJ at ==birth==.\n\n> [!cue]\n> Christianity view\n\n> [!notes]\n> not a question\n\n> [!cue]\n> When does **Christianity** hold it begins?\n\n> [!notes]\n> CC at conception. ' + 'A new soul comes into existence. '.repeat(14) + '\n\n> [!cue]\n> What do biologists say? \n\n> [!notes]\n> CB from fertilisation.\n';
// the cards drawn as the plugin draws a ```cuecards block (the markdown turned into HTML here: no Obsidian)
const cardsPage = async (page, settings) => page.evaluate(([md, settings]) => {
  const P = window.plugin.constructor;
  const { cards } = P.parseCueBlock(P.cueBlockText(P.cornellCards(md), { title: 'Life' }).split('\n').slice(1, -1).join('\n'));
  const html = (t) => { const d = document.createElement('div'); d.innerHTML = '<p>' + t.replace(/==(.+?)==/g, '<mark>$1</mark>').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') + '</p>'; return d; };
  document.body.innerHTML = '<div class="markdown-reading-view"><div class="markdown-preview-view markdown-rendered lp-cuecards"><div class="block-language-cuecards lp-cuecards-block"></div></div></div>';
  const host = document.querySelector('.lp-cuecards-block');
  host.appendChild(P.buildCardWrap(cards.map((c) => ({ q: html(c.q), a: html(c.a) })), { size: settings['cards-size'], back: settings['cards-back'], title: 'Life' }));
  P.fitCards(document.body);
  return cards.map((c) => c.q.replace(/\*\*/g, ''));
}, [CUE_MD, settings]);

test('cue cards: only the cues that are questions; sheets as set; each answer behind its question; long text fitted', async () => {
  const { page, context } = await openReading({ name: 'cards', cornell: true, blocks: [] }, { theme: 'theme-light' });
  try {
    const qs = await cardsPage(page, {});
    assert.deepEqual(qs, ['At which point does Judaism hold life begins?', 'When does Christianity hold it begins?', 'What do biologists say?'], 'not "Christianity view"');
    const r = await page.evaluate(() => {
      const sheets = [...document.querySelectorAll('.lp-card-sheet')];
      const text = (cell) => (cell.querySelector('.lp-card-text') || cell).textContent.trim().slice(0, 2);
      const over = [...document.querySelectorAll('.lp-card-sheet .lp-card-face')].filter((f) => f.scrollHeight > f.clientHeight + 1).length;
      return { sheets: sheets.map((s) => s.className.replace('lp-card-sheet lp-', '')), front: [...sheets[0].children].slice(0, 3).map(text), back: [...sheets[1].children].slice(0, 4).map(text), over };
    });
    assert.deepEqual(r.sheets, ['front', 'back']);
    assert.deepEqual(r.front, ['At', 'Wh', 'Wh']);
    assert.deepEqual(r.back, ['CC', 'CJ', '', 'CB'], 'each answer behind its question (mirrored)');
    assert.equal(r.over, 0, 'every card shows all its text');
    // fold: question and answer side by side
    const fold = await page.evaluate(() => [...document.querySelectorAll('.lp-cards-wrap')].length);
    assert.equal(fold, 1);
    await cardsPage(page, { 'cards-back': 'fold', 'cards-size': 'small' });
    const f2 = await page.evaluate(() => [...document.querySelector('.lp-card-sheet').children].slice(0, 2).map((c) => c.querySelector('.lp-card-text').textContent.trim().slice(0, 2)));
    assert.deepEqual(f2, ['At', 'CJ']);
  } finally {
    await context.close();
  }
});

test('cue cards look like ruled index cards: a red line under the top row, the writing on the blue lines, highlights as a highlighter', async () => {
  const { page, context } = await openReading({ name: 'cards', cornell: true, blocks: [] }, { theme: 'theme-dark' });
  try {
    await cardsPage(page, {});
    const r = await page.evaluate(() => {
      const cell = document.querySelector('.lp-card-sheet .lp-card-cell.lp-front');
      const face = cell.querySelector('.lp-card-face'), text = cell.querySelector('.lp-card-text');
      const rows = +face.dataset.rows, row = cell.getBoundingClientRect().height / rows;
      const top = cell.getBoundingClientRect().top;
      const red = getComputedStyle(cell, '::before');
      const mark = [...document.querySelectorAll('.lp-card-sheet.lp-back .lp-card-text mark')][0];
      const ms = getComputedStyle(mark);
      return {
        rows, red: red.backgroundColor, redTop: (parseFloat(red.top) + parseFloat(red.height) / 2) / row,
        paper: getComputedStyle(cell).backgroundColor, lines: cell.style.length >= 0 && getComputedStyle(cell).backgroundImage.includes('linear-gradient'),
        lineH: parseFloat(getComputedStyle(text).lineHeight) / row,
        label: cell.querySelector('.lp-card-label').textContent, no: cell.querySelector('.lp-card-no').textContent,
        mark: ms.backgroundImage.includes('255, 232, 26'), ink: getComputedStyle(text).color,
      };
    });
    assert.equal(r.rows, 10);
    assert.equal(r.red, 'rgb(224, 102, 102)', 'a red line');
    assert.ok(Math.abs(r.redTop - 1) < 0.1, 'under the top row: ' + r.redTop);
    assert.equal(r.paper, 'rgb(255, 255, 255)', 'white, in dark mode too');
    assert.ok(r.lines, 'blue lines');
    assert.ok(Math.abs(r.lineH - 1) < 0.02, 'one line of writing a row');
    assert.deepEqual([r.label, r.no], ['Life', '1']);
    assert.ok(r.mark, 'the light highlighter, on the white card');
    assert.equal(r.ink, 'rgb(31, 41, 55)', 'dark writing on the white card');
  } finally {
    await context.close();
  }
});

test('cue cards in a dark lined-paper note (Obsidian\'s markup: lists with bullets, highlights): every line of writing sits on a ruled line, in each font', async () => {
  const { page, context } = await openReading({ name: 'cards', cornell: true, blocks: [] }, { theme: 'theme-dark' });
  try {
    const r = await page.evaluate(() => {
      const P = window.plugin.constructor;
      const view = document.querySelector('.markdown-preview-view');
      const host = document.createElement('div');
      host.className = 'el-pre';
      host.innerHTML = '<div class="block-language-cuecards lp-cuecards-block"></div>';
      (view.querySelector('.markdown-preview-sizer') || view).appendChild(host);
      const html = (s) => { const d = document.createElement('div'); d.innerHTML = s; return d; };
      const cards = [
        { q: html('<p>When does <strong>life</strong> begin?</p>'), a: html('<ul class="has-list-bullet"><li data-line="0" dir="auto"><span class="list-bullet"></span>CJ at <mark>birth</mark>, when the head emerges</li><li data-line="1" dir="auto"><span class="list-bullet"></span>the soul enters at <strong>birth</strong></li></ul>'), h: 'Beginning of Life' },
        { q: html('<p>What do biologists say?</p>'), a: html('<p>From fertilisation. ' + 'A new life begins. '.repeat(6) + '</p><p>Second paragraph.</p>'), h: 'Abortion' },
      ];
      const out = {};
      for (const font of ['serif', 'sans-serif', 'cursive']) {
        const block = host.firstChild;
        block.replaceChildren(P.buildCardWrap(cards, { title: 'Life' }));
        block.querySelector('.lp-cards-wrap').style.setProperty('--card-hand', font);
        P.fitCards(block);
        const bad = [];
        for (const cell of block.querySelectorAll('.lp-card-sheet .lp-card-cell:not(.lp-empty)')) {
          const box = cell.getBoundingClientRect(), t = cell.querySelector('.lp-card-text');
          const row = parseFloat(getComputedStyle(t).lineHeight);
          if (Math.abs(row - box.height / 10) > 0.5) bad.push('row ' + row + ' vs ' + box.height / 10);
          // a mark at the baseline of each line of writing (a zero-size box sits on the baseline)
          const probes = [];
          const walk = document.createTreeWalker(t, NodeFilter.SHOW_TEXT);
          const texts = []; for (let n; (n = walk.nextNode());) if (n.textContent.trim()) texts.push(n);
          for (const n of texts) {
            const words = n.textContent.split(/(\s+)/);
            const frag = document.createDocumentFragment();
            for (const w of words) { frag.appendChild(document.createTextNode(w)); if (w.trim()) { const p = document.createElement('i'); p.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline'; frag.appendChild(p); probes.push(p); } }
            n.replaceWith(frag);
          }
          const ys = [...new Set(probes.map((p) => Math.round((p.getBoundingClientRect().bottom - box.top) * 10) / 10))];
          for (const y of ys) {
            const f = (y / row) % 1, line = Math.floor(y / row);
            if (f < 0.7 || f > 0.97 || line < 1 || line > 9) bad.push(`${cell.textContent.trim().slice(0, 12)}: baseline at row ${(y / row).toFixed(2)}`);
          }
        }
        out[font] = bad;
      }
      return out;
    });
    assert.deepEqual(r, { serif: [], 'sans-serif': [], cursive: [] });
  } finally {
    await context.close();
  }
});

// (Obsidian's Modal and ItemView, as much as the card editor and the panel use)
const WITH_MODAL = `const __require = require;
require = (n) => (n !== 'obsidian' ? __require(n) : Object.assign({}, __require(n), {
  Modal: class { constructor(app) { this.app = app; this.modalEl = document.createElement('div'); this.modalEl.className = 'modal'; this.titleEl = document.createElement('div'); this.titleEl.setText = (t) => { this.titleEl.textContent = t; }; this.modalEl.addClass = (c) => this.modalEl.classList.add(c); this.contentEl = document.createElement('div'); this.modalEl.append(this.titleEl, this.contentEl); }
    open() { document.body.appendChild(this.modalEl); } close() { this.modalEl.remove(); if (this.onClose) this.onClose(); } },
  ItemView: class { constructor(leaf) { this.leaf = leaf; this.contentEl = document.createElement('div'); } },
}));
` + require('./lib/harness').MAIN;

const BLOCK = 'size: standard\n\n# Beginning of Life\nQ: When does life begin?\nA: - at **birth**\n   - or at conception\n\nQ: What do biologists say?\nA: From fertilisation.\n\n# Abortion\nQ: Who opposes it?\nA: The Church.';
test('the card editor: one card at a time (flip through), how it looks under it; move, add, take out, save', async () => {
  const { page, context } = await openReading({ name: 'cards', cornell: true, blocks: [] }, { theme: 'theme-dark', src: WITH_MODAL });
  try {
    const r = await page.evaluate(async (block) => {
      const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
      const plugin = window.plugin;
      let text = 'intro\n```cuecards\n' + block + '\n```\nafter';
      plugin.app.vault = { read: async () => text, process: async (f, fn) => { text = fn(text); } };
      await plugin.editCueCards({ path: 'Cue cards/Life cue cards.md', basename: 'Life cue cards' }, 1);
      await wait(400);
      const ed = document.querySelector('.lp-card-editor');
      const state = () => ({
        shown: ed.querySelectorAll('.lp-ce-card').length,
        pick: [...ed.querySelectorAll('.lp-ce-pick option')].map((o) => o.textContent),
        at: ed.querySelector('.lp-ce-pick').value,
        h: ed.querySelector('.lp-ce-field input').value, q: ed.querySelector('.lp-ce-q').value,
        look: [...ed.querySelectorAll('.lp-ce-preview .lp-deck-card')].map((c) => [...c.querySelectorAll('.lp-card-cell')].find((x) => getComputedStyle(x).display !== 'none').textContent.replace(/\s+/g, ' ').trim()),
      });
      const first = state();
      const btn = (label) => [...ed.querySelectorAll('button')].find((b) => b.textContent.includes(label));
      btn('›').click(); await wait(300);
      const third = state();
      // change the question, move it earlier, add one after it, take the first out, save
      const q = ed.querySelector('.lp-ce-q'); q.value = 'Who opposes IVF?'; q.dispatchEvent(new Event('input'));
      btn('Move earlier').click(); await wait(50);
      btn('Card after this').click(); await wait(50);
      ed.querySelector('.lp-ce-q').value = 'New?'; ed.querySelector('.lp-ce-q').dispatchEvent(new Event('input'));
      ed.querySelector('.lp-ce-a').value = 'Yes.'; ed.querySelector('.lp-ce-a').dispatchEvent(new Event('input'));
      ed.querySelector('.lp-ce-pick').value = '0'; ed.querySelector('.lp-ce-pick').dispatchEvent(new Event('change'));
      btn('Take out').click(); await wait(50);
      btn('Save').click(); await wait(100);
      return { first, third, text, open: !!document.querySelector('.lp-card-editor') };
    }, BLOCK);
    assert.equal(r.first.shown, 1, 'one card at a time');
    assert.deepEqual(r.first.pick, ['1. When does life begin?', '2. What do biologists say?', '3. Who opposes it?']);
    assert.equal(r.first.at, '1', 'opened at the card asked for');
    assert.deepEqual([r.first.h, r.first.q], ['Beginning of Life', 'What do biologists say?']);
    assert.deepEqual(r.first.look, ['What do biologists say?Beginning of Life2', 'From fertilisation.Beginning of Life2 ✓'], 'the front and the back, as they will look');
    assert.deepEqual([r.third.at, r.third.h, r.third.q], ['2', 'Abortion', 'Who opposes it?']);
    assert.equal(r.open, false);
    assert.equal(r.text, 'intro\n```cuecards\nsize: standard\n\n# Abortion\nQ: Who opposes IVF?\nA: The Church.\n\nQ: New?\nA: Yes.\n\n# Beginning of Life\nQ: What do biologists say?\nA: From fertilisation.\n```\nafter');
  } finally {
    await context.close();
  }
});

test('the cards beside the note: one at a time (flip through), the card you are writing in; nothing when the note has no question cues', async () => {
  const { page, context } = await openReading({ name: 'cards', cornell: true, blocks: [] }, { theme: 'theme-light', src: WITH_MODAL });
  try {
    const r = await page.evaluate(async () => {
      const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
      const plugin = window.plugin;
      const panel = document.createElement('div'); panel.style.width = '320px'; document.body.appendChild(panel);
      const leaf = { view: { contentEl: panel } };
      let note = '# Life\n>> [!cue]\n>> When does life begin? %% [slide](https://example.com) (Slide 9) %%\n>\n>> [!notes]\n>> At birth.\n\n# Abortion\n>> [!cue]\n>> Who opposes it?\n>\n>> [!notes]\n>> The Church.\n';
      let cursor = 0;
      const file = { path: 'Life.md', basename: 'Life' };
      const md = { file, editor: { getValue: () => note, getCursor: () => ({ line: cursor, ch: 0 }) } };
      Object.assign(plugin.app.workspace, { getLeavesOfType: (t) => (t === 'lp-cue-cards' ? [leaf] : [{ view: md }]) });
      plugin.cardSource = file;
      const shown = () => { const c = panel.querySelector('.lp-deck-card.lp-current'); return c ? [panel.querySelectorAll('.lp-deck-card').length, [...panel.querySelectorAll('.lp-deck-card')].filter((x) => getComputedStyle(x).display !== 'none').length, c.querySelector('.lp-card-label').textContent, c.querySelector('.lp-front .lp-card-text').textContent.trim(), panel.querySelector('.lp-cards-at').textContent] : null; };
      await plugin.refreshCardPanel(); await wait(50);
      const a = shown();
      panel.querySelector('.lp-nav-next').click(); await wait(50);
      const b = shown();
      await plugin.refreshCardPanel(); await wait(50);
      const kept = shown();
      cursor = 4; await plugin.refreshCardPanel(true); await wait(50);   // (writing in the first card's notes)
      const follow = shown();
      note = '# Life\n>> [!cue]\n>> Christianity view\n>\n>> [!notes]\n>> no question\n';
      await plugin.refreshCardPanel(); await wait(50);
      return { a, b, kept, follow, empty: panel.innerHTML };
    });
    assert.deepEqual(r.a, [2, 1, 'Life', 'When does life begin?', '1 / 2'], 'one card shown, its heading at the top, the hidden comment left out');
    assert.deepEqual(r.b, [2, 1, 'Abortion', 'Who opposes it?', '2 / 2']);
    assert.deepEqual(r.kept, r.b, 'still at that card when the panel is drawn again');
    assert.deepEqual(r.follow, r.a, 'the card you are writing in');
    assert.equal(r.empty, '', 'nothing');
  } finally {
    await context.close();
  }
});

test('cue cards print one sheet per A4 page, and nothing else', async () => {
  const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
  const { page, context } = await openReading({ name: 'cards', cornell: true, blocks: [] }, { theme: 'theme-light' });
  try {
    await cardsPage(page, { 'cards-size': 'big' });   // (4 a sheet: 3 cards, a front sheet and its back)
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'lpp-cards-')), 'cards.pdf');
    await page.emulateMedia({ media: 'print' });
    await page.pdf({ path: file, format: 'A4', margin: { top: 0, right: 0, bottom: 0, left: 0 }, printBackground: true });
    const pdf = fs.readFileSync(file, 'latin1');
    assert.equal((pdf.match(/\/Type\s*\/Page[^s]/g) || []).length, 2, 'two pages: the fronts, then the backs');
    fs.rmSync(path.dirname(file), { recursive: true, force: true });
  } finally {
    await context.close();
  }
});

test('toolbar and buttons settings: groups hidden, the revise button off', async () => {
  const { page, context } = await openReading({ name: 'tb2', cornell: true, blocks: [] }, { theme: 'theme-light lp-tb-no-pen lp-tb-no-mark lp-no-revise lp-tb-at-bl' });
  try {
    const r = await page.evaluate(() => {
      const host = document.createElement('div'); host.className = 'view-content'; document.body.appendChild(host);
      const bar = window.plugin.toolbarFor({ getMode: () => 'source' }); host.appendChild(bar);
      const rev = document.createElement('div'); rev.className = 'lp-revise'; document.body.appendChild(rev);
      return { shown: [...bar.querySelectorAll('.lp-tb-group')].filter((g) => getComputedStyle(g).display !== 'none').map((g) => g.getAttribute('aria-label')), bottom: getComputedStyle(bar).bottom !== 'auto', revise: getComputedStyle(rev).display };
    });
    assert.deepEqual(r, { shown: ['Insert', 'Highlight', 'Review'], bottom: true, revise: 'none' });
  } finally {
    await context.close();
  }
});
