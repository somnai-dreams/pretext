// Generate KaTeX reference PNGs using Playwright
// Usage: cd /home/max/dev/pretext && bun run src/math/tests/generate-references.ts

import { chromium } from "playwright"
import { ALL_TEST_CASES } from "./test-cases"
import { mkdirSync, writeFileSync } from "fs"
import { join } from "path"

const REFERENCES_DIR = join(import.meta.dir, "references")
const FONT_SIZE = 32

mkdirSync(REFERENCES_DIR, { recursive: true })

const html = `<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/katex.min.css">
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/katex.min.js"></script>
  <style>
    body { margin: 0; background: white; }
    .expr {
      display: inline-block;
      padding: 8px 12px;
      font-size: ${FONT_SIZE}px;
      background: white;
    }
  </style>
</head>
<body>
  <div id="container"></div>
  <script>
    const cases = ${JSON.stringify(ALL_TEST_CASES)};
    const container = document.getElementById("container");
    for (const tc of cases) {
      const div = document.createElement("div");
      div.id = "expr-" + tc.name;
      div.className = "expr";
      try {
        katex.render(tc.latex, div, {
          displayMode: tc.displayMode,
          throwOnError: false,
        });
      } catch (e) {
        div.textContent = "RENDER ERROR: " + e.message;
      }
      container.appendChild(div);
    }
  </script>
</body>
</html>`

async function main() {
  console.log(`Generating ${ALL_TEST_CASES.length} KaTeX reference images...`)

  const browser = await chromium.launch()
  const page = await browser.newPage({ deviceScaleFactor: 2 })

  await page.setContent(html, { waitUntil: "networkidle" })

  // Wait for KaTeX to finish rendering
  await page.waitForSelector(".katex", { timeout: 10000 })

  let generated = 0
  let failed = 0

  for (const tc of ALL_TEST_CASES) {
    const selector = `#expr-${tc.name}`
    const el = await page.$(selector)
    if (!el) {
      console.log(`  SKIP: ${tc.name} — element not found`)
      failed++
      continue
    }

    const pngPath = join(REFERENCES_DIR, `${tc.name}.png`)
    await el.screenshot({ path: pngPath })
    generated++
  }

  await browser.close()

  console.log(`Done: ${generated} generated, ${failed} failed`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
