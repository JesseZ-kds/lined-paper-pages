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

// An embed of one block that is not a callout (`![[Other#^id]]` of a paragraph or a list) has no
// embed frame either (no side bar, no title, no link icon, no padding): its text is written on the
// ruled lines like the text around it
test('a block embed has no embed frame and its text is on the lines', async () => {
  const { openReading } = require('./lib/harness');
  const { page, context } = await openReading(note('blockEmbeds'));
  try {
    const r = await page.evaluate(() => {
      const d = document.createElement('div'); d.style.cssText = 'position:absolute;height:var(--line)';
      document.querySelector('.markdown-preview-view').appendChild(d); const L = d.getBoundingClientRect().height; d.remove();
      const frames = [...document.querySelectorAll('.internal-embed')].map((e) => {
        const cs = getComputedStyle(e), t = e.querySelector('.markdown-embed-title, .embed-title'), link = e.querySelector('.markdown-embed-link');
        return [cs.borderLeftWidth, cs.paddingLeft, t ? getComputedStyle(t).display : 'none', link ? getComputedStyle(link).display : 'none'].join(' ');
      });
      const at = (re) => [...document.querySelectorAll('p, li')].find((p) => re.test(p.textContent) && !p.querySelector('p, li')).getBoundingClientRect().top;
      const rows = [(at(/^EMBP/) - at(/^before/)) / L, (at(/^after/) - at(/^EMBP/)) / L];
      return { frames: [...new Set(frames)], rows: rows.map((x) => +x.toFixed(2)) };
    });
    assert.deepEqual(r.frames, ['0px 0px none none']);
    assert.deepEqual(r.rows, [1, 1], 'the embedded line is the next ruled line, and the line after it the one after');
  } finally {
    await context.close();
  }
});

// An embedded table (`![[Other#^table]]`) starts on the embed's own line, whatever Obsidian puts above
// it inside the embed (spacing, an element where the hidden title is): nothing pushes it a line down
for (const [mode, cssPaging] of [['plugin pagination', false], ['CSS pagination', true]]) {
  for (const extra of ['spacing', 'element']) {
    test(`an embedded table starts on its own line (${extra} above it in the embed, ${mode})`, async (t) => {
      const { openReading } = require('./lib/harness');
      const { title, group } = require('./lib/notes');
      const table = '<table><thead><tr><th>EMBHEAD</th><th>B</th></tr></thead><tbody><tr><td>EMBROW</td><td>x</td></tr></tbody></table>';
      const filler = extra === 'element' ? '<div class="el-div"><div class="obsidian-thing" style="height:31px"><span></span></div></div>' : '';
      const embed = `<p><span class="internal-embed markdown-embed inline-embed is-loaded" src="Other#^t"><template class="emb"><div class="embed-title markdown-embed-title"></div><div class="markdown-embed-content"><div class="markdown-preview-view markdown-rendered"><div class="markdown-preview-sizer markdown-preview-section" style="padding-bottom: 0px;"><div class="markdown-preview-pusher" style="height:0.1px"></div><div class="mod-header"></div>${filler}<div class="el-table"${extra === 'spacing' ? ' style="padding-top:31px;margin-top:31px"' : ''}>${table}</div><div class="mod-footer"></div></div></div></div><div class="markdown-embed-link"></div></template></span></p>`;
      const { page, context } = await openReading({ name: 'tab', cornell: true, blocks: [title('T'), group('<p>cue</p>', `<p>before</p>${embed}<p>after</p>`)] }, { cssPaging });
      if (!page) return t.skip(`${mode} is not available in this browser`);
      try {
        const rows = await page.evaluate(() => {
          const d = document.createElement('div'); d.style.cssText = 'position:absolute;height:var(--line)'; document.querySelector('.markdown-preview-view').appendChild(d); const L = d.getBoundingClientRect().height; d.remove();
          const at = (re) => [...document.querySelectorAll('p, th, td')].find((x) => re.test(x.textContent) && !x.querySelector('p, th, td')).getBoundingClientRect().top;
          return [+((at(/^EMBHEAD/) - at(/^before$/)) / L).toFixed(1), +((at(/^EMBROW/) - at(/^before$/)) / L).toFixed(1)];
        });
        assert.deepEqual(rows, [1, 2], 'the table head on the line after "before", its row on the next');
      } finally {
        await context.close();
      }
    });
  }
}

// The `![[Note#^id]]` line takes no room of its own: text written on the lines right before and
// after it (the same paragraph: a <br>, or a newline in the notes) is on the lines just above and
// just below the embedded text, not a line further
for (const [name, html] of [['line breaks', 'before<br>EMB<br>after'], ['newlines', 'before\nEMB\nafter']]) {
  test(`text right after an embed is on the next line (${name})`, async () => {
    const { openReading } = require('./lib/harness');
    const { title, group } = require('./lib/notes');
    const span = '<span class="internal-embed markdown-embed inline-embed is-loaded" src="Other#^x"><template class="emb"><div class="embed-title markdown-embed-title"></div><div class="markdown-embed-content"><div class="markdown-preview-view markdown-rendered"><div class="markdown-preview-sizer markdown-preview-section"><div class="markdown-preview-pusher" style="height:0.1px"></div><div class="mod-header"></div><div class="el-p"><p>EMBEDDED line</p></div><div class="mod-footer"></div></div></div></div><div class="markdown-embed-link"></div></template></span>';
    const { page, context } = await openReading({ name: 'br', cornell: true, blocks: [title('E'), group('<p>cue</p>', `<p>${html.replace('EMB', span)}</p>`)] });
    try {
      const rows = await page.evaluate(() => {
        const d = document.createElement('div'); d.style.cssText = 'position:absolute;height:var(--line)'; document.querySelector('.markdown-preview-view').appendChild(d); const L = d.getBoundingClientRect().height; d.remove();
        const outer = document.querySelector('.callout[data-callout="notes"] .callout-content > p');
        const inner = [...document.querySelectorAll('p')].find((p) => p.textContent === 'EMBEDDED line');
        return [+((inner.getBoundingClientRect().top - outer.getBoundingClientRect().top) / L).toFixed(2), +(outer.getBoundingClientRect().height / L).toFixed(2)];
      });
      assert.deepEqual(rows, [1, 3], 'the embed on the 2nd line, the paragraph 3 lines (before, embed, after)');
    } finally {
      await context.close();
    }
  });
}

// A table with an empty header row (`| | |` over `|---|---|`, the way a table without a header is
// written) has no header on the page: its first row is on the line the table starts on, embedded
// (`![[Other#^table]]` at the top of the notes) or typed, in reading view and the PDF
for (const [mode, cssPaging] of MODES) {
  for (const head of ['<th></th><th></th><th></th>', '<th> </th><th><br></th><th>\n</th>']) {
    test(`a table with an empty header row has no header line (${head.includes('br') ? 'spaces' : 'empty'}, ${mode})`, async (t) => {
      const { title, group } = require('./lib/notes');
      const table = `<table><thead><tr>${head}</tr></thead><tbody><tr><td></td><td><strong>EMBHEAD</strong></td><td>B</td></tr><tr><td>ACT</td><td>EMBROW</td><td>x</td></tr></tbody></table>`;
      const embed = `<p><span class="internal-embed markdown-embed inline-embed is-loaded" src="Other#^t"><template class="emb"><div class="embed-title markdown-embed-title"></div><div class="markdown-embed-content"><div class="markdown-preview-view markdown-rendered"><div class="markdown-preview-sizer markdown-preview-section"><div class="markdown-preview-pusher" style="height:0.1px"></div><div class="mod-header"></div><div class="el-table">${table}</div><div class="mod-footer"></div></div></div></div><div class="markdown-embed-link"></div></template></span></p>`;
      const { page, context } = await openReading({ name: 'thead', cornell: true, blocks: [title('T'), group('<p>cue one</p>', '<p>first</p>'), group('<p>CUEX</p>', embed)] }, { cssPaging });
      if (!page) return t.skip(`${mode} is not available in this browser`);
      try {
        const rows = await page.evaluate(() => {
          const d = document.createElement('div'); d.style.cssText = 'position:absolute;height:var(--line)'; document.querySelector('.markdown-preview-view').appendChild(d); const L = d.getBoundingClientRect().height; d.remove();
          const at = (re) => [...document.querySelectorAll('p, td')].find((x) => re.test(x.textContent) && !x.querySelector('p, td')).getBoundingClientRect().top;
          return [+((at(/^EMBHEAD/) - at(/^CUEX/)) / L).toFixed(2), +((at(/^EMBROW/) - at(/^CUEX/)) / L).toFixed(2)];
        });
        assert.deepEqual(rows, [0, 1], 'the first row on the cue\'s line, the next row under it');
      } finally {
        await context.close();
      }
    });
  }
  test(`a typed table with an empty header row: reading view = PDF (${mode})`, async (t) => {
    const { title, group, block } = require('./lib/notes');
    const table = '<table><thead><tr><th></th><th></th></tr></thead><tbody><tr><td>Tfirst</td><td>Tsecond</td></tr><tr><td>Tthird</td><td>Tfourth</td></tr></tbody></table>';
    const r = await render({ name: 'thead-typed', cornell: true, blocks: [title('T'), group('<p>cue</p>', `<p>above</p>${table}<p>below</p>`), block('<p>after the group</p>'), block(table)] }, { cssPaging });
    if (r.cssPaged === null) return t.skip(`${mode} is not available in this browser`);
    const c = compare(r.reading, r.pdf);
    assert.ok(c.ok, 'reading view = PDF: ' + describeMismatch(c));
    const y = (w) => r.reading.words.find((x) => x.w === w).y;
    const L = r.reading.geometry.line;
    assert.equal(Math.round((y('Tfirst') - y('above')) / L), 1, 'the table\'s first row on the line under "above"');
  });
}

// Whatever takes a line between the writing above an embed and the embed's first line (inside the
// embed or outside it: a line break, an invisible character, an empty element, an empty paragraph),
// the embed is pulled up: its first line goes straight under the writing above it, or on the
// column's first line. Text after the embed follows it.
for (const [mode, cssPaging] of MODES) {
  const phantoms = {
    'line break': (emb) => `<p><br>${emb}</p>`,
    'invisible character': (emb) => `<p>​<br>${emb}</p>`,
    'empty element': (emb) => `<p><span style="display:block;height:31px"></span>${emb}</p>`,
    'empty paragraph': (emb) => `<p><br></p><p>${emb}</p>`,
    'inside the embed': (emb) => `<p>${emb.replace('<div class="mod-header"></div>', '<div class="mod-header"></div><div class="el-p"><div style="height:31px"></div></div>')}</p>`,
  };
  for (const [name, wrap] of Object.entries(phantoms)) {
    for (const above of ['', '<p>Wabove</p>']) {
      test(`an embed starts on its line with ${name} before it (${above ? 'text above' : 'first in the notes'}, ${mode})`, async (t) => {
        const { title, group } = require('./lib/notes');
        const table = '<table><thead><tr><th>EMBHEAD</th><th>B</th></tr></thead><tbody><tr><td>EMBROW</td><td>x</td></tr></tbody></table>';
        const emb = `<span class="internal-embed markdown-embed inline-embed is-loaded" src="Other#^t"><template class="emb"><div class="embed-title markdown-embed-title"></div><div class="markdown-embed-content"><div class="markdown-preview-view markdown-rendered"><div class="markdown-preview-sizer markdown-preview-section"><div class="markdown-preview-pusher" style="height:0.1px"></div><div class="mod-header"></div><div class="el-table">${table}</div><div class="mod-footer"></div></div></div></div><div class="markdown-embed-link"></div></template></span>`;
        const { page, context } = await openReading({ name: 'ph', cornell: true, blocks: [title('T'), group('<p>cue one</p>', '<p>first</p>'), group('<p>CUEX</p>', above + wrap(emb) + '<p>Wafter</p>')] }, { cssPaging });
        if (!page) return t.skip(`${mode} is not available in this browser`);
        try {
          const rows = await page.evaluate(() => {
            const d = document.createElement('div'); d.style.cssText = 'position:absolute;height:var(--line)'; document.querySelector('.markdown-preview-view').appendChild(d); const L = d.getBoundingClientRect().height; d.remove();
            const at = (re) => [...document.querySelectorAll('p, th, td')].find((x) => re.test(x.textContent) && !x.querySelector('p, th, td')).getBoundingClientRect().top;
            return ['EMBHEAD', 'EMBROW'].map((w) => +((at(new RegExp('^' + w)) - at(/^CUEX/)) / L).toFixed(2));
          });
          const s = above ? 1 : 0;
          assert.deepEqual(rows, [s, s + 1], 'the table straight under what is above it');
        } finally {
          await context.close();
        }
      });
    }
  }
}

// An embedded callout first in the notes starts on the notes' first line, like a typed one, whatever
// takes a line above it (an empty paragraph, a line break, an empty element)
for (const [mode, cssPaging] of MODES) {
  const { title, group, callout } = require('./lib/notes');
  const quote = callout('quote', 'QTITLE source', '<p>QTEXT a quoted line</p>');
  const emb = `<span class="internal-embed markdown-embed inline-embed is-loaded" src="Quotes#^q"><template class="emb"><div class="embed-title markdown-embed-title"></div><div class="markdown-embed-content"><div class="markdown-preview-view markdown-rendered"><div class="markdown-preview-sizer markdown-preview-section"><div class="markdown-preview-pusher" style="height:0.1px"></div><div class="mod-header"></div><div class="el-div">${quote}</div><div class="mod-footer"></div></div></div></div><div class="markdown-embed-link"></div></template></span>`;
  const shapes = {
    none: `<p>${emb}</p>`,
    'empty paragraph': `<p><br></p><p>${emb}</p>`,
    'line break': `<p><br>${emb}</p>`,
    'empty element': `<div style="height:31px"></div><p>${emb}</p>`,
  };
  for (const [name, html] of Object.entries(shapes)) {
    test(`an embedded quote first in the notes starts on the notes' first line (${name}, ${mode})`, async (t) => {
      const blocks = [title('T'), group('<p>CUEA which point</p>', `${html}<ul><li>LISTA a point</li></ul>`), group('<p>CUEB next</p>', `<p>${emb.replace('#^q', '#^q2')}</p><ul><li>LISTB b</li></ul>`)];
      const typed = await render({ name: 'quote-typed', cornell: true, blocks: [title('T'), group('<p>CUEA which point</p>', `${quote}<ul><li>LISTA a point</li></ul>`), group('<p>CUEB next</p>', `${quote}<ul><li>LISTB b</li></ul>`)] }, { cssPaging });
      if (typed.cssPaged === null) return t.skip(`${mode} is not available in this browser`);
      const r = await render({ name: 'quote-embed', cornell: true, blocks }, { cssPaging });
      assert.deepEqual(r.errors, []);
      const at = (x) => x.reading.words.filter((w) => /^(QTITLE|QTEXT|LISTA|LISTB|CUEA|CUEB)$/.test(w.w)).map((w) => `${w.w}@${w.page}:${Math.round(w.y)}`);
      assert.deepEqual(at(r), at(typed), 'where a typed quote would be');
      const c = compare(r.reading, r.pdf);
      assert.ok(c.ok, 'reading view = PDF: ' + describeMismatch(c));
    });
  }
}

// A table, typed or embedded, in a theme whose tables have lines between rows, a heavier line under
// the header, padding in the cells, spacing round the table: every row's writing is on the lines,
// and so is everything under it
const THEME_TABLES = `.markdown-rendered table { border-collapse: separate; border-spacing: 0 2px; margin-block: 0.6em; }
  .markdown-rendered th, .markdown-rendered td { padding: 4px 10px; border-bottom: 1px solid #ccc; }
  .markdown-rendered thead tr { border-bottom: 2px solid #999; }
  .markdown-rendered .table-wrapper { margin: 9px 0; padding-bottom: 7px; }
  .markdown-rendered td > p { margin: 3px 0; }`;
for (const [mode, cssPaging] of MODES) {
  for (const embedded of [true, false]) {
    test(`${embedded ? 'an embedded' : 'a typed'} table in a theme with table borders and padding: its rows and everything under it on the lines (${mode})`, async (t) => {
      const { title, group } = require('./lib/notes');
      const table = '<div class="table-wrapper"><table><thead><tr><th></th><th><strong>TPermissible</strong></th><th>TRequired</th></tr></thead><tbody><tr><td><strong>TACT</strong></td><td>TAnytime</td><td>TNo</td></tr><tr><td><strong>TNSW</strong></td><td><p>TUp to 22</p></td><td>TTwo</td></tr><tr><td>TQLD</td><td>TUp to 22</td><td>TTwo</td></tr></tbody></table></div>';
      const notes = embedded
        ? `<p><span class="internal-embed markdown-embed inline-embed is-loaded" src="Laws#^t"><template class="emb"><div class="embed-title markdown-embed-title"></div><div class="markdown-embed-content"><div class="markdown-preview-view markdown-rendered"><div class="markdown-preview-sizer markdown-preview-section"><div class="markdown-preview-pusher" style="height:0.1px"></div><div class="mod-header"></div><div class="el-table">${table}</div><div class="mod-footer"></div></div></div></div><div class="markdown-embed-link"></div></template></span></p>`
        : table;
      const blocks = [title('T'), group('<p>TUntil when do they need special approval?</p>', notes), group('<p>TInformed consent</p>', '<ul><li>TMust be chosen freely</li></ul>'), group('<p>TConscientious objection</p>', '<ul><li>TDoctors can abstain</li></ul>')];
      const { page, context } = await openReading({ name: 'tables', cornell: true, blocks }, { cssPaging });
      if (!page) return t.skip(`${mode} is not available in this browser`);
      try {
        await page.addStyleTag({ content: THEME_TABLES });
        const r = await page.evaluate(async () => {
          const v = document.querySelector('.markdown-preview-view');
          window.plugin.layout(v, window.plugin.states.get(v));
          await new Promise((res) => setTimeout(res, 50));
          const d = document.createElement('div'); d.style.cssText = 'position:absolute;height:var(--line)'; v.appendChild(d); const L = d.getBoundingClientRect().height; d.remove();
          const top = v.querySelector('.markdown-preview-sizer').getBoundingClientRect().top;
          const rg = document.createRange();
          const out = [];
          const tw = document.createTreeWalker(v, NodeFilter.SHOW_TEXT);
          for (let n = tw.nextNode(); n; n = tw.nextNode()) {
            const m = /T\w+/.exec(n.data);
            if (!m || !n.parentElement.checkVisibility() || n.parentElement.closest('h1')) continue;
            rg.setStart(n, m.index); rg.setEnd(n, m.index + 1);
            const b = rg.getBoundingClientRect();
            if (!b.height) continue;
            out.push([m[0], +(((b.bottom - top) % L + L) % L).toFixed(1)]);
          }
          return out;
        });
        // every word the same height above its ruled line as the first one
        const ref = r[0][1];
        const off = r.filter(([, y]) => Math.abs(y - ref) > 1.5);
        assert.deepEqual(off, [], 'on the lines like the rest: ' + JSON.stringify(r));
      } finally {
        await context.close();
      }
    });
  }
}
