#!/usr/bin/env node
'use strict';
// Checks that need no browser: the plugin parses, the JSON files are valid, every version number
// agrees, the stylesheets' braces balance, and the changelog has an entry for this version.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const problems = [];
const check = (ok, message) => { if (!ok) problems.push(message); };

// main.js is valid JavaScript (it is loaded as-is by Obsidian: no build step)
try { new vm.Script(read('main.js'), { filename: 'main.js' }); } catch (e) { problems.push(`main.js: ${e.message}`); }

// JSON files
const json = {};
for (const f of ['manifest.json', 'versions.json', 'package.json']) {
  try { json[f] = JSON.parse(read(f)); } catch (e) { problems.push(`${f}: ${e.message}`); }
}

// versions agree
const { manifest = {}, versions = {}, pkg = {} } = { manifest: json['manifest.json'], versions: json['versions.json'], pkg: json['package.json'] };
check(manifest.version === pkg.version, `manifest.json version ${manifest.version} ≠ package.json version ${pkg.version}`);
check(versions[manifest.version] === manifest.minAppVersion, `versions.json has no entry "${manifest.version}": "${manifest.minAppVersion}"`);
check(/^\d+\.\d+\.\d+$/.test(manifest.version || ''), 'manifest.json version is not x.y.z');
for (const key of ['id', 'name', 'version', 'minAppVersion', 'description', 'author', 'isDesktopOnly']) check(key in manifest, `manifest.json has no "${key}"`);
check(read('CHANGELOG.md').includes(`## [${manifest.version}]`), `CHANGELOG.md has no section for ${manifest.version}`);

// stylesheets: balanced braces and comments (a stray one silently drops the rules after it)
for (const f of ['styles.css', 'snippets/lined-paper.css', 'snippets/cornell-notes.css']) {
  const css = read(f);
  const opened = (css.match(/\/\*/g) || []).length, closed = (css.match(/\*\//g) || []).length;
  check(opened === closed, `${f}: ${opened} comments opened, ${closed} closed`);
  const code = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, '""');
  let depth = 0, line = 1;
  for (const ch of code) {
    if (ch === '\n') line++;
    if (ch === '{') depth++;
    if (ch === '}' && --depth < 0) { problems.push(`${f}: unexpected } near line ${line}`); depth = 0; }
  }
  check(depth === 0, `${f}: ${depth} unclosed {`);
}

if (problems.length) {
  console.error(problems.map((p) => '✖ ' + p).join('\n'));
  process.exit(1);
}
console.log(`✔ lint passed (version ${manifest.version})`);
