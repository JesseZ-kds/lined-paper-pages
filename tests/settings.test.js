'use strict';
// The settings page: every option is shown, changes show straight away and are saved, Reset all
// puts everything back. Also: the reading view never gets a second scroll bar.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { browser, closeBrowsers, CSS, MAIN } = require('./lib/harness');

after(closeBrowsers);

// a small stand-in for Obsidian's settings API (Setting, PluginSettingTab, createEl & co.)
function settingsPage(src) {
  for (const [name, tag] of [['createEl', null], ['createDiv', 'div'], ['createSpan', 'span']]) {
    HTMLElement.prototype[name] = function (a, o) {
      const opts = tag ? a : o;
      const e = document.createElement(tag || a);
      if (opts && opts.text) e.textContent = opts.text;
      if (opts && opts.cls) e.className = opts.cls;
      this.appendChild(e);
      return e;
    };
  }
  HTMLElement.prototype.empty = function () { this.replaceChildren(); };
  HTMLElement.prototype.setText = function (t) { this.textContent = t; };
  const control = (kind, el) => {
    const c = { kind, el, value: undefined, cb: null, options: [] };
    c.setValue = (v) => { c.value = v; return c; };
    c.onChange = c.onClick = (f) => { c.cb = f; return c; };
    c.addOption = (v) => { c.options.push(v); return c; };
    for (const m of ['setLimits', 'setDynamicTooltip', 'setPlaceholder', 'setButtonText', 'setWarning', 'setIcon', 'setTooltip']) c[m] = () => c;
    return c;
  };
  class Setting {
    constructor(container) {
      this.settingEl = container.createDiv({ cls: 'setting-item' });
      this.nameEl = this.settingEl.createDiv({ cls: 'name' });
      this.descEl = this.settingEl.createDiv({ cls: 'desc' });
      this.controlEl = this.settingEl.createDiv({ cls: 'control' });
      this.controls = [];
      Setting.all.push(this);
    }
    setName(n) { this.nameEl.textContent = n; return this; }
    setDesc(d) { this.descEl.textContent = d; return this; }
    setHeading() { this.settingEl.classList.add('heading'); return this; }
    add(kind, f) { const c = control(kind, this.controlEl.createDiv({ cls: kind })); f(c); this.controls.push(c); return this; }
    addToggle(f) { return this.add('toggle', f); } addSlider(f) { return this.add('slider', f); } addText(f) { return this.add('text', f); }
    addColorPicker(f) { return this.add('color', f); } addButton(f) { return this.add('button', f); } addExtraButton(f) { return this.add('extra', f); }
    addDropdown(f) { return this.add('dropdown', f); }
  }
  Setting.all = [];
  class PluginSettingTab { constructor(app, plugin) { this.app = app; this.plugin = plugin; this.containerEl = document.getElementById('settings'); } }
  let saved = {};
  class Plugin {
    constructor() { this.app = { workspace: { on: () => ({}), getLeavesOfType: () => [] } }; this.manifest = { version: 'test' }; }
    loadData() { return Promise.resolve(saved); } saveData(d) { saved = JSON.parse(JSON.stringify(d)); return Promise.resolve(); }
    addSettingTab(t) { this.tab = t; } addCommand() {} registerEvent() {} register() {} registerDomEvent() {} registerInterval() {} registerMarkdownPostProcessor() {} registerEditorExtension() {}
  }
  const module = { exports: {} };
  new Function('require', 'module', src)(() => ({ Plugin, Notice: class {}, PluginSettingTab, Setting }), module);
  const plugin = new module.exports();
  plugin.onload();
  window.ui = { plugin, Setting, saved: () => saved };
}

test('settings page: options, live changes, saving and Reset all', async () => {
  const b = await browser(false);
  const context = await b.newContext({ viewport: { width: 1000, height: 1400 } });
  try {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.setContent(`<style>body{margin:0}</style><style>${CSS}</style><body class="theme-light">
      <div class="markdown-reading-view"><div class="markdown-preview-view markdown-rendered lined-paper cornell"><div class="markdown-preview-sizer markdown-preview-section">
      <div><h1>T</h1></div><div><blockquote><div class="callout" data-callout="cue"><div class="callout-content"><p>cue</p></div></div><div class="callout" data-callout="notes"><div class="callout-content"><p>notes</p></div></div></blockquote></div>
      </div></div></div><div id="settings"></div></body>`);
    await page.evaluate(settingsPage, MAIN);
    const r = await page.evaluate(async () => {
      const { plugin, Setting } = window.ui;
      await new Promise((res) => setTimeout(res, 50));
      plugin.tab.display();
      const find = (name) => Setting.all.filter((s) => s.nameEl.textContent === name).pop();
      const view = document.querySelector('.markdown-preview-view');
      const cue = () => getComputedStyle(view).getPropertyValue('--cue').trim();
      const out = {
        intro: document.querySelector('#settings p').textContent,
        sections: Setting.all.filter((s) => s.settingEl.classList.contains('heading')).map((s) => s.nameEl.textContent),
        shown: Setting.all.length,
        cueBefore: cue(),
      };
      await find('Cue column width').controls[0].cb(0.4);
      out.cueAfter = cue();
      out.savedCue = window.ui.saved()['cn-cue'];
      await find('A4 pages in reading view').controls[0].cb(false);
      out.noPages = document.body.classList.contains('lp-no-pages');
      const font = find('Handwriting font');
      out.fonts = font.controls[0].options.length;
      await font.controls[0].cb('Indie Flower');
      out.font = getComputedStyle(view.querySelector('p')).fontFamily.split(',')[0];
      await find('Underline links').controls[0].cb(true);
      out.underlineClass = document.body.classList.contains('lp-link-underline');
      Setting.all = [];
      plugin.tab.showAdvanced = true;
      plugin.tab.display();
      out.withAdvanced = Setting.all.length;
      await Setting.all.find((s) => s.nameEl.textContent === 'Reset everything').controls[0].cb();
      out.afterReset = { saved: JSON.stringify(window.ui.saved()), noPages: document.body.classList.contains('lp-no-pages'), underline: document.body.classList.contains('lp-link-underline'), cue: cue() };
      return out;
    });
    assert.match(r.intro, /^Lined Paper Pages test\./);
    assert.deepEqual(r.sections, ['Pages and text', 'Cornell notes', 'Callouts', 'Colours', 'Advanced']);
    assert.ok(r.shown >= 30, `${r.shown} settings shown`);
    assert.equal(r.cueAfter, '0.4', 'a change shows straight away');
    assert.equal(r.savedCue, 0.4, 'and is saved');
    assert.ok(r.noPages, 'toggles switch their class');
    assert.ok(r.fonts >= 20, 'the font list');
    assert.equal(r.font, '"Indie Flower"', 'a font is applied');
    assert.ok(r.underlineClass);
    assert.ok(r.withAdvanced > r.shown, 'Advanced shows more settings');
    assert.deepEqual(r.afterReset, { saved: '{}', noPages: false, underline: false, cue: r.cueBefore });
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
});

// Obsidian's reading pane is a fixed-height box and the preview view inside it scrolls: the A4
// pages must not give it a second scroll bar, at any pane width
for (const width of [1000, 700]) {
  test(`reading view in a ${width}px pane has one scroll bar`, async () => {
    const b = await browser(false);
    const context = await b.newContext({ viewport: { width: 1400, height: 800 } });
    try {
      const page = await context.newPage();
      const pane = `.workspace-leaf-content{position:relative;height:600px;width:${width}px;display:flex;flex-direction:column;overflow:hidden}
        .view-content{flex:1 1 auto;height:100%;overflow:hidden;position:relative}
        .markdown-reading-view{width:100%;height:100%}
        .markdown-preview-view{width:100%;height:100%;overflow-y:auto;padding:32px;box-sizing:border-box;position:relative}`;
      await page.setContent(`<style>body{margin:0}</style><style>${pane}</style><style>${CSS}</style><body class="theme-light"><div class="workspace-leaf-content"><div class="view-content">
        <div class="markdown-reading-view"><div class="markdown-preview-view markdown-rendered lined-paper cornell"><div class="markdown-preview-sizer markdown-preview-section">
        <div><h1>Title</h1></div>${'<div><p>text</p></div>'.repeat(60)}</div></div></div></div></div></body>`);
      const r = await page.evaluate(() => {
        const scrolls = (sel) => { const e = document.querySelector(sel); return e.scrollHeight > e.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(e).overflowY); };
        return { viewContent: scrolls('.view-content'), readingView: scrolls('.markdown-reading-view'), previewView: scrolls('.markdown-preview-view') };
      });
      assert.deepEqual(r, { viewContent: false, readingView: false, previewView: true });
    } finally {
      await context.close();
    }
  });
}

// The snippets are part of the plugin now: old ones still switched on would override its newer
// styles, so the plugin switches them off and says so (or, where it can't, says once to do it)
test('old snippets still switched on: switched off, or a one-time hint', async () => {
  const b = await browser(false);
  const context = await b.newContext();
  try {
    const page = await context.newPage();
    await page.setContent('<body></body>');
    const r = await page.evaluate(async (src) => {
      const notices = [];
      let saved = {};
      const snippets = new Set();
      const run = async (enabled, canSwitch) => {
        if (enabled) { snippets.clear(); for (const n of enabled) snippets.add(n); }
        class Plugin {
          constructor() { this.app = { workspace: { on: () => ({}), onLayoutReady: (f) => f(), getLeavesOfType: () => [] }, customCss: { enabledSnippets: snippets, ...(canSwitch ? { setCssEnabledStatus: (n, on) => { if (!on) snippets.delete(n); } } : {}) } }; }
          loadData() { return Promise.resolve(JSON.parse(JSON.stringify(saved))); } saveData(d) { saved = JSON.parse(JSON.stringify(d)); return Promise.resolve(); }
          addSettingTab() {} addCommand() {} registerEvent() {} register() {} registerDomEvent() {} registerInterval() {} registerMarkdownPostProcessor() {} registerEditorExtension() {}
        }
        const module = { exports: {} };
        new Function('require', 'module', src)(() => ({ Plugin, PluginSettingTab: class {}, Setting: class {}, Notice: class { constructor(m) { notices.push(m); } } }), module);
        const plugin = new module.exports();
        plugin.onload();
        await new Promise((res) => setTimeout(res, 50));
        plugin.onunload();
      };
      await run(['other'], true);                          // no old snippets: nothing
      const none = notices.length;
      await run(['other', 'lined-paper', 'cornell-notes'], true);   // old snippets on: switched off
      const left = [...snippets];
      await run(null, true);                                // ... so nothing the next time
      const switched = notices.splice(0);
      await run(['lined-paper', 'cornell-notes'], false);   // can't switch them: one hint
      await run(['lined-paper', 'cornell-notes'], false);   // ... and not again
      return { none, left, switched, notices };
    }, MAIN);
    assert.equal(r.none, 0);
    assert.deepEqual(r.left, ['other']);
    assert.equal(r.switched.length, 1);
    assert.match(r.switched[0], /switched off the old snippets "lined-paper" and "cornell-notes"/);
    assert.equal(r.notices.length, 1);
    assert.match(r.notices[0], /Switch off the snippets "lined-paper" and "cornell-notes"/);
  } finally {
    await context.close();
  }
});
