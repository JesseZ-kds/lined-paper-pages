// Stand-ins for the parts of Obsidian the study features use: Modal, ItemView, requestUrl (a function
// the test sets, window.__request), an editor over a string, and a vault in memory.
const { MAIN } = require('./harness');
const SRC = `const __require = require;
require = (n) => (n !== 'obsidian' ? __require(n) : Object.assign({}, __require(n), {
  Modal: class { constructor(app) { this.app = app; this.modalEl = document.createElement('div'); this.modalEl.className = 'modal'; this.titleEl = document.createElement('div'); this.titleEl.setText = (t) => { this.titleEl.textContent = t; }; this.modalEl.addClass = (c) => this.modalEl.classList.add(c); this.contentEl = document.createElement('div'); this.modalEl.append(this.titleEl, this.contentEl); }
    open() { document.body.appendChild(this.modalEl); } close() { this.modalEl.remove(); if (this.onClose) this.onClose(); } },
  ItemView: class { constructor(leaf) { this.leaf = leaf; this.contentEl = document.createElement('div'); } },
  requestUrl: async (o) => { const r = await window.__request(o); return { status: r.status || 200, get json() { return typeof r.body === 'string' ? JSON.parse(r.body) : r.body; }, text: typeof r.body === 'string' ? r.body : JSON.stringify(r.body) }; },
}));
` + MAIN;
const FAKES = `
  window.makeVault = (plugin, files) => {
    const vault = { files: {} };
    const add = (path, text) => { const dir = path.includes('/') ? path.replace(/\\/[^/]*$/, '') : '/'; vault.files[path] = { path, text, basename: path.replace(/^.*\\//, '').replace(/\\.md$/, ''), extension: 'md', parent: { path: dir } }; return vault.files[path]; };
    for (const [p, t] of Object.entries(files)) add(p, t);
    const open = [];
    Object.assign(vault, {
      getAbstractFileByPath: (p) => vault.files[p] || (Object.keys(vault.files).some((f) => f.startsWith(p + '/')) ? { path: p } : null),
      cachedRead: async (f) => vault.files[f.path].text, read: async (f) => vault.files[f.path].text,
      modify: async (f, t) => { vault.files[f.path].text = t; }, create: async (p, t) => add(p, t), createFolder: async () => {},
      process: async (f, fn) => { vault.files[f.path].text = fn(vault.files[f.path].text); },
      getMarkdownFiles: () => Object.values(vault.files), trash: async (f) => { delete vault.files[f.path]; },
    });
    plugin.app.vault = vault;
    plugin.app.metadataCache = {
      getFileCache: (f) => { const t = vault.files[f.path] && vault.files[f.path].text; const m = t && /^---\\n([\\s\\S]*?)\\n---/.exec(t); if (!m) return {}; const fm = {}; for (const l of m[1].split('\\n')) { const x = /^([\\w-]+):\\s*(.*)$/.exec(l); if (x) fm[x[1]] = x[2] === 'true' ? true : x[2]; } return { frontmatter: fm }; },
      getFirstLinkpathDest: (link) => Object.values(vault.files).find((f) => f.basename.toLowerCase() === link.toLowerCase()) || null,
    };
    Object.assign(plugin.app.workspace, {
      getLeaf: () => ({ openFile: async (f) => { open.push(f.path); } }),
      getLeavesOfType: (t) => (t === 'markdown' ? open.map((p) => ({ view: { file: { path: p } } })) : []),
      getActiveFile: () => null,
    });
    plugin.saveData = async () => {};
    return { vault, open };
  };
  // an editor over a string: the selection from / to ({ line, ch })
  window.makeEditor = (text, from, to) => {
    const e = { text, from: from || { line: 0, ch: 0 }, to: to || from || { line: 0, ch: 0 } };
    const lines = () => e.text.split('\\n');
    const off = (p) => lines().slice(0, p.line).reduce((n, l) => n + l.length + 1, 0) + p.ch;
    const pos = (o) => { const b = e.text.slice(0, o).split('\\n'); return { line: b.length - 1, ch: b[b.length - 1].length }; };
    Object.assign(e, {
      getValue: () => e.text, getLine: (l) => lines()[l], lineCount: () => lines().length,
      getSelection: () => e.text.slice(off(e.from), off(e.to)),
      getCursor: (w) => (w === 'from' ? e.from : w === 'to' ? e.to : e.to),
      replaceRange: (t, a, b) => { const x = off(a), y = off(b || a); e.text = e.text.slice(0, x) + t + e.text.slice(y); e.from = e.to = pos(x + t.length); },
      replaceSelection: (t) => { const x = off(e.from); e.text = e.text.slice(0, x) + t + e.text.slice(off(e.to)); e.from = e.to = pos(x + t.length); },
      setSelection: (a, h) => { e.from = a; e.to = h || a; }, setCursor: (p) => { e.from = e.to = p; },
    });
    return e;
  };
`;
module.exports = { SRC, FAKES };
