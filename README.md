# cheap-eyes

[Português](README.pt-BR.md) · [Français](README.fr.md)

**Problem.** When an agent (Claude Code or any other) reads a screenshot, for example one taken with Playwright, the full image stays in the conversation. It is sent again with every later message, until `/clear`.

**Solution.** A skill that keeps the full image out of the main conversation. It looks with cheap eyes instead:

1. **Read the elements.** A script opens the page at 390px and 1280px and measures what's on it: sideways scroll, cut-off text, a button under a banner, 404 images, JS errors, failing API calls, dead links, unlabeled icons, tiny tap targets, faint text, a one-word last line. It answers in text, with a selector for each finding.
2. **Look only when it has to.** When something needs an eye, a subagent opens small crops of the flagged elements and answers in text. The image dies with the subagent.

## Results

| | cheap-eyes | Screenshots in the main chat |
|---|---|---|
| 12 planted bugs found | **11** | 7 |
| Input tokens, first task | **53.7k** | 82.8k |
| Extra tokens on every later message | **0** | ~2.5k |
| Real pages: findings confirmed by eye | 14 of 18 | |

It misses what only meaning shows, such as a wrong total. That needs a flow test. Raw data and method are in [`bench/`](bench/results/).

## Install

```
/plugin marketplace add felpk/cheap-eyes
/plugin install cheap-eyes@cheap-eyes
npm i -D playwright && npx playwright install chromium
```

Then ask Claude to check a page, or run it yourself:

```sh
node skills/cheap-eyes/scripts/check.cjs http://localhost:3000/
```

To look at a part you changed, crop it (tall parts come out in slices, so the text stays readable) and hand all the crops to the subagent in one call:

```sh
node skills/cheap-eyes/scripts/check.cjs http://localhost:3000/ --shot "#pricing,footer"
```

MIT
