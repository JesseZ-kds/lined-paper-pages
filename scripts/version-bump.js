#!/usr/bin/env node
'use strict';
// Run by `npm version <patch|minor|major>`: copies the new version from package.json into
// manifest.json, and records which Obsidian version it needs in versions.json.
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const file = (f) => path.join(ROOT, f);
const version = process.env.npm_package_version || require(file('package.json')).version;

const manifest = JSON.parse(fs.readFileSync(file('manifest.json'), 'utf8'));
manifest.version = version;
fs.writeFileSync(file('manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

const versions = JSON.parse(fs.readFileSync(file('versions.json'), 'utf8'));
versions[version] = manifest.minAppVersion;
fs.writeFileSync(file('versions.json'), JSON.stringify(versions, null, 2) + '\n');

console.log(`manifest.json and versions.json set to ${version} (Obsidian ${manifest.minAppVersion}+)`);
