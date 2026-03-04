## Text Metrics

DOM-free text measurement using canvas `measureText()` + `Intl.Segmenter`. Two-phase: `prepare()` once per text, `layout()` is pure arithmetic on resize. ~0.1ms for 500 comments. Full i18n.

### Commands

- `bun start` — serve pages at http://localhost:3000
- `bun run check` — typecheck + lint
- `bun test` — headless tests (HarfBuzz, 100% accuracy)

### Files

- `src/layout.ts` — the library
- `src/measure-harfbuzz.ts` — HarfBuzz backend for headless tests
- `src/test-data.ts` — shared test texts/params
- `src/layout.test.ts` — bun tests: consistency + word-sum vs full-line accuracy
- `pages/accuracy.html + .ts` — sweep across fonts, sizes, widths, i18n texts (working)
- `pages/emoji-test.html` — canvas vs DOM emoji width comparison (working)
- `pages/demo.html + .ts` — visual side-by-side comparison (TODO)
- `pages/benchmark.html + .ts` — performance comparison (TODO)
- `pages/interleaving.html + .ts` — realistic DOM interleaving demo (TODO)

### Key decisions

- Canvas over DOM: zero DOM reads in prepare() or layout(). No read/write interleaving.
- Word width cache (`Map<font, Map<segment, width>>`): persists across prepare() calls. Common words shared across texts. No eviction — grows monotonically per font. Fine for fixed-font bounded feeds; may need LRU for long sessions with varied fonts. `clearCache()` exists for manual eviction.
- Intl.Segmenter over split(' '): handles CJK (per-character breaks), Thai, all scripts.
- Punctuation merged into preceding word-like segments only (not spaces — that hides content from line-breaking).
- Non-word, non-space segments (emoji, parens) are break points, same as words.
- Emoji correction: auto-detected per font size, constant per emoji grapheme, font-independent.
- Kinsoku shori: CJK punctuation merged with adjacent graphemes so they can't be separated across line breaks.
- HarfBuzz with explicit LTR for headless tests: guessSegmentProperties assigns wrong direction to isolated Arabic words.

### Accuracy

Chrome 99.9%, Safari 98.8%, HarfBuzz 100%. See [README.md](README.md) for details.

### Related

- `../text-layout/` — Sebastian Markbage's original prototype + our experimental variants.

See [RESEARCH.md](RESEARCH.md) for full exploration log. Based on Sebastian Markbage's [text-layout](https://github.com/reactjs/text-layout).
