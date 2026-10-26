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
const { paperClasses, insertBlock, TEMPLATES } = require('../main.js');
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
  assert.equal(f.text(), 'text\n\n> [!question] Question\n> \n');
  assert.deepEqual(f.getCursor(), { line: 3, ch: 2 });
  // a divider leaves a blank line after it, so the next text is not part of it
  const g = editor('', 0, 0);
  insertBlock(g, TEMPLATES.divider());
  assert.equal(g.text(), '> [!divider]\n\n');
  assert.deepEqual(g.getCursor(), { line: 2, ch: 0 });
  // a whole Cornell page in an empty note, titled after the note
  const h = editor('', 0, 0);
  insertBlock(h, TEMPLATES.cornell('Photosynthesis'));
  assert.match(h.text(), /^# Photosynthesis <span class="paper-date">\d{4}-\d{2}-\d{2}<\/span>\n\n> \[!question\] Question\n> \n/);
  assert.deepEqual(h.getCursor(), { line: 3, ch: 2 });
});

test('a title with today\'s date, the cursor on the line under it', () => {
  const e = editor('', 0, 0);
  insertBlock(e, TEMPLATES.title('Immunity'));
  const d = new Date(), day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  assert.equal(e.text(), `# Immunity <span class="paper-date">${day}</span>\n`);
  assert.deepEqual(e.getCursor(), { line: 1, ch: 0 });
});
