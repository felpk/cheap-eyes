// Baseline for the token benchmark: the usual way, full-page screenshots for the model to look at.
// Usage: node bench/shot.cjs <url> <out dir>   -> <out>/390.png and <out>/1280.png
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const path = require('node:path');
const [url, out] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch();
  for (const width of [390, 1280]) {
    const p = await b.newPage({ viewport: { width, height: width === 390 ? 844 : 900 } });
    await p.goto(url, { waitUntil: 'networkidle' });
    await p.screenshot({ path: path.join(out, `${width}.png`), fullPage: true });
    console.log(path.join(out, `${width}.png`));
  }
  await b.close();
})();
