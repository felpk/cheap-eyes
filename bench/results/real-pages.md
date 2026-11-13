# Real pages, checked by eye

2026-11-13. Five public pages in production (four landing pages and one web app), at 390px and 1280px. The sites are not named here: the point is how often the checker is right, not whose page has which bug.

`check.cjs` reported 199 findings: 166 low-contrast, 17 orphan-word, 10 tiny-target, 5 covered, 1 no-name.

A sample of 18 (the first two of each kind on each page) went to the `visual-checker` subagent, which opened the crops, took its own screenshots where the crop was not enough, and judged each one.

| Verdict | Count |
|---|---|
| Confirmed | 14 |
| Not a problem | 4 |
| Can't tell | 0 |

The 4 that were not a problem:

- **2 × covered.** Cards in a horizontally scrolling row. Their centre was scrolled out of view, so `elementFromPoint` landed on the next column. Nothing covered them. **Fixed after this run:** controls whose centre is outside a scrolling ancestor are skipped. Re-running on that page gives 0 `covered`.
- **2 × low-contrast.** Bold white team initials on a solid green circle, ratio 3.9 to 4.1:1. Under the WCAG AA line of 4.5:1, but the subagent found them readable. **Not changed:** the checker follows WCAG. Treat findings near the line as "disputed", not as noise to delete.

Cost of the eye check: 56,820 tokens, all inside the subagent. The main session received 22 lines of text.

What the subagent noticed that the checker did not: on one page, text shows through a fixed header after scrolling at 390px. The checker only looks at the page as loaded, not scrolled.
