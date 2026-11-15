// Runs check.cjs against the fixture with planted bugs and against a clean page.
// Prints which planted bugs were caught, which were missed, and false alarms on the clean page.
// Usage: node bench/score.cjs     (set PLAYWRIGHT=/path/to/playwright if it is not installed here)
'use strict';
const { execFile } = require('node:child_process');
const path = require('node:path'), fs = require('node:fs');
const { start } = require('./serve.cjs');
const CHECK = path.join(__dirname, '..', 'skills', 'claude-visual-check-no-images', 'scripts', 'check.cjs');

const has = (i, s) => JSON.stringify(i).includes(s);
// Each planted bug in fixtures/bugs.html, and how to recognise it in the report.
const PLANTED = [
  ['bug-overflow', 'box 620px wide on a 390px phone', (i) => i.kind === 'overflow' && has(i, 'bug-overflow')],
  ['bug-clipped', 'button label cut off', (i) => i.kind === 'clipped-text' && has(i, 'bug-clipped')],
  ['bug-covered', 'cookie bar covers the checkout button', (i) => i.kind === 'covered' && has(i, 'bug-covered')],
  ['bug-img', 'product image 404', (i) => has(i, 'bug-img-missing')],
  ['bug-js', 'JS crash on load', (i) => i.kind === 'js-error' && has(i, 'carrinho')],
  ['bug-link', 'dead link in the menu', (i) => i.kind === 'dead-link' && has(i, 'bug-link-dead')],
  ['bug-noname', 'icon button with no label', (i) => i.kind === 'no-name' && has(i, 'bug-noname')],
  ['bug-tiny', 'close button 14x14px', (i) => i.kind === 'tiny-target' && has(i, 'bug-tiny')],
  ['bug-fetch', 'API call answers 500', (i) => has(i, 'bug-fetch')],
  ['bug-contrast', 'light grey text on white', (i) => has(i, 'bug-contrast')],
  ['bug-logic', 'cart total is wrong (10 + 5 = 20)', (i) => has(i, 'bug-logic')],
  ['bug-orphan', 'heading ends with one word alone', (i) => has(i, 'bug-orphan')],
];

// Async on purpose: the fixture server lives in this same process.
const run = (url) => new Promise((ok, fail) => execFile('node', [CHECK, url, '--json'], { encoding: 'utf8', maxBuffer: 1 << 24 }, (e, out, err) => {
  if (e && e.code !== 1) return fail(new Error(err || e.message));
  ok(JSON.parse(out));
}));

(async () => {
  const { srv, base } = await start();
  try {
    const bugs = await run(base + '/bugs.html');
    const clean = await run(base + '/clean.html');
    const issues = bugs.report.flatMap((r) => r.issues.map((i) => ({ ...i, width: r.width })));
    const rows = PLANTED.map(([id, what, test]) => {
      const hits = issues.filter(test);
      return { id, what, caught: hits.length > 0, widths: [...new Set(hits.map((h) => h.width))] };
    });
    const caught = rows.filter((r) => r.caught).length;
    const matched = new Set(issues.filter((i) => PLANTED.some(([, , t]) => t(i))));
    const unexplained = issues.filter((i) => !matched.has(i));
    const falseAlarms = clean.report.flatMap((r) => r.issues.map((i) => ({ ...i, width: r.width })));

    for (const r of rows) console.log(`${r.caught ? 'CAUGHT' : 'MISSED'}  ${r.id.padEnd(13)} ${r.what}${r.caught ? `  (@ ${r.widths.join(', ')}px)` : ''}`);
    console.log(`\nPlanted bugs caught: ${caught} of ${rows.length}`);
    console.log(`Other reports on the buggy page (not one of the planted bugs): ${unexplained.length}`);
    for (const u of unexplained) console.log(`  @${u.width} [${u.kind}] ${u.msg}`);
    console.log(`False alarms on the clean page: ${falseAlarms.length}`);
    for (const f of falseAlarms) console.log(`  @${f.width} [${f.kind}] ${f.msg}`);

    fs.mkdirSync(path.join(__dirname, 'results'), { recursive: true });
    fs.writeFileSync(path.join(__dirname, 'results', 'score.json'), JSON.stringify({ caught, total: rows.length, rows, unexplained, falseAlarms }, null, 1) + '\n');
  } finally { srv.close(); }
})().catch((e) => { console.error(e); process.exit(2); });
