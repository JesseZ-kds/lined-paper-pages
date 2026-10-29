'use strict';
/*
 * Test notes, written as the HTML Obsidian renders for them in reading view (and in the PDF
 * export): one entry per block (`.markdown-preview-section > div`).
 *
 * Every note is a function of optional parameters and returns { blocks, cornell }.
 */

const W = 'alpha beta gamma delta epsilon zeta eta theta iota kappa'.split(' ');
const words = (n, from = 0) => Array.from({ length: n }, (_, i) => W[(i + from) % W.length]).join(' ');

const callout = (type, title, inner) =>
  `<div class="callout" data-callout="${type}"><div class="callout-title"><div class="callout-icon"></div>` +
  `<div class="callout-title-inner">${title}</div></div><div class="callout-content">${inner}</div></div>`;
const block = (html) => `<div class="el-div">${html}</div>`;
const para = (html) => `<div class="el-p"><p>${html}</p></div>`;
const title = (text) => `<div class="el-h1"><h1>${text}</h1></div>`;
// `>> [!cue]` / `>` / `>> [!notes]`: one quote holding both callouts
const group = (cue, notes) =>
  `<div class="el-blockquote"><blockquote>${callout('cue', 'Cue', cue)}<p></p>${callout('notes', 'Notes', notes)}</blockquote></div>`;
// a picture of the given size (an SVG, so the tests need no image files)
const picture = (w, h, attrs = '') =>
  `<img ${attrs} src="data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#8ab"/></svg>`)}">`;

// Obsidian's DOM for `![[Note#^block-id]]`. The <template> is unpacked when the page loads (an
// HTML parser would not allow these <div>s inside a <p>). `variant` imitates other shapes of it:
//   'empty-p'  an empty paragraph (the ^block-id line) after the callout
//   'wrapper'  the .markdown-embed one level inside the .internal-embed
//   'bare'     both, and no preview view inside
function embed(inner, { variant = '', colour = null } = {}) {
  const content = variant === 'bare'
    ? `<div class="markdown-embed-content"><div class="el-div">${inner}</div><div class="el-p"><p></p></div></div>`
    : `<div class="markdown-embed-content"><div class="markdown-preview-view markdown-rendered show-indentation-guide">` +
      `<div class="markdown-preview-sizer markdown-preview-section" style="padding-bottom: 0px; min-height: 140px;">` +
      `<div class="markdown-preview-pusher" style="height:0.1px"></div><div class="mod-header"></div><div class="el-div">${inner}</div>` +
      `${variant ? '<div class="el-p"><p></p></div>' : ''}<div class="mod-footer"></div></div></div></div>`;
  const frame = `<div class="embed-title markdown-embed-title"></div>${content}<div class="markdown-embed-link"></div>`;
  const span = variant === 'wrapper' || variant === 'bare'
    ? `<span class="internal-embed is-loaded" src="Other#^x"><template class="emb"><div class="markdown-embed inline-embed">${frame}</div></template></span>`
    : `<span class="internal-embed markdown-embed inline-embed is-loaded" src="Other#^x"><template class="emb">${frame}</template></span>`;
  return `<p>${colour ? `<font color="${colour}">` : ''}${span}${colour ? '</font>' : ''}</p>`;
}

const IMMUNITY = callout('tip', 'Immunity', `<p>IMMTEXT the body resists infection ${words(20)}</p>`);

const notes = {
  cornell: () => [
    title('Photosynthesis'),
    block(callout('question', 'Essential question', '<p>How do plants turn light into food?</p>')),
    group('<p>What is it?</p>', `<p>${words(40)}</p>`),
    group('<p>Where?</p>', `<ul><li>${words(12)}</li><li>${words(9, 3)}</li><li>${words(15, 5)}</li></ul>`),
    group('<p>Light reactions</p>', `<p>${words(330, 2)}</p>`),
    group('<p>Calvin cycle</p>', `<p>${words(60, 4)}</p>`),
    block(callout('summary', 'Summary', `<p>${words(25)}</p>`)),
  ],

  short: () => [
    title('Short note'),
    group('<p>What is it?</p>', `<p>${words(40)}</p>`),
    group('<p>Second</p>', `<p>${words(20)}</p>`),
    block(callout('summary', 'Summary', `<p>${words(25)}</p>`)),
  ],

  // cue and notes as separate callouts (not grouped)
  separate: () => [
    title('Separate callouts'),
    block(callout('cue', 'Cue', '<p>First cue</p>')),
    block(callout('notes', 'Notes', `<p>${words(50)}</p>`)),
    block(callout('cue', 'Cue', '<p>Second cue</p>')),
    block(callout('notes', 'Notes', `<p>${words(380, 3)}</p>`)),
    block(callout('summary', 'Summary', `<p>${words(25)}</p>`)),
  ],

  // the conversation-style note the layout was first tuned on (short groups, line breaks)
  hello: ({ summary = 's' } = {}) => [
    title('Hello'),
    block(callout('question', 'Question', '<p>What is the meaning of life?</p>')),
    group('<p>Can you see me?</p>', '<p>Yes.</p>'),
    group('<p>Are you sure?</p>', '<p>Ummm.<br>Maybe?</p>'),
    group('<p>For certain?</p>', "<p>hold on.<br>I can't say that I do.</p>"),
    group('<p>I SEE YOU!<br>You, yes you.</p>', '<p>Me?</p>'),
    group('<p>Obviously.</p>', '<p>Ummmmmmmmmm.</p>'),
    group('<p>IDK what to see.</p>', '<p>Me too.</p>'),
    group('<p>Look at this over here.</p>', callout('plan', 'PLAN', '<p>a</p>')),
    group('<p>Look At This too,</p>', `<p>${picture(720, 330)}</p>`),
    group('<p>ARE YOU CONFIDENT<br>WITH your ANSWER</p>', '<p>Nup...<br>Are you sure.<br>Yes.</p>'),
    block(callout('summary', 'Summary', `<p>${summary}</p>`)),
  ],

  // the same, three times as long (several pages)
  helloLong: () => {
    const h = notes.hello();
    const body = h.slice(2, -1);
    return [h[0], h[1], ...body, ...body, ...body.map((g) => g.replace(/Yes\./g, 'Yes indeed.')), h[h.length - 1]];
  },

  // `>> [!summary]` written straight under the last group: Obsidian puts it in the group's quote
  summaryInGroup: () => {
    const h = notes.hello();
    const sum = h.pop(), last = h.pop();
    return [...h, last.replace('</blockquote>', sum.replace(/^<div class="el-div">|<\/div>$/g, '') + '</blockquote>')];
  },

  // long notes with line breaks, a callout inside the notes
  whatIsUp: () => [
    title('What is up?'),
    block(callout('question', 'Question', '<p>What questions do you have?</p>')),
    group('<p>Cues here.</p>', `<p>${['Notes go here.', ...'ssssssssss', ...'1 2 3 4 5 6 7 7 8 9 10 1 1 2 3 4 5 6 7 8 9 10'.split(' ')].join('<br>')}</p>`),
    group('<p>What is the meaning of life?</p>', callout('note', 's', '<p>a</p>') +
      `<p>${[...'1234567890123456789012344', ...'1 2 3 4 5 6 7 8 9 10 1 2 3 4 5 6 7 8 9 10'.split(' '), ...'abcdefghij'].join('<br>')}</p>`),
    block(callout('summary', 'Summary', '<p>s</p>')),
  ],

  // headings, lists and paragraphs that cross page breaks (`fill` lines of text first)
  plainLong: ({ fill = 0 } = {}) => [
    title('Edge'),
    ...Array.from({ length: fill }, (_, i) => para(`line ${i}`)),
    '<div class="el-h2"><h2>Heading near the end</h2></div>',
    para(words(30)),
    `<div class="el-ul"><ul>${Array.from({ length: 12 }, (_, i) => `<li>item ${i} ${words(i % 3 ? 8 : 30, i)}</li>`).join('')}</ul></div>`,
    `<div class="el-ol"><ol>${Array.from({ length: 12 }, (_, i) => `<li>num ${i} ${words(i % 2 ? 6 : 28, i)}</li>`).join('')}</ol></div>`,
    '<div class="el-h3"><h3>Another heading</h3></div>',
    para(words(45, 2)),
    para(words(15, 2)),
  ],

  // Cornell groups that cross page breaks (`fill` one-line groups first): lists, a long cue
  cornellLong: ({ fill = 0 } = {}) => [
    title('Edge Cornell'),
    block(callout('question', 'Essential question', '<p>Why?</p>')),
    ...Array.from({ length: fill }, (_, i) => group(`<p>c${i}</p>`, `<p>n${i}</p>`)),
    group('<p>List cue</p>', `<ul>${Array.from({ length: 10 }, (_, i) => `<li>item ${i} ${words(i % 3 ? 8 : 30, i)}</li>`).join('')}</ul>`),
    group(`<p>Long cue ${words(40)}</p>`, `<p>${words(30)}</p><ol>${Array.from({ length: 8 }, (_, i) => `<li>${words(i % 2 ? 5 : 25, i)}</li>`).join('')}</ol>`),
    group('<p>Third</p>', `<p>${words(120, 3)}</p>`),
    block(callout('summary', 'Summary', `<p>${words(25)}</p>`)),
  ],

  plain: () => [
    title('Plain lined'),
    para(words(60)),
    '<div class="el-h2"><h2>Heading</h2></div>',
    para(words(500, 1)),
    '<div class="el-ul"><ul><li>one</li><li>two</li></ul></div>',
  ],

  callouts: () => [
    title('Callouts'),
    para('A line of text before.'),
    block(callout('note', 'A note', '<p>first line<br>second line</p>')),
    para('A line between.'),
    block(callout('tip', 'Outer tip', '<p>outer text</p>' + callout('warning', 'Inner warning', '<p>inner text</p>'))),
    para('A line after.'),
  ],

  // `> [!nextpage]` on lined paper and in Cornell notes
  nextPage: () => [
    title('Next page'),
    para('page one text'),
    block(callout('nextpage', 'Nextpage', '')),
    para('AFTERBREAK first'),
    block(callout('note', 'Mixed', '<ul><li>item one</li><li>item two</li></ul><h3>Heading</h3>')),
    para('AFTERMIXED line'),
    block(callout('nextpage', 'Nextpage', '')),
    para('THIRDPAGE text'),
  ],
  nextPageCornell: () => [
    title('Cornell next'),
    block(callout('question', 'Question', '<p>Why?</p>')),
    group('<p>c1</p>', '<p>n1</p>'),
    group('<p>c2</p>', '<p>n2</p>'),
    block(callout('nextpage', 'Nextpage', '')),
    group('<p>CUEAFTER</p>', '<p>NOTESAFTER</p>'),
    group('<p>c4</p>', '<p>n4</p>'),
    block(callout('nextpage', 'Nextpage', '')),
    block(callout('summary', 'Summary', '<p>SUMTEXT</p>')),
  ],

  // `> [!wide]` between groups, after a page break, and at the top of a page
  wide: ({ fill = 0 } = {}) => [
    title('Wide'),
    block(callout('question', 'Question', '<p>Why?</p>')),
    group('<p>c1</p>', '<p>n1</p>'),
    block(callout('wide', 'Wide', '<p>WIDEONE across the whole line of the page, both columns at once, and more words here<br>second wide line</p>')),
    group('<p>c2</p>', '<p>n2</p>'),
    ...Array.from({ length: fill }, (_, i) => group(`<p>f${i}</p>`, `<p>g${i}</p>`)),
    block(callout('wide', 'Wide', '<p>WIDETWO line</p>')),
    group('<p>c3</p>', '<p>n3</p>'),
    block(callout('nextpage', 'Nextpage', '')),
    block(callout('wide', 'Wide', '<p>WIDETHREE after a page break</p>')),
    group('<p>c4</p>', '<p>n4</p>'),
    block(callout('summary', 'Summary', '<p>s</p>')),
  ],
  wideAtTop: () => [
    title('Wide top'),
    block(callout('wide', 'Wide', '<p>TOPWIDE across the whole line<br>second line</p>')),
    group('<p>c1</p>', '<p>n1</p>'),
    block(callout('wide', 'Wide', '<p>MIDWIDE in the middle</p>')),
    group('<p>c2</p>', '<p>n2</p>'),
    block(callout('nextpage', 'Nextpage', '')),
    block(callout('wide', 'Wide', '<p>NEXTWIDE after the page break</p>')),
    group('<p>c3</p>', '<p>n3</p>'),
    block(callout('summary', 'Summary', '<p>s</p>')),
  ],

  divider: () => [
    title('Divider'),
    block(callout('question', 'Question', '<p>Why?</p>')),
    group('<p>c1</p>', `<p>n1 ${words(20)}</p>`),
    block(callout('divider', 'Divider', '')),
    group('<p>c2</p>', '<p>n2</p>'),
    block(callout('wide', 'Wide', '<p>WIDE for comparison</p>')),
    group('<p>c3</p>', '<p>n3</p>'),
    block(callout('divider', 'Divider', '')),
    block(callout('summary', 'Summary', '<p>s</p>')),
  ],
  // a `# Title` after [!nextpage] is the next page's title: with a question under it, without (the
  // title carries the Cues | Notes row), with a [!wide] under it, and on plain lined paper
  pageTitle: ({ question = true, wide = false } = {}) => [
    title('First topic'),
    ...(question ? [block(callout('question', 'Question', '<p>Q one?</p>'))] : []),
    group('<p>c1</p>', '<p>n1</p>'),
    block(callout('nextpage', 'Next page', '')),
    title('Second topic'),
    ...(question ? [block(callout('question', 'Question', '<p>Q two?</p>'))] : []),
    ...(wide ? [block(callout('wide', 'Wide', '<p>WIDE under the title</p>'))] : []),
    group('<p>c2</p>', '<p>n2</p>'),
  ],
  // a summary before [!nextpage]: on the bottom rows of its own part's last page (`fill` one-line
  // groups first), then the next part, with a summary of its own at the end
  // (`inGroup`: each summary written straight under its part's last group, so inside that group's quote)
  midSummary: ({ fill = 0, inGroup = false } = {}) => [
    title('First topic'),
    block(callout('question', 'Question', '<p>Q one?</p>')),
    ...Array.from({ length: fill }, (_, i) => group(`<p>c${i}</p>`, `<p>n${i}</p>`)),
    ...(inGroup
      ? [group('<p>clast</p>', '<p>nlast</p>').replace('</blockquote>', callout('summary', 'Summary', '<p>SUMONE first summary</p>') + '</blockquote>')]
      : [group('<p>clast</p>', '<p>nlast</p>'), block(callout('summary', 'Summary', '<p>SUMONE first summary</p>'))]),
    block(callout('nextpage', 'Next page', '')),
    title('Second topic'),
    block(callout('question', 'Question', '<p>Q two?</p>')),
    group('<p>c2</p>', '<p>n2</p>'),
    block(callout('summary', 'Summary', '<p>SUMTWO second summary</p>')),
  ],
  // the same without [!nextpage]: a new `# Title` starts the new page by itself
  autoBreak: ({ fill = 0, inGroup = false } = {}) => notes.midSummary({ fill, inGroup }).filter((b) => !b.includes('data-callout="nextpage"')),
  autoBreakPlain: () => notes.pageTitlePlain().filter((b) => !b.includes('data-callout="nextpage"')),
  pageTitlePlain: () => [
    title('First topic'), para('text on page one'),
    block(callout('nextpage', 'Next page', '')),
    title('Second topic'), para('text on page two'),
  ],

  // empty `>>` lines in the cues and notes (two paragraphs, a paragraph after a list) are empty
  // ruled lines on the page, also across a page break
  gaps: ({ fill = 0 } = {}) => [
    title('Gaps'),
    block(callout('question', 'Question', '<p>Why?</p>')),
    ...Array.from({ length: fill }, (_, i) => group(`<p>c${i}</p>`, `<p>n${i}</p>`)),
    group('<p>cue A</p><p>cue B</p>', `<p>note 1</p><p>note 2</p><ul><li>item</li></ul><p>after list</p><p>${words(40)}</p><p>last</p>`),
  ],

  // every page block written in a quote of its own (`>> [!divider]`), as the insert commands write them
  nested: () => {
    const q = (x) => `<div><blockquote>${x}</blockquote></div>`;
    return [title('Nested blocks'), q(callout('question', 'Question', '<p>What is the meaning of life?</p>')),
      group('<p>c1</p>', '<p>n1</p>'), q(callout('divider', 'Divider', '')), group('<p>c2</p>', '<p>n2</p>'),
      q(callout('wide', 'Wide', '<p>WIDE nested</p>')), group('<p>c3</p>', `<p>n3 ${words(30)}</p>`),
      q(callout('nextpage', 'Next page', '')), group('<p>c4</p>', '<p>n4</p>'),
      q(callout('summary', 'Summary', '<p>SUMMARY nested text</p>'))];
  },

  dividerPlain: () => [
    title('Plain divider'),
    para('before the divider'),
    block(callout('divider', 'Divider', '')),
    para('after the divider'),
  ],

  // pictures: 6 rows, any shape
  pictures: () => [
    title('Pictures'),
    para('BEFORE text'),
    para(`<span class="internal-embed media-embed image-embed is-loaded">${picture(720, 330)}</span>`),
    para('AFTERONE text'),
    para(`<span class="internal-embed media-embed image-embed is-loaded">${picture(300, 600)}</span>`),
    para('AFTERTWO text'),
  ],

  // a quote callout in the notes, after `fill` lines of notes: for some `fill` it lands on a page
  // break, and must move to the next page whole
  calloutAtBreak: ({ fill = 20 } = {}) => [
    title('Callout at a break'),
    group('<p>What is the Islamic viewpoint?</p>', `<p>${Array.from({ length: fill }, (_, i) => 'n' + (i + 1)).join('<br>')}</p>` +
      callout('quote', 'QUOTETITLE Keith L. Moore', '<p>QUOTETEXT Development of a human being begins with fertilisation, a process by which two highly specialised cells, the sperm and the ovum, unite to form a single cell.</p>') +
      '<ul><li>AFTERQUOTE Biologists believe life begins from fertilisation.</li></ul>'),
  ],

  // titles too long for one line: the note's title, and a callout's
  longTitles: () => [
    title('The Moral Status of the Embryo: When Does Human Life Begin?'),
    group('<p>What is the Scientific viewpoint?</p>',
      callout('quote', 'LONGTITLE Keith L. Moore and T. V. N. Persaud, The Developing Human: Clinically Oriented Embryology', '<p>Development begins with fertilisation.</p>')),
    para('after'),
  ],

  // a realistic page, for the screenshots in the README
  showcase: () => {
    const c = (colour, text) => `<font color="${colour}">${text}</font>`;
    const term = (t) => `<strong>${c('#4f81bd', t)}</strong>`;
    return [
      title('Photosynthesis'),
      block(callout('question', 'Question', '<p>How do plants turn sunlight into food?</p>')),
      group('<p>What is photosynthesis?</p>', `<ul><li>Plants make ${term('glucose')} from light, water and CO₂</li><li>Oxygen is given off as a by-product</li><li>Happens in the ${term('chloroplasts')}</li></ul>`),
      group('<p>The equation</p>', `<p>${c('#f79646', '6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂')}</p><ul><li>Needs light energy and chlorophyll</li></ul>`),
      block(callout('wide', 'Wide', '<p>Part 2: the two stages</p>')),
      group('<p>Light reactions</p>', `<ul><li>In the ${term('thylakoids')}</li><li>Light splits water, releasing oxygen</li><li>Makes ATP and NADPH for the next stage</li></ul>${callout('tip', 'Memory trick', '<p>"Thylakoids take the light"</p>')}`),
      group('<p>Calvin cycle</p>', `<ul><li>In the ${term('stroma')}</li><li>Uses ATP and NADPH to turn CO₂ into glucose</li><li>${c('#c0504d', 'Common mistake: it does not only happen at night')}</li></ul>`),
      block(callout('divider', 'Divider', '')),
      group('<p>Why does it matter?</p>', `<ul><li>Makes the oxygen we breathe</li><li>Food for almost every food chain</li><li>${c('#9bbb59', 'e.g. wheat → bread → us')}</li></ul>`),
      block(callout('summary', 'Summary', '<p>Plants use light to turn water and CO₂ into glucose and oxygen. The light reactions (thylakoids) make ATP and NADPH; the Calvin cycle (stroma) uses them to build glucose.</p>')),
    ];
  },
  showcasePlain: () => [
    title('Reading notes'),
    para('Lined paper on its own: a title bar, ruled lines and a red margin, like a real notebook page.'),
    '<div class="el-h2"><h2>Chapter 3: The water cycle</h2></div>',
    `<div class="el-ul"><ul><li><strong>Evaporation</strong>: the sun heats water into vapour</li><li><strong>Condensation</strong>: vapour cools into clouds</li><li><strong>Precipitation</strong>: rain, snow, hail</li><li><strong>Collection</strong>: rivers, lakes, oceans, ground water</li></ul></div>`,
    block(callout('note', 'Remember', '<p>The cycle has no start and no end.</p>')),
    para('Water moves between the oceans, the air and the land, powered by the sun and pulled back down by gravity.'),
  ],

  // the summary on the last page: `fill` lines of notes, a summary of `lines` lines
  summary: ({ fill = 1, lines = 1 } = {}) => [
    title('Summary test'),
    group('<p>cue</p>', `<p>${Array.from({ length: fill }, (_, i) => 'n' + (i + 1)).join('<br>')}</p>`),
    block(callout('summary', 'Summary', `<p>${Array.from({ length: lines }, (_, i) => 's' + (i + 1)).join('<br>')}</p>`)),
  ],

  // embedded callouts (`![[Other#^id]]`), and the same callouts typed in (`typed: true`)
  embeds: ({ typed = false } = {}) => {
    const e = (html) => (typed ? block(html) : `<div class="el-p">${embed(html)}</div>`);
    const g = (cue, n) => (typed ? group(cue, n) : `<div class="el-p">${embed(group(cue, n).replace(/^<div class="el-blockquote">|<\/div>$/g, ''))}</div>`);
    return [
      title('Embeds'),
      e(callout('question', 'Question', '<p>EMBQ what?</p>')),
      g('<p>EMBC1 cue</p>', `<p>EMBN1 notes ${words(30)}</p>`),
      group('<p>direct cue</p>', '<p>direct notes</p>'),
      e(callout('wide', 'Wide', '<p>EMBWIDE across the line</p>')),
      group('<p>c2</p>', `<p>${words(20)}</p>${callout('tip', 'Tip', '<p>inner tip</p>')}`),
      e(callout('note', 'Note', '<p>EMBNOTE plain callout</p>')),
      group('<p>c3</p>', '<p>n3</p>'),
      e(callout('summary', 'Summary', '<p>EMBSUM summary text</p>')),
    ];
  },
  // embedded callouts inside the notes column, as `>> ![[immunity#^immunity]]`
  embedsInNotes: ({ typed = false, variant = '' } = {}) => {
    const e = (opts) => (typed ? IMMUNITY : embed(IMMUNITY, { variant, ...opts }));
    return [
      title('Immune'),
      group('<p>What is <a class="internal-link" href="immunity">immunity</a>?</p>', e()),
      group('<p>In a list</p>', `<p>before</p>${e()}<p>after</p>`),
      group('<p>c3</p>', '<p>n3</p>'),
    ];
  },
  // embeds of one block that is not a callout (`![[Other#^id]]` of a paragraph, of a list)
  blockEmbeds: () => [
    title('Block embeds'),
    group('<p>What is it?</p>', `<p>before</p>${embed('<p>EMBP Photosynthesis turns light into sugar.</p>')}<p>after</p>`),
    group('<p>List</p>', embed('<ul><li>EMBL first point</li><li>second point</li></ul>')),
    `<div class="el-p">${embed('<p>EMBTOP at the top level</p>')}</div>`,
  ],
  // embedded callouts inside `> [!wide]`
  embedsInWide: ({ typed = false, variant = '' } = {}) => {
    const e = () => (typed ? IMMUNITY : embed(IMMUNITY, { variant }));
    return [
      title('Wide embed'),
      block(callout('question', 'Question', '<p>Why?</p>')),
      group('<p>c1</p>', '<p>n1</p>'),
      block(callout('wide', 'Wide', e())),
      group('<p>c2</p>', '<p>n2</p>'),
      block(callout('wide', 'Wide', '<p>WIDETEXT before</p>' + e())),
      group('<p>c3</p>', '<p>n3</p>'),
    ];
  },
};

// lined paper only (no Cornell layout)
const PLAIN = new Set(['plain', 'pageTitlePlain', 'autoBreakPlain', 'plainLong', 'callouts', 'nextPage', 'pictures', 'dividerPlain', 'showcasePlain']);

function note(name, params) {
  if (!notes[name]) throw new Error('no test note ' + name);
  return { name, blocks: notes[name](params), cornell: !PLAIN.has(name) };
}

module.exports = { note, names: Object.keys(notes), words, callout, group, block, para, title };
