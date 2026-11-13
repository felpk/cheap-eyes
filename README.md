# cheap-eyes

A Claude Code skill that finds the bugs a user hits in the first minute and hands them back as text, so the model stops paying for screenshots.

[Leia em português](README.pt-BR.md)

**The problem.** The model says "done" and you open the page: the button is under the cookie bar, the phone scrolls sideways, the image is a 404, the console has a crash. Each one is obvious in use. The usual fix is "take a screenshot and look", which misses what a picture can't show (JS errors, failing API calls, dead links) and costs context: an image read in the main session stays in the history and goes out again with every later message until `/clear`.

**What it does.**

1. `check.cjs` loads the page in Playwright at 390px and 1280px and measures it: sideways overflow, text cut off by its box, controls covered by something else, images that didn't load, HTTP 4xx/5xx, failed requests, JS errors, dead internal links, icon buttons with no name, tap targets under 24×24px, text under WCAG AA contrast, headings with one word alone on the last line, blank pages.
2. The output is text with a selector per finding. Repeats are grouped.
3. When something still needs eyes, the `visual-checker` subagent opens the crops and answers in text. The images never reach your session.

## Results

All numbers below come from `bench/`. Raw outputs are in `bench/results/`. One run per method, so treat them as a measurement, not a law.

**Page with 12 planted bugs** (`bench/fixtures/bugs.html`):

| | cheap-eyes | Screenshots (Claude looks at 2 full-page prints) |
|---|---|---|
| Planted bugs found | **11 of 12** | 7 of 12 |
| False alarms on a clean page | 0 | not measured |
| Input tokens, first task | **53,732** | 82,761 |
| Cost, first task | **$0.090** | $0.108 |
| Input tokens, next message | **29,360** | 31,852 |

- cheap-eyes missed the wrong cart total (10 + 5 shown as 20). **Screenshots caught it.** A checker measures layout, not meaning: wrong numbers and broken flows need a real flow test.
- Screenshots missed the JS crash, the API returning 500, the dead link, the icon button with no label and the one-word last line. None of them show in a picture.
- The screenshot session carries about 2,500 more tokens into every later message until `/clear`. Most of that is the two prints, and the rest is its longer answer. Each print here cost roughly 900 tokens, and a large page can cost up to about 1,600, so ten prints in one session means 10,000 or more extra tokens per message.
- The planted page was written by the same person who wrote the checker. That's a bias, so the checker was also run on real pages.

**Five real pages in production** ([details](bench/results/real-pages.md)): 199 findings. A sample of 18, checked by eye in the subagent: **14 confirmed**, 4 not a problem. Two of the four, controls inside a scrolling carousel, came from a bug in the checker, and it is fixed. The other two are text just under the WCAG contrast line that still reads fine. They are kept and reported as disputed.

## Install

Claude Code:

```
/plugin marketplace add felpk/cheap-eyes
/plugin install cheap-eyes@cheap-eyes
```

Playwright, in the project you are checking (or point `PLAYWRIGHT=` at an existing install):

```sh
npm i -D playwright && npx playwright install chromium
```

## Use

Ask Claude to check a page, or run it yourself:

```sh
node skills/cheap-eyes/scripts/check.cjs http://localhost:3000/ http://localhost:3000/pricing
node skills/cheap-eyes/scripts/check.cjs <url> --json            # every finding
node skills/cheap-eyes/scripts/check.cjs <url> --crops ./crops   # PNG of each flagged element, for the subagent
```

Exit code 0 = clean, 1 = findings, 2 = could not run. That also makes it a CI gate.

Run the benchmark:

```sh
node bench/score.cjs
```

## Limits

- It checks the page as loaded, not after scrolling, clicking or typing. Flows (login, checkout) need Playwright tests.
- It doesn't judge taste: "this looks off" is still a human or subagent call.
- Contrast follows WCAG on solid backgrounds. Text over images and gradients is skipped.

MIT license.
