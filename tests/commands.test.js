'use strict';
// The commands: making a note lined paper / Cornell notes (its cssclasses), and typing blocks at the
// cursor with the cursor left where the writing goes.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

// main.js needs Obsidian's API: a stand-in is enough for these helpers
const load = Module._load;
Module._load = function (name, ...rest) {
  if (name === 'obsidian') return { Plugin: class {}, PluginSettingTab: class {}, Setting: class {}, Notice: class {} };
  return load.call(this, name, ...rest);
};
const { paperClasses, insertBlock, TEMPLATES, colourRuns, setDateProperty, frontmatterDate, noteThemeClasses, addPageDate, wrapSelection } = require('../main.js');
Module._load = load;

test('cssclasses: lined paper, Cornell notes and off, other classes kept', () => {
  assert.deepEqual(paperClasses({}, 'lined'), ['lined-paper']);
  assert.deepEqual(paperClasses({}, 'cornell'), ['lined-paper', 'cornell']);
  assert.deepEqual(paperClasses({ cssclasses: ['wide-page', 'lined-paper'] }, 'cornell'), ['lined-paper', 'cornell', 'wide-page']);
  assert.deepEqual(paperClasses({ cssclasses: 'lined-paper, cornell' }, 'lined'), ['lined-paper']);
  assert.deepEqual(paperClasses({ cssclass: 'cornell lined-paper', cssclasses: ['x'] }, 'off'), ['x']);
});

// a minimal editor (the CodeMirror calls Obsidian's Editor has)
function editor(text, line, ch) {
  let lines = text.split('\n');
  let cursor = { line, ch };
  const offset = (p) => lines.slice(0, p.line).reduce((n, l) => n + l.length + 1, 0) + p.ch;
  return {
    getCursor: () => cursor, setCursor: (p) => { cursor = p; },
    getLine: (n) => lines[n], lineCount: () => lines.length,
    replaceRange(t, from, to = from) { const all = lines.join('\n'); lines = (all.slice(0, offset(from)) + t + all.slice(offset(to))).split('\n'); },
    text: () => lines.join('\n'),
  };
}

test('a block goes on lines of its own, the cursor where the writing goes', () => {
  // on an empty line under some text: a blank line before it
  const e = editor('# T\nsome text\n\nmore', 2, 0);
  insertBlock(e, TEMPLATES.group());
  assert.equal(e.text(), '# T\nsome text\n\n>> [!cue]\n>> \n>\n>> [!notes]\n>> \n\nmore');
  assert.deepEqual(e.getCursor(), { line: 4, ch: 3 });
  // at the end of a line of text: on new lines under it
  const f = editor('text', 0, 4);
  insertBlock(f, TEMPLATES.question());
  assert.equal(f.text(), 'text\n\n>> [!question] Question\n>> \n');
  assert.deepEqual(f.getCursor(), { line: 3, ch: 3 });
  // a divider leaves a blank line after it, so the next text is not part of it
  const g = editor('', 0, 0);
  insertBlock(g, TEMPLATES.divider());
  assert.equal(g.text(), '>> [!divider]\n\n');
  assert.deepEqual(g.getCursor(), { line: 2, ch: 0 });
  // a whole Cornell page in an empty note, titled after the note
  const h = editor('', 0, 0);
  insertBlock(h, TEMPLATES.cornell('Photosynthesis'));
  assert.match(h.text(), /^# Photosynthesis\n\n>> \[!question\] Question\n>> \n/);
  assert.deepEqual(h.getCursor(), { line: 3, ch: 3 });
});

test('a title: just the title on its line, today\'s date in the date property, the cursor under it', () => {
  const iso = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  // no properties yet: they are added
  const e = editor('', 0, 0);
  setDateProperty(e);
  insertBlock(e, TEMPLATES.title('Immunity'));
  assert.equal(e.text(), `---\ndate: ${iso}\n---\n\n# Immunity\n`);
  assert.deepEqual(e.getCursor(), { line: 5, ch: 0 });
  // properties without a date: the date goes in with them
  const f = editor('---\ncssclasses: [lined-paper]\n---\n', 3, 0);
  setDateProperty(f);
  assert.equal(f.text(), `---\ncssclasses: [lined-paper]\ndate: ${iso}\n---\n`);
  assert.deepEqual(f.getCursor(), { line: 4, ch: 0 });
  // a date already set is kept
  const g = editor('---\nDate: 2026-10-26\n---\n', 3, 0);
  setDateProperty(g);
  assert.equal(g.text(), '---\nDate: 2026-10-26\n---\n');
});

test('the date property, written like "26 Oct 2026"', () => {
  assert.equal(frontmatterDate({ Date: '2026-10-26' }), '26 Oct 2026');
  assert.equal(frontmatterDate({ date: '2026-03-05T10:20' }), '5 Mar 2026');
  assert.equal(frontmatterDate({ created: '2026-12-01' }), '1 Dec 2026');
  assert.equal(frontmatterDate({ date: 'Term 4, week 2' }), 'Term 4, week 2');
  assert.equal(frontmatterDate({ title: 'x' }), '');
  assert.equal(frontmatterDate(null), '');
});

test('pen marks and coloured text are found in a line of source (editing view shows them)', () => {
  const runs = colourRuns('a <span class="pen-circle">word</span> b <font color="#1e4fbf">blue</font> <span style="color: red" class="pen-box">both</span> <span class="other">no</span>');
  assert.deepEqual(runs.map((r) => [r.inner, r.colour, r.mark]), [['word', '', 'pen-circle'], ['blue', '#1e4fbf', ''], ['both', 'red', 'pen-box']]);
});

test('a note\'s own light or dark paper: its cssclasses, the rest kept', () => {
  assert.deepEqual(noteThemeClasses({ cssclasses: ['lined-paper', 'cornell'] }, 'dark'), ['lined-paper', 'cornell', 'dark-paper']);
  assert.deepEqual(noteThemeClasses({ cssclasses: ['lined-paper', 'dark-paper'] }, 'light'), ['lined-paper', 'light-paper']);
  assert.deepEqual(noteThemeClasses({ cssclass: 'lined-paper, cornell' }, 'dark'), ['lined-paper', 'cornell', 'dark-paper']);
  assert.deepEqual(noteThemeClasses({}, 'light'), ['light-paper']);
});

test('a title on a later page: today in the page-dates list, at its place', () => {
  const iso = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  // the 3rd # title: the 2nd item, the 1st kept
  const e = editor('---\ndate: 2026-10-26\npage-dates:\n  - 2026-10-27\n---\n# One\n# Two\n\n# Three', 8, 0);
  addPageDate(e);
  assert.equal(e.text(), `---\ndate: 2026-10-26\npage-dates:\n  - 2026-10-27\n  - ${iso}\n---\n# One\n# Two\n\n# Three`);
  assert.deepEqual(e.getCursor(), { line: 9, ch: 0 });
  // put between two pages: the later page keeps its date
  const f = editor('---\ndate: 2026-10-26\npage-dates: [2026-10-27]\n---\n# One\nx\n# Two', 5, 1);
  addPageDate(f);
  assert.equal(f.text(), `---\ndate: 2026-10-26\npage-dates:\n  - ${iso}\n  - 2026-10-27\n---\n# One\nx\n# Two`);
  // no list yet, the 3rd title: an empty place for the 2nd
  const g = editor('---\ndate: 2026-10-26\n---\n# One\n# Two\n', 5, 0);
  addPageDate(g);
  assert.equal(g.text(), `---\ndate: 2026-10-26\npage-dates:\n  - ""\n  - ${iso}\n---\n# One\n# Two\n`);
  // the note's own title: nothing (its date is the date property)
  const h = editor('---\ndate: 2026-10-26\n---\n', 3, 0);
  addPageDate(h);
  assert.equal(h.text(), '---\ndate: 2026-10-26\n---\n');
});

test('pen and highlighter commands: spaces selected at either end stay outside the mark', () => {
  const sel = (text) => {
    let out = null;
    return { getSelection: () => text, replaceSelection: (v) => { out = v; }, out: () => out };
  };
  const a = sel('two words ');
  wrapSelection(a, '<mark class="hl-pink">', '</mark>');
  assert.equal(a.out(), '<mark class="hl-pink">two words</mark> ');
  const b = sel(' word');
  wrapSelection(b, '==', '==');
  assert.equal(b.out(), ' ==word==');
  const c = sel('  ');
  wrapSelection(c, '==', '==');
  assert.equal(c.out(), '  ', 'only spaces: nothing to mark');
});

test('a highlighter of another colour is found in a line of source (editing view shows it)', () => {
  const runs = colourRuns('a <mark class="hl-pink">pink words</mark> b <mark>plain</mark>');
  assert.deepEqual(runs.map((r) => [r.inner, r.mark]), [['pink words', 'cm-highlight hl-pink']]);
});
