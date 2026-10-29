'use strict';
// Scrolling a long note in reading view: nothing moves, nothing is added or taken away, the scroll
// position is never reset, and the pages are never laid out again while scrolling.
//
// Obsidian builds a long note "virtually": only the sections near the screen are on the page.
// The stand-in renderer below behaves like that: it builds a section the first time it comes
// near the screen, takes far ones off the page (a spacer keeps their room), remembers the scroll
// position, scrolls back to the position it worked with, and restores it again a moment later.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { openReading, closeBrowsers } = require('./lib/harness');
const { group, title, block, callout } = require('./lib/notes');

after(closeBrowsers);

const longNote = {
  name: 'long',
  cornell: true,
  blocks: [
    title('Long'),
    ...Array.from({ length: 45 }, (_, i) => group(`<p>cue ${i}</p>`, `<p>${`note ${i} alpha beta gamma delta epsilon zeta eta theta iota kappa `.repeat(1 + (i % 3))}</p>`)),
    block(callout('summary', 'Summary', '<p>sum</p>')),
  ],
};

// the same with headings: `## Heading`s between the groups, and a `# Title` (a new page) now and then
const headedNote = {
  name: 'headed',
  cornell: true,
  blocks: [
    title('Long'),
    ...Array.from({ length: 45 }, (_, i) => [
      ...(i && i % 15 === 0 ? [title(`Part ${i / 15}`), block(callout('question', 'Question', `<p>Q ${i}?</p>`))] : []),
      ...(i % 5 === 2 ? [`<div class="el-h2"><h2>Heading ${i}</h2></div>`] : []),
      group(`<p>cue ${i}</p>`, `<p>${`note ${i} alpha beta gamma delta epsilon zeta eta theta iota kappa `.repeat(1 + (i % 3))}</p>`),
    ]).flat(),
    block(callout('summary', 'Summary', '<p>sum</p>')),
  ],
};

// installs the stand-in renderer and hands it to the plugin
function virtualReadingView({ margin, strict, start }) {
  const pv = document.querySelector('.markdown-preview-view');
  pv.style.cssText += ';overflow:auto;height:100vh';
  pv.parentElement.style.overflow = 'visible';
  const sizer = pv.querySelector('.markdown-preview-sizer');
  const pusher = sizer.querySelector('.markdown-preview-pusher');
  // undo the first layout, then turn the blocks into sections that are not built yet
  window.plugin.undoAll(window.plugin.states.get(pv));
  const blocks = [...sizer.children].filter((b) => !b.matches('.markdown-preview-pusher, .mod-header, .mod-footer, .lp-sheet, .lp-hdr'));
  const sections = blocks.map((b) => { const el = document.createElement('div'); el.className = b.className; const html = b.innerHTML; b.remove(); return { el, html, height: 0, computed: false, rendered: false }; });
  window.layouts = 0;
  const layout = window.plugin.layout.bind(window.plugin);
  window.plugin.layout = (...a) => { window.layouts++; return layout(...a); };
  const renderer = {
    previewEl: pv, sizerEl: sizer, pusherEl: pusher, sections, lastScroll: 0,
    updateVirtualDisplay(scrollTop) {
      if (scrollTop === undefined) scrollTop = this.previewEl.scrollTop;
      this.lastScroll = scrollTop;
      const vh = this.previewEl.clientHeight;
      for (const s of sections) if (s.el.isConnected) { s.height = s.el.getBoundingClientRect().height; s.computed = true; }
      const lo = margin === 'fixed' ? scrollTop - 800 : scrollTop - vh;
      const hi = margin === 'fixed' ? scrollTop + vh + 800 : scrollTop + 2 * vh;
      let y = 0, pushed = -1;
      const show = sections.filter((s) => { const h = s.computed ? s.height : 60; const on = y + h >= lo && y <= hi; if (on && pushed < 0) pushed = y; y += h; return on; });
      for (const s of sections) if (!show.includes(s) && s.el.isConnected) s.el.remove();
      let prev = sizer.querySelector('.mod-header');
      for (const s of show) {
        if (!s.rendered) { s.el.innerHTML = s.html; s.rendered = true; }
        if (strict ? prev.nextSibling !== s.el : !s.el.isConnected) prev.after(s.el);
        prev = s.el;
      }
      pusher.style.marginBottom = Math.max(0, pushed) + 'px';
      this.previewEl.scrollTop = scrollTop;                                       // keeps the scroll it worked with
      setTimeout(() => { this.previewEl.scrollTop = this.lastScroll; }, 50);     // ... and restores it again later
    },
  };
  pv.addEventListener('scroll', () => renderer.updateVirtualDisplay());
  pv.scrollTop = start;
  renderer.updateVirtualDisplay();
  window.plugin.app.workspace.getLeavesOfType = () => [{ view: { previewMode: { renderer } } }];
  window.renderer = renderer;
  window.plugin.scan(true);
}

const state = () => {
  const pv = document.querySelector('.markdown-preview-view');
  const probe = document.elementFromPoint(500, pv.getBoundingClientRect().top + 200);
  const p = probe && probe.closest('p');
  return {
    top: pv.scrollTop,
    sheets: document.querySelectorAll('.lp-sheet').length,
    sections: window.renderer.sections.filter((s) => s.el.isConnected).length,
    onScreen: p ? `${p.textContent.slice(0, 20)}@${Math.round(p.getBoundingClientRect().top)}` : '',
  };
};

async function scrollThrough(page) {
  const height = await page.evaluate(() => document.querySelector('.markdown-preview-view').scrollHeight);
  const stops = [];
  for (let y = 0; y <= height; y += 400) stops.push(y);
  for (let y = height - 400; y >= 0; y -= 700) stops.push(y);
  const seen = { resets: 0, moved: 0, sheets: new Set(), sections: new Set() };
  for (const y of stops) {
    const want = await page.evaluate((y) => { const pv = document.querySelector('.markdown-preview-view'); pv.scrollTop = y; const t = pv.scrollTop; pv.dispatchEvent(new Event('scroll')); return t; }, y);
    const now = await page.evaluate(state);
    await page.waitForTimeout(300);
    const later = await page.evaluate(state);
    if (Math.abs(later.top - want) > 1) seen.resets++;
    if (later.onScreen !== now.onScreen) seen.moved++;
    seen.sheets.add(later.sheets);
    seen.sections.add(later.sections);
  }
  return seen;
}

for (const [what, note] of [['a long note', longNote], ['a long note with headings and titles', headedNote]]) {
for (const margin of ['vh', 'fixed']) {
  for (const strict of [false, true]) {
    for (const start of [0, 3000]) {
      test(`scrolling ${what}: Obsidian keeps ${margin === 'vh' ? 'one screen' : '800 px'} around the screen${strict ? ', re-attaches sections' : ''}, opened at ${start}px`, async () => {
        const { page, context } = await openReading(note, { viewport: { width: 1000, height: 800 } });
        try {
          await page.evaluate(virtualReadingView, { margin, strict, start });
          await page.waitForTimeout(800);
          await page.evaluate(() => { window.layouts = 0; });
          const seen = await scrollThrough(page);
          assert.equal(seen.resets, 0, 'the scroll position was reset');
          assert.equal(seen.moved, 0, 'text on screen moved after a scroll');
          assert.equal(seen.sections.size, 1, 'sections were added or taken away');
          assert.equal(seen.sheets.size, 1, 'the number of pages changed');
          assert.equal(await page.evaluate(() => window.layouts), 0, 'the pages were laid out again while scrolling');
          // nothing of the plugin's between Obsidian's blocks (its renderer counts on the order of
          // its sections: an element put in between made it jump back to the top)
          const foreign = await page.evaluate(() => {
            const own = new Set(window.renderer.sections.map((s) => s.el));
            return [...window.renderer.sizerEl.children].filter((c) => !own.has(c) && !c.matches('.markdown-preview-pusher, .mod-header, .mod-footer, .lp-sheet, .lp-hdr, .lp-cont')).map((c) => c.className);
          });
          assert.deepEqual(foreign, [], 'the plugin put elements between the sections');
          // jumping to a heading: Obsidian scrolls there itself, then updates
          const jumped = await page.evaluate(async () => {
            const pv = document.querySelector('.markdown-preview-view');
            const target = Math.round(pv.scrollHeight / 2);
            pv.scrollTop = target; window.renderer.updateVirtualDisplay(target);
            await new Promise((r) => setTimeout(r, 300));
            return Math.abs(pv.scrollTop - target) <= 1;
          });
          assert.ok(jumped, 'jumping to a heading did not stay there');
          assert.deepEqual(page.errors, []);
        } finally {
          await context.close();
        }
      });
    }
  }
}
}

test('a change made while scrolling is laid out once, after scrolling stops', async () => {
  const { page, context } = await openReading(longNote, { viewport: { width: 1000, height: 800 } });
  try {
    await page.evaluate(virtualReadingView, { margin: 'fixed', strict: false, start: 0 });
    await page.waitForTimeout(800);
    const before = await page.evaluate(() => { window.layoutTimes = []; const l = window.plugin.layout; window.plugin.layout = (...a) => { window.layoutTimes.push(performance.now()); return l(...a); }; window.scrolls = []; document.querySelector('.markdown-preview-view').addEventListener('scroll', () => window.scrolls.push(performance.now())); return document.querySelectorAll('.lp-sheet').length; });
    await page.mouse.move(500, 400);
    for (let i = 0; i < 25; i++) {
      await page.mouse.wheel(0, 300);
      await page.waitForTimeout(30);
      if (i === 5) {
        await page.evaluate(() => {
          const d = document.createElement('div');
          d.className = 'el-blockquote';
          d.innerHTML = '<blockquote><div class="callout" data-callout="cue"><div class="callout-content"><p>NEW cue</p></div></div><p></p><div class="callout" data-callout="notes"><div class="callout-content"><p>' + 'NEW notes alpha beta gamma delta '.repeat(60) + '</p></div></div></blockquote>';
          document.querySelector('.mod-footer').before(d);
        });
      }
    }
    await page.waitForTimeout(1200);
    const r = await page.evaluate(() => {
      const last = Math.max(...window.scrolls);
      return { sheets: document.querySelectorAll('.lp-sheet').length, layouts: window.layoutTimes.length, early: window.layoutTimes.filter((t) => t < last + 250).length };
    });
    assert.equal(r.layouts, 1, 'laid out exactly once');
    assert.equal(r.early, 0, 'not while scrolling');
    assert.equal(r.sheets, before + 1, 'the new block got its page');
  } finally {
    await context.close();
  }
});

// The page shadows and the Cues | Notes labels of sheets 2, 3 ... follow the note at once: they are
// there before the first layout, a page added while scrolling has its labels in the next frame
// (while the layout itself waits until scrolling stops), and a layout never takes them away
for (const cssPaging of [false, true]) {
  test(`page labels appear with their page, without waiting for a layout (${cssPaging ? 'CSS' : 'plugin'} pagination)`, async (t) => {
    const { page, context } = await openReading(longNote, { cssPaging, viewport: { width: 1000, height: 800 } });
    if (!page) return t.skip('this pagination mode is not available in this browser');
    try {
      const furniture = () => page.evaluate(() => {
        const P = parseFloat(getComputedStyle(document.querySelector('.lp-sheet:nth-of-type(2)') || document.body).top) || 0;
        return { sheets: document.querySelectorAll('.lp-sheet').length, labels: document.querySelectorAll('.lp-hdr').length, P };
      });
      const f = await furniture();
      assert.ok(f.sheets >= 5, `${f.sheets} sheets`);
      assert.equal(f.labels, f.sheets - 1, 'every sheet after the first has its labels');

      // a layout keeps them (no label is taken away)
      const removed = await page.evaluate(async () => {
        let n = 0;
        const mo = new MutationObserver((recs) => { for (const r of recs) for (const x of r.removedNodes) if (x.nodeType === 1 && x.matches('.lp-hdr, .lp-sheet')) n++; });
        mo.observe(document.querySelector('.markdown-preview-sizer'), { childList: true });
        const view = document.querySelector('.markdown-preview-view');
        window.plugin.layout(view, window.plugin.states.get(view));
        await new Promise((r) => setTimeout(r, 100));
        mo.disconnect();
        return n;
      });
      assert.equal(removed, 0, 'a layout took labels away');

      // while scrolling, a change that adds a page: its labels are there in the next frame
      const r = await page.evaluate(async () => {
        const view = document.querySelector('.markdown-preview-view');
        view.style.cssText += ';overflow:auto;height:100vh';
        let layouts = 0;
        const layout = window.plugin.layout.bind(window.plugin);
        window.plugin.layout = (...a) => { layouts++; return layout(...a); };
        const before = document.querySelectorAll('.lp-hdr').length;
        view.scrollTop = 500; view.dispatchEvent(new Event('scroll'));   // (scrolling: no layout now)
        const d = document.createElement('div');
        d.innerHTML = '<blockquote><div class="callout" data-callout="cue"><div class="callout-content"><p>NEW</p></div></div><div class="callout" data-callout="notes"><div class="callout-content"><p>' + 'NEW notes alpha beta gamma delta '.repeat(150) + '</p></div></div></blockquote>';
        document.querySelector('.mod-footer').before(d);
        await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
        const next = { after: document.querySelectorAll('.lp-hdr').length, sheets: document.querySelectorAll('.lp-sheet').length, layouts };
        // (scrolling stops: the layout runs)
        await new Promise((res) => setTimeout(res, 900));
        return { before, next, settled: { after: document.querySelectorAll('.lp-hdr').length, sheets: document.querySelectorAll('.lp-sheet').length, layouts } };
      });
      assert.equal(r.next.layouts, 0, 'no layout yet (still scrolling)');
      if (cssPaging) {
        // the browser makes the pages: the new page and its labels are there in the next frame
        assert.ok(r.next.after > r.before, `labels for the new page: ${r.before} → ${r.next.after}`);
        assert.equal(r.next.after, r.next.sheets - 1);
      } else {
        // the plugin makes the pages: the new page (and its labels) come with the layout, once scrolling stops
        assert.equal(r.settled.layouts, 1);
        assert.ok(r.settled.after > r.before, `labels for the new page: ${r.before} → ${r.settled.after}`);
      }
      assert.equal(r.settled.after, r.settled.sheets - 1);
      assert.deepEqual(page.errors, []);
    } finally {
      await context.close();
    }
  });
}

// Opening a long note whose `# Title`s start new pages, as Obsidian builds it (a piece at a time,
// near the screen first): every page is there and laid out, each title at the top of its page,
// exactly as when the whole note is on the page at once
for (const start of [0, 3000]) {
  for (const [margin, strict] of [['vh', false], ['fixed', false], ['vh', true], ['fixed', true]]) {
    test(`a note with titles starting new pages is laid out in full when it opens (${margin}${strict ? ', re-attaches sections' : ''}, at ${start}px)`, async () => {
      const measure = () => {
        const sizer = document.querySelector('.markdown-preview-sizer');
        const top = sizer.getBoundingClientRect().top;
        const d = document.createElement('div'); d.style.cssText = 'position:absolute;height:var(--page-h)'; sizer.appendChild(d);
        const P = d.getBoundingClientRect().height; d.remove();
        return {
          sheets: document.querySelectorAll('.lp-sheet').length,
          titles: [...document.querySelectorAll('h1')].map((h) => { const y = h.getBoundingClientRect().top - top; return `${h.textContent.trim()} p${Math.floor((y + 1) / P) + 1} ${Math.round(y - Math.floor((y + 1) / P) * P)}`; }),
        };
      };
      const full = await openReading(headedNote, { viewport: { width: 1000, height: 800 } });
      let expected;
      try { await full.page.waitForTimeout(500); expected = await full.page.evaluate(measure); } finally { await full.context.close(); }
      const { page, context } = await openReading(headedNote, { viewport: { width: 1000, height: 800 } });
      try {
        await page.evaluate(virtualReadingView, { margin, strict, start });
        await page.waitForTimeout(900);
        const got = await page.evaluate(() => { const pv = document.querySelector('.markdown-preview-view'); pv.scrollTop = 0; return true; }).then(() => page.waitForTimeout(400)).then(() => page.evaluate(measure));
        assert.deepEqual(got, expected);
        assert.ok(expected.titles.slice(1).every((t) => / 0$| -?[0-9]$/.test(t)), 'each title at the top of its page: ' + expected.titles);
        assert.deepEqual(page.errors, []);
      } finally {
        await context.close();
      }
    });
  }
}
