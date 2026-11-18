'use strict';
// Revision and AI: reviewing cue cards (spaced repetition), questions drafted from notes, a summary
// from the cues, diagrams from a list or from an AI (Gemini, or pasted from NotebookLM), a topic's
// index, the cards of a folder, the highlighted words blanked out in review, and a diagram on a
// lined page (the writing after it on the lines).
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { openReading, closeBrowsers } = require('./lib/harness');
const { SRC, FAKES } = require('./lib/fakes');
const { title, block } = require('./lib/notes');

after(closeBrowsers);

const open = async (theme = 'theme-light') => {
  const { page, context } = await openReading({ name: 'study', cornell: true, blocks: [] }, { theme, src: SRC });
  await page.evaluate(FAKES);
  return { page, context };
};
const NOTE = '---\ncssclasses:\n  - lined-paper\n  - cornell\n---\n# Beginning of Life\n>> [!cue]\n>> When does Judaism hold life begins?\n>\n>> [!notes]\n>> - at ==birth==\n>> - the foetus is "water" until 40 days\n\n>> [!cue]\n>> Christianity view\n>\n>> [!notes]\n>> - life begins at ==conception==\n>> - Catholics oppose abortion because life is sacred\n\n>> [!cue]\n>> What do biologists say?\n>\n>> [!notes]\n>> From <mark class="hl-green">fertilisation</mark>.\n';

test('review: the cards due, one at a time; known ones come back later, the others again at the end; the next day, only the ones due', async () => {
  const { page, context } = await open();
  try {
    const r = await page.evaluate(async (NOTE) => {
      const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
      const plugin = window.plugin;
      const { vault } = window.makeVault(plugin, { 'RS/Life.md': NOTE, 'RS/Other.md': '>> [!cue]\n>> What is IVF?\n>\n>> [!notes]\n>> Fertilisation outside the body.\n' });
      await plugin.reviewCards('note', vault.files['RS/Life.md']);
      await wait(150);
      const m = document.querySelector('.lp-review-modal');
      document.querySelector('.lp-rv-check input').click;   // (only due: on)
      const [, mix] = m.querySelectorAll('.lp-rv-check input');
      mix.checked = false; mix.dispatchEvent(new Event('change'));
      await wait(200);
      const front = () => { const c = m.querySelector('.lp-deck-card'); const cell = [...c.querySelectorAll('.lp-card-cell')].find((x) => getComputedStyle(x).display !== 'none'); return cell.querySelector('.lp-card-text').textContent.trim(); };
      const btn = (t) => [...m.querySelectorAll('.lp-rv-controls button')].find((b) => b.textContent.includes(t));
      const seen = [];
      seen.push(m.querySelector('.lp-rv-info').textContent, front());
      btn('Show the answer').click(); await wait(50);
      seen.push(front());
      btn('Knew it').click(); await wait(150);
      seen.push(front());
      m.contentEl === undefined;
      m.querySelector('.lp-rv-stage .lp-deck-card').dispatchEvent(new MouseEvent('click', { bubbles: true }));   // (a click on the card: the answer)
      await wait(50);
      btn('Didn\'t know').click(); await wait(150);
      seen.push(m.querySelector('.lp-rv-info').textContent, front());   // (the one not known: again, at the end)
      btn('Show the answer').click(); await wait(30); btn('Knew it').click(); await wait(150);
      seen.push(m.querySelector('.lp-rv-done').textContent);
      const srs = JSON.parse(JSON.stringify(plugin.settings._srs));
      plugin._review.modal.close();
      // the folder, every card not yet known: the other note's card is due, the known ones are not
      await plugin.reviewCards('folder', vault.files['RS/Life.md']);
      await wait(250);
      const m2 = [...document.querySelectorAll('.lp-review-modal')].pop();
      const info2 = m2.querySelector('.lp-rv-info').textContent;
      plugin._review.modal.close();
      return { seen, boxes: Object.values(srs).map((x) => x.box).sort(), info2 };
    }, NOTE);
    assert.deepEqual([r.seen[0], r.seen[1], r.seen[3], r.seen[4], r.seen[5]], ['Card 1 of 2 · knew 0, again 0', 'When does Judaism hold life begins?', 'What do biologists say?', 'Card 3 of 3 · knew 1, again 1', 'What do biologists say?']);
    assert.match(r.seen[6], /^Done: you knew 2 of 3\.Next cards due: \d{4}-\d\d-\d\d\.$/);
    assert.match(r.seen[2], /at ==birth==/, 'the answer, on the back');
    assert.deepEqual(r.boxes, [1, 1], 'two cards known (box 1: tomorrow); "Christianity view" is not a card');
    assert.equal(r.info2, 'Card 1 of 1 · knew 0, again 0', 'in the folder: only the card not seen yet is due today');
  } finally {
    await context.close();
  }
});

test('review: a quote with words left out to fill in', async () => {
  const { page, context } = await open();
  try {
    const front = await page.evaluate(async () => {
      const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
      const plugin = window.plugin;
      const { vault } = window.makeVault(plugin, { 'Quotes/Catechism.md': '---\nformat: quote\n---\n> [!quote] Catechism 2270\n> Human life must be respected and protected absolutely\n\n^quote\n' });
      await plugin.reviewCards('note', vault.files['Quotes/Catechism.md']);
      await wait(150);
      const m = document.querySelector('.lp-review-modal');
      const gaps = m.querySelectorAll('.lp-rv-check input')[2];
      gaps.checked = true; gaps.dispatchEvent(new Event('change'));
      await wait(200);
      const t = m.querySelector('.lp-deck-card .lp-front .lp-card-text').textContent.replace(/\s+/g, ' ').trim();
      plugin._review.modal.close();
      return t;
    });
    assert.match(front, /^Catechism 2270 Human (\\_){4} must be respected and (\\_){8} absolutely$/);
  } finally {
    await context.close();
  }
});

test('a cue for the selected notes: in a group\'s first notes, its cue; later in the notes, a group of its own; the question selected to change', async () => {
  const { page, context } = await open();
  try {
    const r = await page.evaluate((NOTE) => {
      const plugin = window.plugin;
      const lines = NOTE.split('\n');
      const at = (s) => lines.findIndex((l) => l.includes(s));
      // later in the notes: "Catholics oppose …"
      let l = at('Catholics oppose');
      let e = window.makeEditor(NOTE, { line: l, ch: 5 }, { line: l, ch: lines[l].length });
      plugin.cueFromSelection(e);
      const split = e.text, picked = e.getSelection();
      // the first lines of an empty cue's notes
      const empty = '>> [!cue]\n>> \n>\n>> [!notes]\n>> IVF is fertilisation outside the body.\n';
      e = window.makeEditor(empty, { line: 4, ch: 3 }, { line: 4, ch: 41 });
      plugin.cueFromSelection(e);
      return { split, picked, filled: e.text };
    }, NOTE);
    assert.ok(r.split.includes('>> - life begins at ==conception==\n\n>> [!cue]\n>> Why catholics oppose abortion?\n>\n>> [!notes]\n>> - Catholics oppose abortion because life is sacred\n\n>> [!cue]\n>> What do biologists say?'), r.split);
    assert.equal(r.picked, 'Why catholics oppose abortion?');
    assert.equal(r.filled, '>> [!cue]\n>> What is IVF?\n>\n>> [!notes]\n>> IVF is fertilisation outside the body.\n');
  } finally {
    await context.close();
  }
});

test('a summary from the cues and the words highlighted in their notes', async () => {
  const { page, context } = await open();
  try {
    const text = await page.evaluate((NOTE) => {
      const e = window.makeEditor(NOTE + '\n', { line: NOTE.split('\n').length, ch: 0 });
      window.plugin.summaryFromCues(e);
      return e.text.slice(NOTE.length);
    }, NOTE);
    assert.equal(text, '\n>> [!summary] Summary\n>> - **When does Judaism hold life begins?**: birth\n>> - **Christianity view**: conception\n>> - **What do biologists say?**: fertilisation\n>> In my own words: \n');
  } finally {
    await context.close();
  }
});

test('a diagram from the selected list: chosen, previewed, inserted under the list inside its callout', async () => {
  const { page, context } = await open();
  try {
    const r = await page.evaluate(async (NOTE) => {
      const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
      const lines = NOTE.split('\n');
      const a = lines.findIndex((l) => l.includes('life begins at')), b = lines.findIndex((l) => l.includes('Catholics oppose'));
      const e = window.makeEditor(NOTE, { line: a, ch: 0 }, { line: b, ch: lines[b].length });
      window.plugin.insertDiagram(e);
      await wait(50);
      const m = document.querySelector('.lp-diagram-modal');
      const sel = m.querySelector('select');
      sel.value = 'flow'; sel.dispatchEvent(new Event('change'));
      await wait(50);
      const title = m.querySelector('input').value;
      m.querySelector('button.mod-cta').click();
      return { title, text: e.text };
    }, NOTE);
    assert.equal(r.title, 'Beginning of Life', 'named by the heading above');
    assert.ok(r.text.includes('>> - Catholics oppose abortion because life is sacred\n>>\n>> ```mermaid\n>> flowchart LR\n>>     n0("life begins at conception")\n>>     n1("Catholics oppose abortion because life is sacred")\n>>     n0 --> n1\n>> ```\n\n>> [!cue]\n>> What do biologists say?'), r.text);
  } finally {
    await context.close();
  }
});

test('ask AI: Gemini asked (the model retired: the newest Flash one taken), the diagram read from its reply and inserted; practice questions added as cues; NotebookLM: copied, the answer pasted back', async () => {
  const { page, context } = await open();
  try {
    const r = await page.evaluate(async (NOTE) => {
      const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
      const plugin = window.plugin;
      plugin.settings['ai-key'] = 'test-key';
      const asked = [];
      window.__request = async (o) => {
        asked.push(o.url.replace(/^https:\/\/generativelanguage\.googleapis\.com\/v1beta/, '') + ' ' + (o.headers && o.headers['x-goog-api-key']));
        if (/gemini-2\.5-flash:generateContent/.test(o.url)) return { status: 404, body: { error: { message: 'models/gemini-2.5-flash is not found' } } };
        if (/\/models\?/.test(o.url)) return { body: { models: [{ name: 'models/gemini-3-flash', supportedGenerationMethods: ['generateContent'] }, { name: 'models/gemini-3-flash-lite', supportedGenerationMethods: ['generateContent'] }, { name: 'models/embedding-001', supportedGenerationMethods: ['embedContent'] }] } };
        const prompt = JSON.parse(o.body).contents[0].parts[0].text;
        return { body: { candidates: [{ content: { parts: [{ text: /flowchart/.test(prompt) && /Topic: when life begins/.test(prompt) && /Beginning of Life/.test(prompt) ? 'Sure!\n```mermaid\nflowchart TD\n  a["Conception"] --> b["Birth"]\n```' : '?' }] } }] } };
      };
      const lines = NOTE.split('\n');
      const l = lines.findIndex((x) => x.includes('until 40 days'));
      const e = window.makeEditor(NOTE, { line: l, ch: 3 }, { line: l, ch: lines[l].length });
      plugin.askAI(e, { basename: 'Life' });
      const m = document.querySelector('.lp-ai-modal');
      const kind = m.querySelector('.lp-ai-kind'); kind.value = 'flow';
      m.querySelector('.lp-ai-topic').value = 'when life begins';
      [...m.querySelectorAll('button')].find((b) => b.textContent === 'Ask Gemini').click();
      for (let i = 0; i < 40 && m.querySelector('.lp-ai-foot button').disabled; i++) await wait(25);
      const status = m.querySelector('.lp-ai-status').textContent;
      m.querySelector('.lp-ai-foot button').click();
      const diagram = e.text;
      // NotebookLM: copied, the answer pasted back
      let copied = '';
      try { Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t) => { copied = t; } }, configurable: true }); } catch (err) { /* */ }
      window.open = () => null;
      const e2 = window.makeEditor(NOTE, { line: l, ch: 3 });
      plugin.askAI(e2, { basename: 'Life' });
      const m2 = [...document.querySelectorAll('.lp-ai-modal')].pop();
      m2.querySelector('.lp-ai-kind').value = 'questions';
      [...m2.querySelectorAll('button')].find((b) => b.textContent.startsWith('Copy for NotebookLM')).click();
      await wait(50);
      const paste = m2.querySelector('.lp-ai-paste');
      paste.value = 'Q: What is the Jewish view on when life begins?\nA: At birth: until 40 days the foetus is "water".\n\nQ: Why do Catholics oppose abortion?\nA: Life is sacred from conception.';
      paste.dispatchEvent(new Event('input'));
      await wait(100);
      m2.querySelector('.lp-ai-foot button').click();
      return { asked, status, diagram, copied, questions: e2.text };
    }, NOTE);
    assert.deepEqual(r.asked, ['/models/gemini-2.5-flash:generateContent test-key', '/models?pageSize=200 test-key', '/models/gemini-3-flash:generateContent test-key']);
    assert.match(r.status, /^Here it is/);
    assert.ok(r.diagram.includes('>> - the foetus is "water" until 40 days\n>>\n>> ```mermaid\n>> flowchart TD\n>>   a["Conception"] --> b["Birth"]\n>> ```\n\n>> [!cue]\n>> Christianity view'), r.diagram);
    assert.match(r.copied, /^Write 5 exam-style practice questions[\s\S]*Beginning of Life/);
    assert.ok(r.questions.includes('>> - the foetus is "water" until 40 days\n\n>> [!cue]\n>> What is the Jewish view on when life begins?\n>\n>> [!notes]\n>> At birth: until 40 days the foetus is "water".\n\n>> [!cue]\n>> Why do Catholics oppose abortion?\n>\n>> [!notes]\n>> Life is sacred from conception.\n\n>> [!cue]\n>> Christianity view'), r.questions);
  } finally {
    await context.close();
  }
});

test('a topic\'s index: its notes, the definitions and quotes they use; kept up to date; the cue cards of the whole folder on one page', async () => {
  const { page, context } = await open();
  try {
    const r = await page.evaluate(async (NOTE) => {
      const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
      const plugin = window.plugin;
      const { vault } = window.makeVault(plugin, {
        'RS/Life/Beginning of Life.md': NOTE.replace('>> From <mark', '>> ![[foetus#^def]] From <mark'),
        'RS/Life/IVF.md': '>> [!cue]\n>> What is IVF?\n>\n>> [!notes]\n>> Fertilisation outside the body.\n',
        'Definitions/foetus.md': '---\nformat: def\n---\n> [!info] foetus\n> An unborn baby from eight weeks.\n\n^def\n',
      });
      await plugin.writeTopicIndex('RS/Life');
      const first = vault.files['RS/Life/Life index.md'].text;
      vault.files['RS/Life/IVF.md'].text += '\n>> [!cue]\n>> Who opposes IVF?\n>\n>> [!notes]\n>> Catholics.\n';
      await plugin.writeTopicIndex('RS/Life');
      const second = vault.files['RS/Life/Life index.md'].text;
      await plugin.folderCueCards(vault.files['RS/Life/IVF.md']);
      const deck = vault.files['Cue cards/Life cue cards.md'].text;
      return { first, second, deck: window.plugin.constructor.parseCueBlock(/```cuecards\n([\s\S]*?)\n```/.exec(deck)[1]).cards.map((c) => c.h + ': ' + c.q) };
    }, NOTE);
    assert.equal(r.first, '---\nformat: index\ncssclasses:\n  - lp-index\n---\n# RS/Life\n\n## Notes\n\n- [[RS/Life/Beginning of Life|Beginning of Life]] · 2 questions\n- [[RS/Life/IVF|IVF]] · 1 question\n\n## Definitions\n\n- **[[Definitions/foetus|foetus]]**: An unborn baby from eight weeks.\n');
    assert.match(r.second, /\[\[RS\/Life\/IVF\|IVF\]\] · 2 questions/);
    assert.deepEqual(r.deck, ['Beginning of Life: When does Judaism hold life begins?', 'Beginning of Life: What do biologists say?', 'Definitions: foetus', 'IVF: What is IVF?', 'IVF: Who opposes IVF?']);
  } finally {
    await context.close();
  }
});

test('review (fill the gaps): the highlighted words hidden on the page, the highlighter\'s stroke kept; a click shows one', async () => {
  const { page, context } = await openReading({ name: 'blanks', cornell: false, blocks: [title('Life'), block('<p>Life begins at <mark>birth</mark> in Judaism.</p>')] }, { theme: 'theme-dark lp-review-blanks' });
  try {
    const r = await page.evaluate(() => {
      const view = document.querySelector('.markdown-preview-view');
      view.classList.add('lp-review');
      const mark = view.querySelector('mark');
      const before = [getComputedStyle(mark).color, getComputedStyle(mark).backgroundImage !== 'none'];
      window.plugin.onReviewClick({ target: mark, preventDefault() {}, stopPropagation() {} });
      return { before, after: getComputedStyle(mark).color, words: getComputedStyle(view.querySelector('p')).color };
    });
    assert.deepEqual(r.before, ['rgba(0, 0, 0, 0)', true], 'the word hidden, its highlight showing');
    assert.equal(r.after, r.words, 'shown, after a click');
  } finally {
    await context.close();
  }
});

test('a diagram on a lined page: the writing after it starts on a ruled line', async () => {
  const { page, context } = await openReading({ name: 'mermaid', cornell: false, blocks: [title('Life'), block('<p>Above the diagram.</p>'), '<div class="el-pre"><div class="block-language-mermaid"><svg width="300" height="137" style="display:block"></svg></div></div>', block('<p>Under the diagram.</p>')] }, { theme: 'theme-light' });
  try {
    await page.waitForTimeout(400);
    const r = await page.evaluate(() => {
      const ps = document.querySelectorAll('.markdown-preview-view p');
      const L = parseFloat(getComputedStyle(ps[0]).lineHeight);
      const off = (ps[1].getBoundingClientRect().top - ps[0].getBoundingClientRect().top) / L;
      return { off: Math.round(off * 1000) / 1000, pushed: !!document.querySelector('.block-language-mermaid')._lpPush };
    });
    assert.ok(r.pushed, 'measured');
    assert.equal(r.off % 1, 0, 'a whole number of lines below the writing above: ' + r.off);
  } finally {
    await context.close();
  }
});
