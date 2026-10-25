#!/usr/bin/env node
'use strict';
// Renders the screenshots in docs/images (used by the README) from the showcase test notes, with
// the real handwriting fonts (downloaded from Google Fonts, so this needs a network connection).
const fs = require('node:fs');
const path = require('node:path');
const { openReading, closeBrowsers } = require('../tests/lib/harness');
const { note } = require('../tests/lib/notes');

const OUT = path.resolve(__dirname, '..', 'docs', 'images');
const shots = [
  ['cornell-light.png', 'showcase', 'theme-light'],
  ['cornell-dark.png', 'showcase', 'theme-dark'],
  ['lined-paper.png', 'showcasePlain', 'theme-light'],
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const [file, name, theme] of shots) {
    const { page, context } = await openReading(note(name), { theme, fonts: true, dpr: 2, viewport: { width: 900, height: 1300 } });
    await page.waitForTimeout(600);
    const sheet = await page.evaluate(() => {
      const view = document.querySelector('.markdown-preview-view');
      const s = view.querySelector('.markdown-preview-sizer').getBoundingClientRect();
      const d = document.createElement('div'); d.style.cssText = 'position:absolute;height:var(--sheet-h)'; view.appendChild(d);
      const h = d.getBoundingClientRect().height; d.remove();
      return { x: s.left, y: s.top, width: s.width, height: h };
    });
    // the sheet with a little of the desk around it
    await page.screenshot({ path: path.join(OUT, file), clip: { x: sheet.x - 16, y: sheet.y - 16, width: sheet.width + 32, height: sheet.height + 32 } });
    await context.close();
    console.log('docs/images/' + file);
  }
  await closeBrowsers();
})();
