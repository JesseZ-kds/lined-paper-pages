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
const { paperClasses, insertBlock, TEMPLATES, colourRuns, setDateProperty, frontmatterDate, noteThemeClasses, addPageDate, wrapSelection, restyleLine, HOTKEYS, addPaperCommands, formatNoteText, addRevised } = require('../main.js');
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

test('a new pen colour, highlighter or mark takes the place of the old one; remove takes it off', () => {
  const sel = (line, part) => { const a = line.indexOf(part); return [a, a + part.length]; };
  const blue = { open: '<font color="#1e4fbf">', close: '</font>' };
  const pink = { open: '<mark class="hl-pink">', close: '</mark>' };
  // the whole coloured text, selected with its tags or without: the colour is changed, not nested
  let l = 'the <font color="#c62828">foetus</font> is';
  assert.equal(restyleLine(l, ...sel(l, 'foetus'), ['colour'], blue).text, 'the <font color="#1e4fbf">foetus</font> is');
  assert.equal(restyleLine(l, ...sel(l, '<font color="#c62828">foetus</font>'), ['colour'], blue).text, 'the <font color="#1e4fbf">foetus</font> is');
  // no selection, the cursor in it: the whole run
  assert.equal(restyleLine(l, l.indexOf('tus'), l.indexOf('tus'), ['colour'], blue).text, 'the <font color="#1e4fbf">foetus</font> is');
  // part of it: the rest keeps its colour
  l = '<font color="#c62828">life begins at birth</font>';
  assert.equal(restyleLine(l, ...sel(l, 'birth'), ['colour'], blue).text, '<font color="#c62828">life begins at</font> <font color="#1e4fbf">birth</font>');
  // remove
  assert.equal(restyleLine(l, 3, 3, ['colour'], null).text, 'life begins at birth');
  // highlighters: == and <mark> are one kind; a colour stays when the highlight changes
  l = 'at ==birth== and <font color="#c62828">life</font>';
  assert.equal(restyleLine(l, ...sel(l, 'birth'), ['highlight'], pink).text, 'at <mark class="hl-pink">birth</mark> and <font color="#c62828">life</font>');
  assert.equal(restyleLine(l, ...sel(l, 'at ==birth== and <font color="#c62828">life</font>'), ['colour', 'highlight', 'mark'], null).text, 'at birth and life');
  l = '<mark class="hl-green">a b c</mark>';
  assert.equal(restyleLine(l, ...sel(l, 'b'), ['highlight'], { open: '==', close: '==' }).text, '<mark class="hl-green">a</mark> ==b== <mark class="hl-green">c</mark>');
  // marks
  l = 'a <span class="pen-box">word</span>';
  assert.equal(restyleLine(l, ...sel(l, 'word'), ['mark'], { open: '<span class="pen-circle">', close: '</span>' }).text, 'a <span class="pen-circle">word</span>');
  // nothing there yet, no selection: an empty one to write in
  const r = restyleLine('ab', 1, 1, ['colour'], blue);
  assert.deepEqual(r, { text: 'a<font color="#1e4fbf"></font>b', a: 23, b: 23 });
  // the styled text is selected after
  l = 'x foetus y';
  const q = restyleLine(l, ...sel(l, 'foetus '), ['colour'], blue);
  assert.equal(q.text.slice(q.a, q.b), 'foetus');
});

test('a highlight inside another (written by older versions): both taken off, then the new one put on', () => {
  const sel = (line, part) => { const a = line.indexOf(part); return [a, a + part.length]; };
  let l = 'begins ==<mark class="hl-blue">at birth</mark>==.';
  assert.equal(restyleLine(l, ...sel(l, 'at birth'), ['highlight'], { open: '<mark class="hl-orange">', close: '</mark>' }).text, 'begins <mark class="hl-orange">at birth</mark>.');
  assert.equal(restyleLine(l, l.indexOf('birth'), l.indexOf('birth'), ['highlight'], null).text, 'begins at birth.', 'remove, the cursor in it');
  l = 'a ==b <mark class="hl-pink">c</mark> d== e';
  const c = l.indexOf('>c<') + 1;
  assert.equal(restyleLine(l, c, c + 1, ['highlight'], null).text, 'a ==b== c ==d== e', 'the rest of the outer one stays');
});

test('the cursor on an arrow (-> => ~>), nothing selected: a pen colour colours that arrow', () => {
  const red = { open: '<font color="#c62828">', close: '</font>' };
  const l = 'life begins -> at birth => foetus';
  const at = l.indexOf('->') + 1;
  assert.equal(restyleLine(l, at, at, ['colour'], red).text, 'life begins <font color="#c62828">-></font> at birth => foetus');
  const at2 = l.indexOf('=>') + 2;   // (just after it counts too)
  assert.equal(restyleLine(l, at2, at2, ['colour'], red).text, 'life begins -> at birth <font color="#c62828">=></font> foetus');
  // already coloured: the colour is changed
  const c = 'a <font color="#1e4fbf">-></font> b';
  const at3 = c.indexOf('->');
  assert.equal(restyleLine(c, at3, at3, ['colour'], red).text, 'a <font color="#c62828">-></font> b');
});

test('hotkeys: one family per kind of command, named after it, no two the same', () => {
  const cmds = [];
  addPaperCommands({ app: {}, settings: {}, addCommand: (c) => cmds.push(c), addRibbonIcon: () => {} });
  const byId = Object.fromEntries(cmds.map((c) => [c.id, c]));
  // every hotkey is for a command that exists, and has it
  for (const id of Object.keys(HOTKEYS)) {
    assert.ok(byId[id], `${id} is a command`);
    assert.deepEqual(byId[id].hotkeys, HOTKEYS[id], `${id} has its hotkey`);
  }
  // no two the same
  const keys = Object.values(HOTKEYS).map((h) => h[0].modifiers.join('+') + '+' + h[0].key);
  assert.equal(new Set(keys).size, keys.length, 'no two the same: ' + keys.join(' '));
  // each family: its keys and the start of its commands' names
  const family = { 'Alt': 'Insert: ', 'Mod+Alt': 'Pen: ', 'Alt+Shift': 'Highlight: ', 'Mod+Alt+Shift': 'Mark: ' };
  for (const [id, h] of Object.entries(HOTKEYS)) {
    const want = family[h[0].modifiers.join('+')];
    assert.ok(want && byId[id].name.startsWith(want), `${id} (${h[0].modifiers.join('+')}+${h[0].key}): "${byId[id].name}" starts with "${want}"`);
  }
  // the commands without a hotkey are named by kind too
  for (const c of cmds) assert.match(c.name, /^(Insert|Pen|Highlight|Mark|Paper|Note): /, c.name);
  // the ones in the user's own list
  const k = (id) => HOTKEYS[id][0].modifiers.join('+') + '+' + HOTKEYS[id][0].key;
  assert.deepEqual(['insert-cue-notes', 'insert-summary', 'insert-question', 'insert-title', 'insert-divider', 'insert-nextpage'].map(k), ['Alt+n', 'Alt+c', 'Alt+q', 'Alt+t', 'Alt+d', 'Alt+p']);
  assert.deepEqual(['colour-red', 'colour-blue', 'colour-green', 'colour-orange', 'colour-purple'].map(k), ['Mod+Alt+r', 'Mod+Alt+b', 'Mod+Alt+g', 'Mod+Alt+o', 'Mod+Alt+p']);
  assert.deepEqual(['highlighter-orange', 'highlighter-yellow', 'highlighter-blue', 'highlighter-green', 'highlighter-pink'].map(k), ['Alt+Shift+o', 'Alt+Shift+y', 'Alt+Shift+b', 'Alt+Shift+g', 'Alt+Shift+p']);
});

test('a definition / quote page: its format, the note it is from, its block id; a quote titled with its source', () => {
  assert.equal(formatNoteText('def', { name: 'Conscientious objection', text: 'A doctor may refuse on moral grounds.', from: 'Abortion', date: '2026-11-11' }),
    '---\nformat: def\ndate: 2026-11-11\nfrom: "[[Abortion]]"\ncssclasses:\n  - lined-paper\n---\n> [!info] Conscientious objection\n> A doctor may refuse on moral grounds.\n\n^def\n');
  assert.equal(formatNoteText('quote', { author: 'Catechism of the Catholic Church, 2270', link: 'https://www.vatican.va/archive/ENG0015/__P7Z.HTM', text: 'Human life must be respected\nand protected absolutely.', date: '2026-11-11' }),
    '---\nformat: quote\ndate: 2026-11-11\nsource: "Catechism of the Catholic Church, 2270"\nlink: "https://www.vatican.va/archive/ENG0015/__P7Z.HTM"\ncssclasses:\n  - lined-paper\n---\n> [!quote] [Catechism of the Catholic Church, 2270](https://www.vatican.va/archive/ENG0015/__P7Z.HTM)\n> Human life must be respected\n> and protected absolutely.\n\n^quote\n');
  assert.match(formatNoteText('quote', { author: 'Yevamot 69b', date: '2026-11-11' }), /\n> \[!quote\] Yevamot 69b\n> \n\n\^quote\n$/, 'no link: the source as it is');
});

test('a revised version: the same title, no "revised" in it, the next block id, the cursor on its line', () => {
  const page = formatNoteText('quote', { author: 'Yevamot 69b', text: 'until forty days', date: '2026-11-11' });
  const one = addRevised(page);
  assert.equal(one.id, 'revised');
  assert.ok(one.text.endsWith('\n^quote\n\n> [!quote] Yevamot 69b\n> \n\n^revised\n'), one.text);
  assert.equal(one.text.split('\n')[one.line], '> ');
  const two = addRevised(one.text);
  assert.equal(two.id, 'revised-2');
  assert.equal(addRevised(two.text).id, 'revised-3');
  assert.equal((two.text.match(/\[!quote\] Yevamot 69b$/gm) || []).length, 3, 'every version has the same title');
});
