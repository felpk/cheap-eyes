---
name: claude-visual-check-no-images
description: Check a web page for the bugs a user hits in the first minute (sideways scroll on phone, cut-off text, buttons covered by banners, 404 images, JS crashes, failing API calls, dead links, unlabeled icons, tiny tap targets, faint text, one-word last lines) and get them back as text. Use after any change to a page, landing, dashboard or web app, before saying it is done, and instead of opening screenshots in the main session.
---

# claude-visual-check-no-images

Screenshots are the expensive way to look at a page. Each image costs about 1,000 to 1,600 input tokens, and once it is read in the main session it stays in the history and goes out again with every later message. Most of what a screenshot shows can be measured as text.

## Rules

1. **Measure first, look last.** Run the checker. Fix what it reports. Run it again. This holds even when you wrote your own flow test: the flow test checks behavior, the checker checks what a user sees, and it is the cheapest of the three.
2. **Never Read an image in the main session.** If something still needs eyes, hand it to the `claude-visual-check-no-images:visual-checker` subagent. It opens the crops, answers in text, and the images die with it.
3. **One subagent call per round.** Each call to the visual-checker has a fixed cost of roughly 15k to 20k tokens before it opens any image. Put every crop and question for this round in a single call. Never spawn one call per image or per width.
4. **Crops, never long full pages.** A full-page shot of a long page gets shrunk before the model sees it (a 390px page 3,000px tall loses about 4x), so text can't be read and the call is wasted. Use `--shot` to crop the parts that changed; tall parts come out in slices.
5. **Do not hide results.** Report what the checker found, including what you did not fix. A finding you think is wrong is reported as "disputed", with the reason, not dropped.

## Step 1: run the checker

```sh
node ${CLAUDE_PLUGIN_ROOT}/skills/claude-visual-check-no-images/scripts/check.cjs <url> [more urls] --widths 390,1280
```

- Needs Playwright: `npm i -D playwright && npx playwright install chromium`, or `PLAYWRIGHT=/path/to/node_modules/playwright`.
- Local dev server: pass its URL (`http://localhost:3000/...`). Pages behind login: run against a demo account, never against production data.
- `--json` gives every finding. Text mode groups repeats ("...and 20 more like these").
- Exit code 0 = clean, 1 = findings, 2 = could not run.

What it catches: `overflow`, `clipped-text`, `covered`, `broken-image`, `http-4xx/5xx`, `request-failed`, `js-error`, `console-error`, `dead-link`, `no-name`, `tiny-target`, `low-contrast`, `orphan-word`, `blank`.

What it does not catch: wrong numbers, wrong copy, broken flows (login, checkout, forms that submit to the wrong place), and "this looks ugly". Flows need a real test (Playwright Test clicking through the flow). Taste needs step 2.

## Step 2: only if a human-eye question is left

Use it for a new visual change (a new section, a new layout), or for a finding you cannot judge from text. Run the checker with crops of the flagged elements and of the parts that changed:

```sh
node ${CLAUDE_PLUGIN_ROOT}/skills/claude-visual-check-no-images/scripts/check.cjs <url> --crops /tmp/claude-visual-check-no-images-crops --shot "#pricing,footer"
```

The end of the output lists every crop path by width. Then make **one** call to `claude-visual-check-no-images:visual-checker` with: the URL, what changed, all the crop paths, and the questions ("is the new pricing card aligned with the others at 390px?"). It answers in at most 10 lines. Do not ask it to send images back.

States that only exist after a click (a modal, step 2 of a form, the page after payment) are not reachable by URL. Take those crops in your flow test with `locator.screenshot()` (slice anything taller than about 1,100px) and pass the paths the same way.

## Reporting

One line per real problem, with the selector and width. Then what you fixed and what is still open.
