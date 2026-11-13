---
name: cheap-eyes
description: Check a web page for the bugs a user hits in the first minute (sideways scroll on phone, cut-off text, buttons covered by banners, 404 images, JS crashes, failing API calls, dead links, unlabeled icons, tiny tap targets, faint text, one-word last lines) and get them back as text. Use after any change to a page, landing, dashboard or web app, before saying it is done, and instead of opening screenshots in the main session.
---

# cheap-eyes

Screenshots are the expensive way to look at a page. Each image costs about 1,000 to 1,600 input tokens, and once it is read in the main session it stays in the history and goes out again with every later message. Most of what a screenshot shows can be measured as text.

## Rules

1. **Measure first, look last.** Run the checker. Fix what it reports. Run it again.
2. **Never Read an image in the main session.** If something still needs eyes, hand it to the `cheap-eyes:visual-checker` subagent. It opens the crops, answers in text, and the images die with it.
3. **Do not hide results.** Report what the checker found, including what you did not fix. A finding you think is wrong is reported as "disputed", with the reason, not dropped.

## Step 1: run the checker

```sh
node ${CLAUDE_PLUGIN_ROOT}/skills/cheap-eyes/scripts/check.cjs <url> [more urls] --widths 390,1280
```

- Needs Playwright: `npm i -D playwright && npx playwright install chromium`, or `PLAYWRIGHT=/path/to/node_modules/playwright`.
- Local dev server: pass its URL (`http://localhost:3000/...`). Pages behind login: run against a demo account, never against production data.
- `--json` gives every finding. Text mode groups repeats ("...and 20 more like these").
- Exit code 0 = clean, 1 = findings, 2 = could not run.

What it catches: `overflow`, `clipped-text`, `covered`, `broken-image`, `http-4xx/5xx`, `request-failed`, `js-error`, `console-error`, `dead-link`, `no-name`, `tiny-target`, `low-contrast`, `orphan-word`, `blank`.

What it does not catch: wrong numbers, wrong copy, broken flows (login, checkout, forms that submit to the wrong place), and "this looks ugly". Flows need a real test (Playwright Test clicking through the flow). Taste needs step 2.

## Step 2: only if a human-eye question is left

Use it for a new visual change (a new section, a new layout), or for a finding you cannot judge from text. Run the checker with crops, then spawn the subagent:

```sh
node ${CLAUDE_PLUGIN_ROOT}/skills/cheap-eyes/scripts/check.cjs <url> --crops /tmp/cheap-eyes-crops
```

Spawn `cheap-eyes:visual-checker` with: the URL, what changed, the crop paths you care about, and the question ("is the new pricing card aligned with the others at 390px?"). It answers in at most 10 lines. Do not ask it to send images back.

## Reporting

One line per real problem, with the selector and width. Then what you fixed and what is still open.
