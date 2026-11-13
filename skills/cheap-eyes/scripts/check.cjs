#!/usr/bin/env node
// cheap-eyes: finds the bugs a user would hit in the first minute, and reports them as text.
// Usage: node check.cjs <url> [more urls] [--widths 390,1280] [--crops <dir>] [--json] [--links 40]
// Exit code: 0 = nothing found, 1 = issues found, 2 = could not run.
'use strict';

function loadPlaywright() {
  const tries = [process.env.PLAYWRIGHT, 'playwright', 'playwright-core', '@playwright/test'].filter(Boolean);
  for (const t of tries) { try { return require(t); } catch {} }
  console.error('cheap-eyes: Playwright not found. Run `npm i -D playwright && npx playwright install chromium`,\n' +
    'or point PLAYWRIGHT=/path/to/node_modules/playwright.');
  process.exit(2);
}

const args = process.argv.slice(2);
const opt = { widths: [390, 1280], crops: null, json: false, links: 40, urls: [] };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--widths') opt.widths = args[++i].split(',').map(Number);
  else if (a === '--crops') opt.crops = args[++i];
  else if (a === '--json') opt.json = true;
  else if (a === '--links') opt.links = Number(args[++i]);
  else if (a === '-h' || a === '--help') { console.log('node check.cjs <url>... [--widths 390,1280] [--crops dir] [--json] [--links 40]'); process.exit(0); }
  else opt.urls.push(a);
}
if (!opt.urls.length) { console.error('cheap-eyes: pass at least one URL'); process.exit(2); }

// Runs inside the page. Returns layout/usability problems found in the DOM.
function inspectDom(width) {
  const out = [];
  let n = 0;
  const vw = document.documentElement.clientWidth;
  const sel = (el) => {
    if (el.id) return `#${el.id}`;
    let s = el.tagName.toLowerCase();
    const cls = [...el.classList].slice(0, 2).join('.');
    if (cls) s += '.' + cls;
    const p = el.parentElement;
    if (p) { const sib = [...p.children].filter((c) => c.tagName === el.tagName); if (sib.length > 1) s += `:nth-of-type(${sib.indexOf(el) + 1})`; }
    const ctx = el.parentElement && el.parentElement.closest('[id]');
    return ctx ? `#${ctx.id} ${s}` : s;
  };
  const text = (el) => (el.innerText || el.getAttribute('aria-label') || el.getAttribute('title') || '').trim().replace(/\s+/g, ' ').slice(0, 50);
  const visible = (el) => {
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0;
  };
  const mark = (el) => { const id = 'ce' + (n++); el.setAttribute('data-cheap-eyes', id); return id; };
  const scrollsX = (el) => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') return true; } return false; };
  const all = [...document.body.querySelectorAll('*')].filter((el) => !['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'].includes(el.tagName));

  // 1. Page is wider than the screen (sideways scroll on phone).
  if (document.documentElement.scrollWidth > vw + 1) {
    const culprits = all.filter((el) => visible(el) && el.getBoundingClientRect().right > vw + 1 && !scrollsX(el))
      .filter((el, _, arr) => !arr.some((o) => o !== el && o.contains(el))) // outermost only
      .slice(0, 5);
    out.push({ kind: 'overflow', msg: `page is ${document.documentElement.scrollWidth}px wide on a ${vw}px screen`, items: culprits.map((el) => ({ sel: sel(el), right: Math.round(el.getBoundingClientRect().right), crop: mark(el) })) });
  }
  // 2. Text cut off by its own box.
  for (const el of all) {
    if (!visible(el) || !el.innerText || !el.innerText.trim() || el.children.length > 3) continue;
    const cs = getComputedStyle(el);
    if (cs.textOverflow === 'ellipsis' || cs.webkitLineClamp !== 'none' && cs.webkitLineClamp) continue; // truncation on purpose
    const hidesX = ['hidden', 'clip'].includes(cs.overflowX);
    const hidesY = ['hidden', 'clip'].includes(cs.overflowY);
    if ((hidesX && el.scrollWidth > el.clientWidth + 1) || (hidesY && el.scrollHeight > el.clientHeight + 2))
      out.push({ kind: 'clipped-text', msg: `text cut off: "${text(el)}"`, items: [{ sel: sel(el), crop: mark(el) }] });
  }
  // 3. Images that did not load.
  for (const img of document.images) if (img.complete && img.naturalWidth === 0 && visible(img))
    out.push({ kind: 'broken-image', msg: `image did not load: ${img.getAttribute('src')}`, items: [{ sel: sel(img), crop: mark(img) }] });

  const clickables = all.filter((el) => el.matches('a[href], button, input:not([type=hidden]), select, textarea, [role=button], [onclick]') && visible(el));
  for (const el of clickables) {
    const r = el.getBoundingClientRect();
    // 4. Something else sits on top of the control, so a tap hits the wrong thing.
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    // Skip controls whose centre is scrolled out of a scrolling row (carousels): nothing covers them, you scroll to them.
    const inView = (() => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const cs = getComputedStyle(p); if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') { const b = p.getBoundingClientRect(); if (cx < b.left || cx > b.right || cy < b.top || cy > b.bottom) return false; } } return true; })();
    if (inView && cx >= 0 && cy >= 0 && cx < vw && cy < innerHeight) {
      const top = document.elementFromPoint(cx, cy);
      const pinned = (x) => { for (let p = x; p && p !== document.body; p = p.parentElement) if (['fixed', 'sticky'].includes(getComputedStyle(p).position)) return true; return false; };
      // A fixed header over content that scrolls is normal; a fixed thing over another fixed thing never moves away.
      if (top && top !== el && !el.contains(top) && !top.contains(el) && !(pinned(top) && !pinned(el)))
        out.push({ kind: 'covered', msg: `"${text(el) || sel(el)}" is covered by ${sel(top)}: a tap hits the wrong element`, items: [{ sel: sel(el), crop: mark(el) }] });
    }
    // 5. Control with no name (icon-only button, empty link).
    const named = text(el) || el.getAttribute('aria-labelledby') || el.querySelector('img[alt]:not([alt=""])') || (el.labels && el.labels.length) || el.getAttribute('placeholder') || el.value;
    if (!named) out.push({ kind: 'no-name', msg: `${el.tagName.toLowerCase()} has no text or label (screen readers say nothing)`, items: [{ sel: sel(el), crop: mark(el) }] });
    // 6. Tap target too small on phone.
    if (width <= 480 && !el.matches('input[type=checkbox], input[type=radio]') && r.width < 24 && r.height < 24)
      out.push({ kind: 'tiny-target', msg: `"${text(el) || sel(el)}" is ${Math.round(r.width)}x${Math.round(r.height)}px, too small to tap (min 24x24)`, items: [{ sel: sel(el), crop: mark(el) }] });
  }
  // 7. Text too faint to read (WCAG AA contrast).
  const rgba = (c) => { const m = c.match(/[\d.]+/g); return m ? m.map(Number).concat(m.length === 3 ? [1] : []) : [0, 0, 0, 0]; };
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const bgOf = (el) => { for (let p = el; p; p = p.parentElement) { const cs = getComputedStyle(p); if (cs.backgroundImage !== 'none') return null; const c = rgba(cs.backgroundColor); if (c[3] > 0.9) return c; } return [255, 255, 255, 1]; };
  for (const el of all) {
    const own = [...el.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim());
    if (!own || !visible(el)) continue;
    const cs = getComputedStyle(el), fg = rgba(cs.color), bg = bgOf(el);
    if (!bg || fg[3] < 0.5) continue;
    const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x), ratio = (a + 0.05) / (b + 0.05);
    const size = parseFloat(cs.fontSize), large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700);
    if (ratio < (large ? 3 : 4.5)) out.push({ kind: 'low-contrast', msg: `"${text(el)}" has contrast ${ratio.toFixed(1)}:1 (needs ${large ? 3 : 4.5}:1)`, items: [{ sel: sel(el), crop: mark(el) }] });
  }
  // 8. Heading whose last line is a single word.
  for (const h of document.querySelectorAll('h1, h2, h3')) {
    if (!visible(h)) continue;
    const tops = [];
    const walker = document.createTreeWalker(h, NodeFilter.SHOW_TEXT);
    for (let t; (t = walker.nextNode());) {
      const re = /\S+/g; let m;
      while ((m = re.exec(t.textContent))) { const r = document.createRange(); r.setStart(t, m.index); r.setEnd(t, m.index + m[0].length); const rect = r.getClientRects()[0]; if (rect && rect.width) tops.push(rect); }
    }
    // Words belong to the same line when their vertical centres are within half a line of each other.
    const lines = [];
    for (const r of tops) { const c = r.top + r.height / 2, l = lines.find((x) => Math.abs(x.c - c) < r.height / 2); if (l) l.n++; else lines.push({ c, n: 1 }); }
    lines.sort((a, b) => a.c - b.c);
    if (lines.length > 1 && lines[lines.length - 1].n === 1)
      out.push({ kind: 'orphan-word', msg: `heading "${text(h)}" ends with one word alone on the last line`, items: [{ sel: sel(h), crop: mark(h) }] });
  }
  // 9. Blank page.
  if ((document.body.innerText || '').trim().length < 20 && !document.querySelector('img, svg, canvas, video'))
    out.push({ kind: 'blank', msg: 'page is blank or almost empty' });
  const links = [...document.querySelectorAll('a[href]')].map((a) => a.href).filter((h) => h.startsWith(location.origin) && !h.includes('#') && !/logout|sair|signout/i.test(h));
  return { issues: out, links: [...new Set(links)] };
}

(async () => {
  const { chromium } = loadPlaywright();
  const fs = require('node:fs'), path = require('node:path');
  const browser = await chromium.launch();
  const report = [];
  for (const [ui, url] of opt.urls.entries()) {
    const checkedLinks = new Set();
    for (const width of opt.widths) {
      // A network blip on the machine running the check is not a bug in the page: load again once.
      let ctx, page, issues;
      for (let attempt = 0; attempt < 2; attempt++) {
        if (ctx) await ctx.close();
        ctx = await browser.newContext({ viewport: { width, height: width <= 480 ? 844 : 900 }, deviceScaleFactor: 1 });
        page = await ctx.newPage();
        const found = (issues = []);
        // "Failed to load resource" repeats what the response handler already reports with the URL.
        page.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) found.push({ kind: 'console-error', msg: m.text().slice(0, 200) }); });
        page.on('pageerror', (e) => found.push({ kind: 'js-error', msg: String(e.message || e).slice(0, 200) }));
        page.on('response', (r) => { if (r.status() >= 400) found.push({ kind: 'http-' + r.status(), msg: `${r.request().method()} ${r.url()} -> ${r.status()}` }); });
        // ERR_ABORTED = the page itself cancelled it (navigation, closed stream); not a bug.
        page.on('requestfailed', (r) => { const f = r.failure() && r.failure().errorText; if (!/ERR_ABORTED/.test(f)) found.push({ kind: 'request-failed', msg: `${r.url()} -> ${f}` }); });
        try { await page.goto(url, { waitUntil: 'load', timeout: 30000 }); }
        catch (e) { found.push({ kind: 'load-failed', msg: String(e.message).split('\n')[0] }); }
        // Live connections (SSE, websockets) keep the network busy forever, so networkidle is a hint, not a gate.
        await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
        // Apps that render after fetching data: wait until the page stops changing (up to 8s).
        let last = -1;
        for (let t = 0; t < 16; t++) {
          const size = await page.evaluate(() => document.body ? document.body.querySelectorAll('*').length + document.body.innerText.length : 0).catch(() => 0);
          if (size === last && size > 0) break;
          last = size; await page.waitForTimeout(500);
        }
        if (!found.some((i) => /ERR_NETWORK_CHANGED|ERR_INTERNET_DISCONNECTED/.test(i.msg))) break;
      }
      let dom = { issues: [], links: [] };
      try { dom = await page.evaluate(inspectDom, width); } catch (e) { issues.push({ kind: 'inspect-failed', msg: String(e.message).split('\n')[0] }); }
      issues.push(...dom.issues);
      // Dead internal links (checked once per URL, not per width).
      for (const href of dom.links.filter((h) => !checkedLinks.has(h)).slice(0, opt.links)) {
        checkedLinks.add(href);
        try { const r = await ctx.request.get(href, { timeout: 10000, maxRedirects: 5 }); if (r.status() >= 400) issues.push({ kind: 'dead-link', msg: `link ${href} -> ${r.status()}` }); }
        catch (e) { issues.push({ kind: 'dead-link', msg: `link ${href} -> ${String(e.message).split('\n')[0]}` }); }
      }
      if (opt.crops) {
        fs.mkdirSync(opt.crops, { recursive: true });
        for (const is of issues) for (const it of is.items || []) {
          if (!it.crop) continue;
          const file = path.join(opt.crops, `p${ui + 1}-${width}-${it.crop}.png`);
          try { await page.locator(`[data-cheap-eyes="${it.crop}"]`).first().screenshot({ path: file, timeout: 3000 }); it.crop = file; } catch { delete it.crop; }
        }
      }
      for (const is of issues) for (const it of is.items || []) if (!opt.crops) delete it.crop;
      // Same message at the same width counts once.
      // Still failing after a reload = the check machine's network, not the page. Left out.
      const seen = new Set();
      report.push({ url, width, issues: issues.filter((i) => {
        if (/ERR_NETWORK_CHANGED|ERR_INTERNET_DISCONNECTED/.test(i.msg)) return false;
        const k = i.kind + i.msg; if (seen.has(k)) return false; seen.add(k); return true;
      }) });
      await ctx.close();
    }
  }
  await browser.close();

  const total = report.reduce((s, r) => s + r.issues.length, 0);
  if (opt.json) console.log(JSON.stringify({ total, report }, null, 1));
  else {
    for (const r of report) {
      console.log(`${r.url} @ ${r.width}px: ${r.issues.length ? r.issues.length + ' issue(s)' : 'ok'}`);
      // Many of the same kind (30 faint labels) read as one problem: show 3, count the rest.
      const byKind = {};
      for (const i of r.issues) (byKind[i.kind] = byKind[i.kind] || []).push(i);
      for (const [kind, list] of Object.entries(byKind)) {
        for (const i of list.slice(0, 3)) {
          console.log(`  [${kind}] ${i.msg}`);
          for (const it of i.items || []) console.log(`      at ${it.sel}${it.crop ? '  crop: ' + it.crop : ''}`);
        }
        if (list.length > 3) console.log(`  [${kind}] ...and ${list.length - 3} more like these (--json lists all)`);
      }
    }
    console.log(total ? `\n${total} issue(s).` : '\nNo issues found.');
  }
  process.exit(total ? 1 : 0);
})().catch((e) => { console.error('cheap-eyes:', e.message); process.exit(2); });
