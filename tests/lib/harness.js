'use strict';
/*
 * Test harness. Renders a test note the way Obsidian does, in a real Chromium:
 *   - reading view: the snippets, the plugin (through a stand-in for Obsidian's plugin API) and a
 *     stand-in for Obsidian's own CSS (obsidian-sim.css);
 *   - the PDF export: the same note in Obsidian's export DOM, the plugin's post-processors run on
 *     it, printed to an A4 PDF;
 * and reports where every word lands on the pages of both.
 *
 * Two ways of making pages are tested: the plugin's own pagination (browsers without CSS
 * `column-wrap`) and CSS pagination (Chromium with `column-wrap`; switched on here with
 * --enable-experimental-web-platform-features).
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
// (the tests run offline: the Google Fonts import is left out, the fallback fonts are used)
// With the plugin, Obsidian loads its styles.css (which holds the snippets too); without it, the
// snippets are what a vault can use on their own.
const STYLES_WITH_FONTS = { plugin: read('styles.css'), snippets: ['snippets/lined-paper.css', 'snippets/cornell-notes.css'].map(read).join('\n') };
const STYLES = Object.fromEntries(Object.entries(STYLES_WITH_FONTS).map(([k, v]) => [k, v.replace(/@import url\([^)]*\);/g, '')]));
const CSS = STYLES.plugin;
const SIM = fs.readFileSync(path.join(__dirname, 'obsidian-sim.css'), 'utf8');
const MAIN = read('main.js');
const NO_PLUGIN = 'module.exports = class { onload() {} };';

// ---------- browsers (one per pagination mode, shared by a test file) ----------
const browsers = new Map();
function browser(cssPaging) {
  if (!browsers.has(cssPaging)) {
    browsers.set(cssPaging, chromium.launch({ args: cssPaging ? ['--enable-experimental-web-platform-features'] : [] }));
  }
  return browsers.get(cssPaging);
}
async function closeBrowsers() {
  for (const b of browsers.values()) await (await b).close();
  browsers.clear();
}

// ---------- the plugin, in the page ----------
// Loads main.js with a stand-in for the `obsidian` module. `options.export` collects the
// markdown post-processors (the PDF export runs them) instead of starting the reading view.
function installPlugin({ src, exportMode, extra }) {
  const processors = [];
  const app = { workspace: { on: () => ({}), getLeavesOfType: () => [], openLinkText: () => {} } };
  class Plugin {
    constructor() { this.app = app; this.manifest = { version: 'test' }; }
    loadData() { return Promise.resolve({}); }
    saveData() { return Promise.resolve(); }
    addSettingTab() {} addCommand() {} registerEvent() {} registerDomEvent() {} registerInterval() {} registerEditorExtension() {}
    registerMarkdownPostProcessor(f) { processors.push(f); }
  }
  const obsidian = { Plugin, PluginSettingTab: class {}, Setting: class {}, Notice: class { constructor(m) { console.error('NOTICE ' + m); } } };
  const module = { exports: {} };
  new Function('require', 'module', src)((name) => (name === 'obsidian' ? obsidian : (extra && extra[name]) || {}), module);
  const plugin = new module.exports();
  if (exportMode) plugin.scheduleScan = () => {};
  plugin.onload();
  if (exportMode) for (const el of document.querySelectorAll('.markdown-preview-view > div')) for (const f of processors) f(el, {});
  window.plugin = plugin;
  window.__processors = processors;
}

// Obsidian's embed DOM can't be written as HTML text (its <div>s sit inside a <p>): it is kept in
// <template class="emb"> and unpacked here, before anything else runs.
const UNPACK = "<script>document.addEventListener('DOMContentLoaded', () => document.querySelectorAll('template.emb').forEach((t) => t.replaceWith(t.content)))</script>";

function pages({ blocks, cornell }, theme, fonts = false, plugin = true) {
  const cls = cornell ? 'lined-paper cornell' : 'lined-paper';
  const css = (fonts ? STYLES_WITH_FONTS : STYLES)[plugin ? 'plugin' : 'snippets'];
  const head = `${UNPACK}<style>html,body{margin:0;padding:0}</style><style>${SIM}</style><style>${css}</style>`;
  const reading = `<!doctype html><html><head>${head}</head><body class="${theme}">
<div class="markdown-reading-view" style="height:100vh;overflow:auto;display:flex;flex-direction:column"><div class="markdown-preview-view markdown-rendered ${cls}" style="overflow:visible">
<div class="markdown-preview-sizer markdown-preview-section"><div class="markdown-preview-pusher" style="width: 1px; height: 0.1px; margin-bottom: 0px;"></div><div class="mod-header"></div>${blocks.join('')}<div class="mod-footer"></div></div></div></div></body></html>`;
  const print = `<!doctype html><html><head>${head}</head><body class="${theme}"><div class="print"><div class="markdown-preview-view markdown-rendered ${cls}">${blocks.join('')}</div></div></body></html>`;
  return { reading, print };
}

// every word in reading view: its sheet, and where it is on that sheet
function readingWords() {
  const view = document.querySelector('.markdown-preview-view');
  const sizer = view.querySelector('.markdown-preview-sizer');
  const px = (expr) => { const d = document.createElement('div'); d.style.cssText = 'position:absolute;height:' + expr; view.appendChild(d); const h = d.getBoundingClientRect().height; d.remove(); return h; };
  const box = sizer.getBoundingClientRect();
  const P = px('var(--page-h)'), S = px('var(--sheet-h)'), L = px('var(--line)');
  const out = [];
  const range = document.createRange();
  const tw = document.createTreeWalker(view, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    const el = n.parentElement;
    if (!el || el.closest('.lp-hdr, .lp-sheet') || !el.checkVisibility({ visibilityProperty: true })) continue;
    for (const m of n.data.matchAll(/\S+/g)) {
      range.setStart(n, m.index); range.setEnd(n, m.index + m[0].length);
      const r = range.getClientRects()[0];
      if (!r || !r.width) continue;
      const y = r.top - box.top, k = Math.floor(y / P);
      out.push({ w: m[0], page: k + 1, x: r.left - box.left, y: y - k * P, h: r.height, title: !!el.closest('h1') });
    }
  }
  return { words: out, geometry: { x: box.left, y: box.top, width: box.width, height: box.height, pageHeight: P, sheetHeight: S, line: L, paged: view.classList.contains('lp-paged') } };
}

// every word in the PDF, in CSS pixels from the top of its page
function pdfWords(file) {
  const xml = execFileSync('pdftotext', ['-bbox', file, '-'], { encoding: 'utf8' });
  const out = []; let page = 0;
  const unescape = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&');
  for (const line of xml.split('\n')) {
    if (line.includes('<page ')) page++;
    const m = /<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*)<\/word>/.exec(line);
    if (m) out.push({ w: unescape(m[5]), page, x: +m[1] * 96 / 72, y: +m[2] * 96 / 72, bottom: +m[4] * 96 / 72 });
  }
  return { words: out, pages: page };
}

/**
 * Open a note in reading view, with the plugin running, for tests that work with the page.
 * @returns { page, context, cssPaged } (page is null when the pagination mode isn't available)
 */
async function openReading(note, { cssPaging = false, plugin = true, dpr = 1, theme = 'theme-light', viewport = { width: 900, height: 9000 }, src = null, extra = null, fonts = false } = {}) {
  const b = await browser(cssPaging);
  const context = await b.newContext({ viewport, deviceScaleFactor: dpr });
  const page = await context.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') page.errors.push(m.text()); });
  await page.setContent(pages(note, theme, fonts, plugin || !!src).reading);
  if (fonts) await page.evaluate(() => document.fonts.ready);
  const cssPaged = await page.evaluate(() => CSS.supports('column-wrap', 'wrap') && CSS.supports('column-height', '1px'));
  if (cssPaged !== cssPaging) { await context.close(); return { page: null, context: null, cssPaged: null }; }
  await page.evaluate(installPlugin, { src: src || (plugin ? MAIN : NO_PLUGIN), extra });
  await page.waitForTimeout(800);
  return { page, context, cssPaged };
}

/**
 * Render a note in reading view and as a PDF.
 * @param note      from notes.note()
 * @param options   cssPaging (default false), plugin (default true), postProcess (default true:
 *                  the export runs the plugin's post-processors), dpr, theme, screenshots (a folder)
 * @returns { cssPaged, reading: { words, geometry, pages }, pdf: { words, pages } }
 *          cssPaged = whether the browser made the pages with CSS (null: mode not available here)
 */
async function render(note, options = {}) {
  const { cssPaging = false, plugin = true, postProcess = true, dpr = 1, theme = 'theme-light', screenshots = null, fonts = false } = options;
  const { page, context, cssPaged } = await openReading(note, { cssPaging, plugin, dpr, theme, fonts });
  if (!page) return { cssPaged: null };   // this pagination mode isn't available in this browser
  try {
    const errors = page.errors;
    const reading = await page.evaluate(readingWords);
    const g = reading.geometry;
    reading.pages = Math.max(1, Math.round((g.height + g.pageHeight - g.sheetHeight) / g.pageHeight));
    if (screenshots) {
      fs.mkdirSync(screenshots, { recursive: true });
      for (let k = 0; k < reading.pages; k++) {
        await page.screenshot({ path: path.join(screenshots, `${note.name}-reading-${k + 1}.png`), clip: { x: g.x, y: g.y + k * g.pageHeight, width: g.width, height: g.sheetHeight } });
      }
    }

    const exportPage = await context.newPage();
    exportPage.on('pageerror', (e) => errors.push(e.message));
    await exportPage.setContent(pages(note, theme, fonts, plugin).print);
    if (fonts) await exportPage.evaluate(() => document.fonts.ready);
    await exportPage.evaluate(installPlugin, { src: plugin && postProcess ? MAIN : NO_PLUGIN, exportMode: true });
    await exportPage.waitForTimeout(50);
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'lpp-')), 'export.pdf');
    await exportPage.pdf({ path: file, preferCSSPageSize: true, printBackground: true });
    const pdf = pdfWords(file);
    if (screenshots) fs.copyFileSync(file, path.join(screenshots, `${note.name}.pdf`));
    fs.rmSync(path.dirname(file), { recursive: true, force: true });
    return { cssPaged, reading, pdf, errors };
  } finally {
    await context.close();
  }
}

// ---------- comparing ----------
const ignored = (w) => w === 'Cues' || w === 'Notes' || /^\d+\.$/.test(w);   // repeated labels, list numbers

/**
 * Match every word in reading view to the same word in the PDF: same page, same place (within
 * `tolerance` px; y compared at the bottom of the word). The title is left out: the PDF viewer
 * reports a different box for its large letters.
 */
function compare(reading, pdf, tolerance = 4) {
  const pool = new Map();
  for (const p of pdf.words) {
    if (ignored(p.w)) continue;
    if (!pool.has(p.w)) pool.set(p.w, []);
    pool.get(p.w).push(p);
  }
  const titles = reading.words.filter((r) => r.title).map((r) => r.w);
  for (const t of titles) {
    const c = pool.get(t);
    const i = c ? c.findIndex((p) => p.page === 1 && p.bottom < 140) : -1;
    if (i >= 0) c.splice(i, 1);
  }
  const missing = [];
  for (const r of reading.words) {
    if (r.title || ignored(r.w)) continue;
    const c = pool.get(r.w) || [];
    const i = c.findIndex((p) => p.page === r.page && Math.abs(p.x - r.x) < tolerance && Math.abs(p.bottom - (r.y + r.h)) < tolerance);
    if (i >= 0) c.splice(i, 1);
    else missing.push(r);
  }
  const extra = [...pool.values()].flat();
  return { missing, extra, ok: !missing.length && !extra.length };
}

const describeMismatch = ({ missing, extra }) =>
  [...missing.slice(0, 4).map((r) => `reading "${r.w}" p${r.page} x${r.x.toFixed(0)} y${r.y.toFixed(0)}`),
   ...extra.slice(0, 4).map((p) => `pdf "${p.w}" p${p.page} x${p.x.toFixed(0)} y${p.y.toFixed(0)}`)].join('; ');

module.exports = { render, openReading, readingWords, pdfWords, compare, describeMismatch, closeBrowsers, browser, installPlugin, CSS, SIM, MAIN, ROOT };
