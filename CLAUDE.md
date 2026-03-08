## Pretext

Internal notes for contributors and agents. Use `README.md` as the public source of truth for API examples, benchmark/accuracy numbers, and user-facing limitations. Use `RESEARCH.md` for the detailed exploration log.

### Commands

- `bun start` — serve pages at http://localhost:3000
- `bun run check` — typecheck + lint
- `bun test` — lightweight invariant tests against the shipped implementation
- `bun run accuracy-check` / `:safari` / `:firefox` — browser accuracy sweeps
- `bun run gatsby-check` / `:safari` — Gatsby canary diagnostics
- `bun run gatsby-sweep --start=300 --end=900 --step=10` — fast Gatsby width sweep; add `--diagnose` to rerun mismatching widths through the slow checker

### Important files

- `src/layout.ts` — core library; keep `layout()` fast and allocation-light
- `src/measure-harfbuzz.ts` — HarfBuzz backend kept for ad hoc measurement probes
- `src/test-data.ts` — shared corpus for browser accuracy pages/checkers and benchmarks
- `src/layout.test.ts` — small durable invariant tests for the exported prepare/layout APIs
- `pages/accuracy.ts` — browser sweep plus per-line diagnostics
- `pages/benchmark.ts` — performance comparisons
- `pages/bubbles.ts` — bubble shrinkwrap demo

### Implementation notes

- `prepare()` / `prepareWithSegments()` do horizontal-only work. `layout()` / `layoutWithLines()` take explicit `lineHeight`.
- `prepare()` is internally split into a text-analysis phase and a measurement phase; keep that seam clear, but keep the public API simple unless requirements force a change.
- `layout()` is the resize hot path: no DOM reads, no canvas calls, no string work, and avoid gratuitous allocations.
- Word width cache is `Map<font, Map<segment, width>>`; shared across texts and resettable via `clearCache()`.
- Word and grapheme segmenters are hoisted at module scope. Any locale reset should also clear the word cache.
- Punctuation is merged into preceding word-like segments only, never into spaces.
- Non-word, non-space segments are break opportunities, same as words.
- CJK grapheme splitting plus kinsoku merging keeps prohibited punctuation attached to adjacent graphemes.
- Emoji correction is auto-detected per font size, constant per emoji grapheme, and effectively font-independent.
- Bidi levels are computed during `prepare()` and stored, but `layout()` does not currently consume them.
- Supported CSS target is the common app-text configuration: `white-space: normal`, `word-break: normal`, `overflow-wrap: break-word`, `line-break: auto`.
- `system-ui` is unsafe for accuracy; canvas and DOM can resolve different fonts on macOS.
- Thai historically mismatched because CSS and `Intl.Segmenter` use different internal dictionaries; keep it in the browser sweep when changing segmentation rules.
- HarfBuzz probes need explicit LTR to avoid wrong direction on isolated Arabic words.
- Accuracy pages and checkers are now expected to be green in all three installed browsers on fresh runs; if a page disagrees, suspect stale tabs/servers before changing the algorithm.
- Keep `src/layout.test.ts` small and durable. For browser-specific or narrow hypothesis work, prefer throwaway probes/scripts and promote only the stable invariants into permanent tests.
- For Gatsby canary work, sweep widths cheaply first and only diagnose the mismatching widths in detail. The slow detailed checker is for narrowing root causes, not for every width by default.

### Open questions

- Locale switch: expose a way to reinitialize the hoisted segmenters and clear cache for a new locale.
- Decide whether line-fit tolerance should stay as a browser-specific shim or move to runtime calibration alongside emoji correction.
- `layoutWithLines()` may want ranges/indices instead of `{ text, width }` to avoid materializing substrings.
- ASCII fast path could skip some CJK, bidi, and emoji overhead.
- Benchmark methodology still needs review.
- `pages/demo.html` is still a placeholder.
- Additional CSS configs are still untested: `break-all`, `keep-all`, `strict`, `loose`, `anywhere`, `pre-wrap`.

### Related

- `../text-layout/` — Sebastian Markbage's original prototype + our experimental variants.

### TODO
- TweetDeck-style 3 columns of the same text scrolling at the same time
- Resize Old Man and the Sea
- Creative responsive magazine-like layout contouring some shapes
- Revisit whitespace normalization only for the remaining NBSP / hard-space edge cases, not ordinary collapsible whitespace
- Make `src/layout.ts` import-safe in non-DOM runtimes and add an explicit server canvas backend path
- Decide whether automatic hyphenation / soft-hyphen support is in scope for this repo
- Decide whether intrinsic sizing / logical width APIs are needed beyond fixed-width height prediction
- Decide whether bidi rendering strategy work (selection / copy-paste preserving runs) belongs here or stays out of scope
- Decide whether richer text-engine features like ellipsis, per-character offsets, custom selection, vertical text, or shape wrapping should remain explicitly out of scope
