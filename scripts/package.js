#!/usr/bin/env node
'use strict';
// Builds dist/lined-paper-pages-<version>.zip, laid out the way the files go into a vault:
//   lined-paper-pages/   → <vault>/.obsidian/plugins/lined-paper-pages/
//   snippets/            → <vault>/.obsidian/snippets/
// plus the README, the user docs, the example notes and the licence. No dependencies (a small zip
// writer).
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const ROOT = path.resolve(__dirname, '..');
const { version, minAppVersion, id } = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));

const entries = [
  [`${id}/main.js`, 'main.js'],
  [`${id}/manifest.json`, 'manifest.json'],
  [`${id}/styles.css`, 'styles.css'],
  ['snippets/lined-paper.css', 'snippets/lined-paper.css'],
  ['snippets/cornell-notes.css', 'snippets/cornell-notes.css'],
  ['README.md', 'README.md'],
  ['LICENSE', 'LICENSE'],
  // (the docs the README links to, with their pictures)
  ...['writing-notes.md', 'cornell-note-guide.md', 'settings.md', 'troubleshooting.md', 'images/cornell-light.png', 'images/cornell-dark.png', 'images/lined-paper.png']
    .map((f) => [`docs/${f}`, `docs/${f}`]),
  ...['Cornell notes.md', 'Lined paper.md'].map((f) => [`examples/${f}`, `examples/${f}`]),
];

// ---------- a minimal zip writer (deflate, no extra fields) ----------
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function zip(files) {
  const local = [], central = [];
  let offset = 0;
  const time = 0, date = ((2026 - 1980) << 9) | (1 << 5) | 1;   // fixed timestamp: reproducible builds
  for (const [name, data] of files) {
    const nameBuf = Buffer.from(name, 'utf8');
    const packed = zlib.deflateRawSync(data, { level: 9 });
    const crc = crc32(data);
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0); head.writeUInt16LE(20, 4); head.writeUInt16LE(0x0800, 6); head.writeUInt16LE(8, 8);
    head.writeUInt16LE(time, 10); head.writeUInt16LE(date, 12); head.writeUInt32LE(crc, 14);
    head.writeUInt32LE(packed.length, 18); head.writeUInt32LE(data.length, 22); head.writeUInt16LE(nameBuf.length, 26);
    local.push(head, nameBuf, packed);
    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0); dir.writeUInt16LE(20, 4); dir.writeUInt16LE(20, 6); dir.writeUInt16LE(0x0800, 8); dir.writeUInt16LE(8, 10);
    dir.writeUInt16LE(time, 12); dir.writeUInt16LE(date, 14); dir.writeUInt32LE(crc, 16);
    dir.writeUInt32LE(packed.length, 20); dir.writeUInt32LE(data.length, 24); dir.writeUInt16LE(nameBuf.length, 28);
    dir.writeUInt32LE(offset, 42);
    central.push(dir, nameBuf);
    offset += head.length + nameBuf.length + packed.length;
  }
  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, centralBuf, end]);
}

const out = path.join(ROOT, 'dist', `${id}-${version}.zip`);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, zip(entries.map(([name, src]) => [name, fs.readFileSync(path.join(ROOT, src))])));
console.log(`${path.relative(ROOT, out)} (${entries.length} files, Obsidian ${minAppVersion}+)`);
