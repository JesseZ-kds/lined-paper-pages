'use strict';
// Editing view (Live Preview): callouts take only their own lines, embedded ones look exactly like
// typed ones, and coloured text with links (<font color>[[link]]</font>) shows in its colour with
// the links working.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const { browser, closeBrowsers, CSS, SIM, MAIN, ROOT } = require('./lib/harness');

after(closeBrowsers);

const callout = (type, title, inner) => `<div class="callout" data-callout="${type}"><div class="callout-title"><div class="callout-title-inner">${title}</div></div><div class="callout-content">${inner}</div></div>`;
const IMM = callout('tip', 'immunity', "<p>the body's ability to resist or fight off infections and diseases.</p>");
// Obsidian's editing-view DOM for an embed (with the height Obsidian estimates for it)
const embed = (cls) => `<div class="internal-embed markdown-embed inline-embed is-loaded ${cls}" contenteditable="false"><div class="embed-title markdown-embed-title"></div><div class="markdown-embed-content"><div class="markdown-preview-view markdown-rendered show-indentation-guide"><div class="markdown-preview-sizer markdown-preview-section" style="padding-bottom: 0px; min-height: 140px;"><div class="markdown-preview-pusher" style="height:0.1px"></div><div class="mod-header"></div><div class="el-div">${IMM}</div><div class="el-p"><p></p></div><div class="mod-footer"></div></div></div></div><div class="markdown-embed-link"></div></div>`;
const widget = (html) => `<div class="cm-embed-block cm-callout" contenteditable="false"><div class="markdown-rendered show-indentation-guide">${html}</div></div>`;
const line = (id, text) => `<div class="cm-line" id="${id}">${text}</div>`;

test('editing view: typed and embedded callouts take the same lines and look the same', async () => {
  const b = await browser(false);
  const context = await b.newContext({ viewport: { width: 900, height: 1200 } });
  try {
    const page = await context.newPage();
    await page.setContent(`<!doctype html><html><head><style>html,body{margin:0}</style><style>${SIM}</style><style>${CSS}</style></head><body class="theme-light">
<div class="markdown-source-view cm-s-obsidian mod-cm6 is-live-preview lined-paper cornell"><div class="cm-editor"><div class="cm-scroller"><div class="cm-sizer"><div class="cm-contentContainer"><div class="cm-content">
<div class="cm-line HyperMD-header HyperMD-header-1">Title</div>
${line('l0', 'before')}${widget(IMM)}${line('l1', 'after typed')}
<div>${embed('cm-embed-block')}</div>${line('l2', 'after embed')}
<div class="cm-line HyperMD-quote HyperMD-quote-2" id="q"><span class="cm-formatting cm-formatting-quote">&gt;&gt; </span>${embed('')}</div>${line('l3', 'after embed in a quote')}
${widget(callout('wide', 'Wide', IMM))}${line('l4', 'after typed wide')}
${widget(callout('wide', 'Wide', `<p>${embed('')}</p>`))}${line('l5', 'after embed in wide')}
${widget(callout('divider', 'Divider', ''))}${line('l6', 'after divider')}
</div></div></div></div></div></div></body></html>`);
    const r = await page.evaluate(() => {
      const d = document.createElement('div'); d.style.cssText = 'position:absolute;height:var(--line)';
      document.querySelector('.lined-paper').appendChild(d); const L = d.getBoundingClientRect().height; d.remove();
      const box = (id) => document.getElementById(id).getBoundingClientRect();
      const rows = (a, b) => +((box(b).top - box(a).bottom) / L).toFixed(2);
      const font = (el) => { const s = getComputedStyle(el); return `${s.fontFamily.split(',')[0]} ${s.fontSize}`; };
      const tips = [...document.querySelectorAll('.callout[data-callout="tip"]')];
      return {
        lines: [rows('l0', 'l1'), rows('l1', 'l2'), rows('l2', 'l3'), rows('l3', 'l4'), rows('l4', 'l5'), rows('l5', 'l6')],
        onGrid: ['l0', 'l1', 'l2', 'l3', 'l4', 'l5', 'l6'].every((id) => Math.abs(((box(id).top - box('l0').top) / L) % 1) < 0.01),
        boxes: [...new Set(tips.map((c) => { const b = c.getBoundingClientRect(); return `${b.height.toFixed(1)}h ${b.width.toFixed(0)}w`; }))],
        titleFonts: [...new Set(tips.map((c) => font(c.querySelector('.callout-title-inner'))))],
        textFonts: [...new Set(tips.map((c) => font(c.querySelector('.callout-content p'))))],
        embedFrames: [...document.querySelectorAll('.markdown-embed')].map((e) => getComputedStyle(e).borderLeftWidth + ' ' + getComputedStyle(e).paddingLeft),
      };
    });
    // a callout of a title and one line of text takes 2 lines; [!wide] holding one too; a divider its
    // own line (it doesn't take a ruled row away)
    assert.deepEqual(r.lines, [2, 2, 2, 2, 2, 1]);
    assert.ok(r.onGrid, 'the lines after the callouts are still on the ruled lines');
    assert.equal(r.boxes.length, 1, 'typed and embedded callouts, in [!wide] or not, have the same box: ' + r.boxes);
    assert.equal(r.titleFonts.length, 1, 'all titles in one font: ' + r.titleFonts);
    assert.match(r.titleFonts[0], /Patrick Hand/, 'titles in the handwriting');
    assert.equal(r.textFonts.length, 1, 'all text in one font: ' + r.textFonts);
    assert.ok(r.embedFrames.every((f) => f === '0px 0px'), 'no embed bar or indent: ' + r.embedFrames);
  } finally {
    await context.close();
  }
});

test('editing view: <font color>[[link]]</font> shows coloured, its link opens, the cursor shows the source', async () => {
  const bundle = (await esbuild.build({
    stdin: {
      contents: "import * as view from '@codemirror/view'; import * as state from '@codemirror/state'; import { markdown } from '@codemirror/lang-markdown'; window.CM = { view, state, markdown };",
      resolveDir: ROOT,
    },
    bundle: true, write: false, format: 'iife', logLevel: 'silent',
  })).outputFiles[0].text;
  const b = await browser(false);
  const context = await b.newContext({ viewport: { width: 900, height: 600 } });
  try {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.setContent(`<!doctype html><html><head><style>${SIM}</style><style>${CSS}</style><script>${bundle}</script></head><body class="theme-light">
      <div class="markdown-source-view mod-cm6 is-live-preview lined-paper cornell" id="host"></div></body></html>`);
    // the plugin hands its editor extension to Obsidian; here it goes into a real CodeMirror editor
    const r = await page.evaluate((src) => {
      const opened = [];
      class Plugin { constructor() { this.app = { workspace: { on: () => ({}), openLinkText: (h) => opened.push(h), getLeavesOfType: () => [] } }; } loadData() { return Promise.resolve({}); } saveData() {} addSettingTab() {} registerEvent() {} register() {} registerMarkdownPostProcessor() {} registerDomEvent() {} registerInterval() {} addCommand() {} registerEditorExtension(e) { window.__ext = e; } }
      const mods = { obsidian: { Plugin, PluginSettingTab: class {}, Setting: class {}, Notice: class {} }, '@codemirror/view': CM.view, '@codemirror/state': CM.state };
      const module = { exports: {} };
      new Function('require', 'module', src)((n) => mods[n], module);
      const pl = new module.exports(); pl.scheduleScan = () => {}; pl.onload();
      const doc = ['# Test', '', '>> [!cue]', '>> What is <font color="#4bacc6">[[pathogen#^pathogen|pathogen]]</font>?', '>', '>> [!notes]', '>> A <span style="color: #c0504d">**germ** like [[virus]]</span> makes you sick.'].join('\n');
      const v = new CM.view.EditorView({ doc, extensions: [CM.markdown(), window.__ext], parent: document.getElementById('host'), selection: { anchor: doc.length } });
      const lineText = (n) => v.contentDOM.querySelectorAll('.cm-line')[n].innerText;
      const colour = (el) => getComputedStyle(el).color;
      const out = { away: [lineText(3), lineText(6)] };
      out.widgets = [...v.contentDOM.querySelectorAll('.lp-colour')].map((e) => ({ colour: colour(e), link: colour(e.querySelector('a')), underline: getComputedStyle(e.querySelector('a')).textDecorationLine }));
      const a = v.contentDOM.querySelector('.lp-colour a');
      a.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      out.opened = opened;
      out.cursorStayed = v.state.selection.main.head === doc.length;
      v.dispatch({ selection: { anchor: v.state.doc.line(4).from + 20 } });
      out.editing = lineText(3);
      out.editingColour = [...v.contentDOM.querySelectorAll('.cm-line')[3].querySelectorAll('.lp-colour')].map(colour);
      return out;
    }, MAIN);
    assert.deepEqual(r.away, ['>> What is pathogen?', '>> A germ like virus makes you sick.']);
    assert.deepEqual(r.widgets, [
      { colour: 'rgb(75, 172, 198)', link: 'rgb(75, 172, 198)', underline: 'none' },
      { colour: 'rgb(192, 80, 77)', link: 'rgb(192, 80, 77)', underline: 'none' },
    ]);
    assert.deepEqual(r.opened, ['pathogen#^pathogen']);
    assert.ok(r.cursorStayed, 'clicking the link does not move the cursor');
    assert.equal(r.editing, '>> What is <font color="#4bacc6">[[pathogen#^pathogen|pathogen]]</font>?');
    assert.deepEqual(r.editingColour, ['rgb(75, 172, 198)']);
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
});
