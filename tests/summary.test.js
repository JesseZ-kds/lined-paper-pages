'use strict';
// The Cornell summary sits on the bottom lines of the last page: 5 lines (or more for longer text),
// shrinking to 3 when the notes need the room, and moving to a new page when even that doesn't fit.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { render, closeBrowsers } = require('./lib/harness');
const { note } = require('./lib/notes');

after(closeBrowsers);

const ROW = (290 / 25.4 * 96) / (3 + 32 + 3 * 0.11);   // one ruled row on the A4 page (CSS px)
const LAST_ROW = 35;                                    // the last writing row of a page (title bar + 32 rows)
const row = (bottom) => Math.round(bottom / ROW);

// where the summary ended up: { page, labelRow, textRows, lastNotes: [page, row] }
function placement(words) {
  const at = (re) => words.filter((w) => re.test(w.w)).map((w) => [w.page, row(w.bottom)]);
  const label = at(/^Summary$/).filter(([, r]) => r > 3).pop();
  const text = at(/^s\d+$/);
  const notes = at(/^n\d+$/).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return { page: label[0], labelRow: label[1], textRows: text.map(([, r]) => r), textPages: [...new Set(text.map(([p]) => p))], lastNotes: notes.pop() };
}
const asPdf = (r) => r.pdf.words;
const asReading = (r) => r.reading.words.map((w) => ({ ...w, bottom: w.y + w.h }));

// the expected label row: the summary fills the last rows, at least 5 (or label + text), but not
// higher than one blank row under the notes
function expectedLabelRow(p, lines) {
  let want = LAST_ROW - Math.max(5, 1 + lines) + 1;
  if (p.lastNotes[0] === p.page) want = Math.max(want, p.lastNotes[1] + 2);
  return want;
}

for (const [mode, cssPaging] of [['plugin pagination', false], ['CSS pagination', true]]) {
  for (const fill of [20, 23, 24, 25, 26, 27, 28, 31]) {
    for (const lines of [1, 3, 4, 6]) {
      test(`summary of ${lines} line(s) after ${fill} lines of notes (${mode})`, async (t) => {
        const r = await render(note('summary', { fill, lines }), { cssPaging });
        if (r.cssPaged === null) return t.skip(`${mode} is not available in this browser`);
        const pdf = placement(asPdf(r)), reading = placement(asReading(r));
        // same in reading view and the PDF
        assert.deepEqual(reading, pdf, 'reading view and PDF differ');
        // on the right page: the first one if the summary's minimum (3 lines, or its text) plus a
        // blank line fits under the notes, else the next
        const notesEnd = Math.max(...asReading(r).filter((w) => /^n\d+$/.test(w.w) && w.page === 1).map((w) => row(w.bottom)));
        const need = Math.max(3, 1 + lines);
        const page = LAST_ROW - notesEnd - 1 >= need ? 1 : 2;
        assert.deepEqual(pdf.textPages, [page], 'summary on the wrong page');
        // at the bottom, inside the writing area
        assert.ok(pdf.textRows.every((x) => x <= LAST_ROW), 'summary runs into the footer');
        assert.equal(pdf.labelRow, expectedLabelRow(pdf, lines), 'summary not at the bottom of the page');
      });
    }
  }
}

// without the plugin (CSS pagination only) a summary of up to 4 lines still sits at the bottom
for (const fill of [20, 26, 28, 31]) {
  for (const lines of [1, 2, 3, 4]) {
    test(`without the plugin: summary of ${lines} line(s) after ${fill} lines of notes`, async (t) => {
      const r = await render(note('summary', { fill, lines }), { cssPaging: true, plugin: false });
      if (r.cssPaged === null) return t.skip('CSS pagination is not available in this browser');
      for (const words of [asReading(r), asPdf(r)]) {
        const p = placement(words);
        assert.ok(p.textRows.every((x) => x <= LAST_ROW), 'summary runs into the footer');
        assert.equal(p.labelRow, expectedLabelRow(p, lines), 'summary not at the bottom of the page');
      }
    });
  }
}
