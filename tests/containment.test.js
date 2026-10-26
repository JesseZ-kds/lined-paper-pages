'use strict';
// Cornell notes stay where they belong: every letter of the notes in the notes column and every
// letter of a cue in the cue column, inside a page's writing area (never in a footer, a header or
// the gap between two sheets), also when long notes, long cues and tables run over many pages.
// Taking the pages away again (as before every new layout) restores the note exactly.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { openReading, closeBrowsers } = require('./lib/harness');
const { callout, title } = require('./lib/notes');

after(closeBrowsers);

const W = 'lorem ipsum dolor sit amet consectetur'.split(' ');
const words = (n) => Array.from({ length: n }, (_, i) => W[i % W.length] + i).join(' ');
const group = (cue, notes) => `<div><blockquote>${callout('cue', 'Cue', cue)}${callout('notes', 'Notes', notes)}</blockquote></div>`;
const table = (rows) => '<table>' + Array.from({ length: rows }, (_, i) => `<tr><td>row ${i}</td><td>x</td></tr>`).join('') + '</table>';
const longNote = {
  name: 'containment',
  cornell: true,
  blocks: [
    title('Title'),
    group('<p>short cue</p>', `<p>${words(60)}</p>`),
    group(`<p>tall cue ${words(150)}</p>`, `<p>${words(400)}</p><ul>${Array.from({ length: 30 }, (_, i) => `<li>item ${i} ${words(8)}</li>`).join('')}</ul>`),
    group('<p>table first</p>', table(20) + `<p>${words(500)}</p>`),
    `<div>${callout('notes', 'Notes', `<p>lone ${words(400)}</p>`)}</div>`,
    `<div><blockquote>${callout('notes', 'Notes', `<p>nested-lone ${words(200)} https://example.com/${'a'.repeat(200)}</p>`)}</blockquote></div>`,
  ],
};

function check() {
  const view = document.querySelector('.markdown-preview-view');
  const sizer = view.querySelector('.markdown-preview-sizer');
  const px = (e) => { const d = document.createElement('div'); d.style.cssText = 'position:absolute;height:' + e; view.appendChild(d); const h = d.getBoundingClientRect().height; d.remove(); return h; };
  const L = px('var(--line)'), B = Math.round(px('calc(var(--bar-lines) * 1px)')), N = Math.round(px('calc(var(--body-rows) * 1px)')), P = px('var(--page-h)');
  const page = sizer.getBoundingClientRect();
  const padX = parseFloat(getComputedStyle(sizer).paddingLeft);
  const divider = page.left + padX + (page.width - 2 * padX) * 0.3;
  const problems = new Set();
  let letters = 0;
  const range = document.createRange();
  for (const type of ['notes', 'cue']) {
    for (const c of sizer.querySelectorAll(`.callout[data-callout="${type}"]`)) {
      const box = c.getBoundingClientRect();
      const tw = document.createTreeWalker(c.querySelector('.callout-content'), NodeFilter.SHOW_TEXT);
      for (let n = tw.nextNode(); n; n = tw.nextNode()) {
        for (let i = 0; i < n.data.length; i++) {
          if (/\s/.test(n.data[i])) continue;
          range.setStart(n, i); range.setEnd(n, i + 1);
          const r = range.getClientRects()[0];
          if (!r || !r.width) continue;
          letters++;
          const y = (r.top + r.bottom) / 2 - page.top, k = Math.floor(y / P);
          const from = k === 0 ? 0 : k * P + (B + 1) * L, to = k * P + (B + N) * L;
          const shown = !(r.right <= box.left || r.left >= box.right);   // (not clipped away)
          if (shown && (y < from || y > to)) problems.add(`${type} text outside the writing area of sheet ${k + 1}`);
          if (type === 'notes' && r.left < box.left - 0.5) problems.add('notes text left of the notes column');
        }
      }
      if (type === 'notes') {
        if (box.left + parseFloat(getComputedStyle(c).paddingLeft) < divider) problems.add('notes box over the cue column');
        if (box.right > page.right + 0.5) problems.add('notes box past the page edge');
      }
    }
  }
  return { paged: view.classList.contains('lp-paged'), sheets: sizer.querySelectorAll('.lp-sheet').length, letters, problems: [...problems] };
}

for (const [mode, cssPaging] of [['plugin pagination', false], ['CSS pagination', true]]) {
  test(`notes and cues stay in their columns and in the writing area (${mode})`, async (t) => {
    const { page, context } = await openReading(longNote, { cssPaging, viewport: { width: 1100, height: 900 } });
    if (!page) return t.skip(`${mode} is not available in this browser`);
    try {
      await page.waitForTimeout(700);
      const r = await page.evaluate(check);
      assert.ok(r.paged, 'laid out as pages');
      assert.ok(r.sheets >= 10, `${r.sheets} sheets`);
      assert.ok(r.letters > 10000, `${r.letters} letters checked`);
      assert.deepEqual(r.problems, []);
      assert.deepEqual(page.errors, []);
      if (!cssPaging) {
        // taking the pages away restores the note (the page shadows and labels stay: they follow the height)
        const undone = await page.evaluate(() => {
          const view = document.querySelector('.markdown-preview-view');
          window.plugin.undoAll(window.plugin.states.get(view));
          return { notes: document.querySelectorAll('.callout[data-callout="notes"]').length, blocks: view.querySelector('.markdown-preview-sizer').querySelectorAll(':scope > div:not(.markdown-preview-pusher, .mod-header, .mod-footer, .lp-sheet, .lp-hdr)').length };
        });
        assert.deepEqual(undone, { notes: 5, blocks: 6 });
      }
    } finally {
      await context.close();
    }
  });
}
