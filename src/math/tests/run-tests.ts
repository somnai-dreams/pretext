// Run PreTeX visual regression tests against KaTeX references
// Usage: cd /home/max/dev/pretext && bun run src/math/tests/run-tests.ts

import { chromium } from "playwright"
import { ALL_TEST_CASES } from "./test-cases"
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs"
import { join } from "path"

const TESTS_DIR = import.meta.dir
const REFERENCES_DIR = join(TESTS_DIR, "references")
const OUTPUT_DIR = join(TESTS_DIR, "output")
const FONT_SIZE = 32

// Pixel comparison tolerance (0-255 per channel)
const CHANNEL_TOLERANCE = 32
// Max percentage of differing pixels to still pass
const PASS_THRESHOLD = 0.05

type TestResult = {
  name: string
  latex: string
  displayMode: boolean
  status: "pass" | "fail" | "error" | "skip"
  diffPercent: number
  message: string
  pretexPng: string
  referencePng: string
  diffPng: string
}

mkdirSync(OUTPUT_DIR, { recursive: true })

// Build the PreTeX test page HTML — inlines the bundle to avoid file:// CORS issues
function buildPretexHtml(): string {
  const bundleCode = readFileSync(join(TESTS_DIR, "pretex-math.js"), "utf-8")
  return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { margin: 0; background: white; }
    .expr {
      display: inline-block;
      padding: 8px 12px;
      background: white;
    }
    canvas { display: block; }
  </style>
  <script>${bundleCode}</script>
</head>
<body>
  <div id="container"></div>
  <script>
    const cases = ${JSON.stringify(ALL_TEST_CASES)};
    const container = document.getElementById("container");
    const results = {};

    for (const tc of cases) {
      const wrapper = document.createElement("div");
      wrapper.id = "expr-" + tc.name;
      wrapper.className = "expr";

      try {
        const result = PreTeX.renderMathToCanvas(tc.latex, ${FONT_SIZE}, {
          displayStyle: tc.displayMode,
        });
        wrapper.appendChild(result.canvas);
        results[tc.name] = { ok: true, width: result.width, height: result.canvas.height };
      } catch (e) {
        wrapper.textContent = "ERROR: " + e.message;
        results[tc.name] = { ok: false, error: e.message };
      }

      container.appendChild(wrapper);
    }

    window.__pretexResults = results;
  </script>
</body>
</html>`
}

// Compare two PNG buffers pixel-by-pixel, return diff percentage and diff image buffer
async function compareImages(
  page: Awaited<ReturnType<Awaited<ReturnType<typeof chromium.launch>>["newPage"]>>,
  pretexPath: string,
  referencePath: string,
  diffPath: string,
): Promise<{ diffPercent: number }> {
  const pretexB64 = readFileSync(pretexPath).toString("base64")
  const refB64 = readFileSync(referencePath).toString("base64")

  const result = await page.evaluate(
    async ({ pretexB64, refB64, tolerance }: { pretexB64: string; refB64: string; tolerance: number }) => {
      function loadImage(b64: string): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
          const img = new Image()
          img.onload = () => resolve(img)
          img.onerror = reject
          img.src = "data:image/png;base64," + b64
        })
      }

      const imgA = await loadImage(pretexB64)
      const imgB = await loadImage(refB64)

      const w = Math.max(imgA.width, imgB.width)
      const h = Math.max(imgA.height, imgB.height)

      const canvas = document.createElement("canvas")
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext("2d")!

      // Draw image A
      ctx.clearRect(0, 0, w, h)
      ctx.drawImage(imgA, 0, 0)
      const dataA = ctx.getImageData(0, 0, w, h)

      // Draw image B
      ctx.clearRect(0, 0, w, h)
      ctx.drawImage(imgB, 0, 0)
      const dataB = ctx.getImageData(0, 0, w, h)

      // Compare and build diff
      const diffData = ctx.createImageData(w, h)
      let diffPixels = 0
      const totalPixels = w * h

      for (let i = 0; i < totalPixels * 4; i += 4) {
        const dr = Math.abs(dataA.data[i] - dataB.data[i])
        const dg = Math.abs(dataA.data[i + 1] - dataB.data[i + 1])
        const db = Math.abs(dataA.data[i + 2] - dataB.data[i + 2])
        const da = Math.abs(dataA.data[i + 3] - dataB.data[i + 3])

        if (dr > tolerance || dg > tolerance || db > tolerance || da > tolerance) {
          diffPixels++
          diffData.data[i] = 255     // red
          diffData.data[i + 1] = 0
          diffData.data[i + 2] = 0
          diffData.data[i + 3] = 255
        } else {
          // Gray background for matching pixels
          const avg = (dataA.data[i] + dataB.data[i]) / 2
          diffData.data[i] = avg
          diffData.data[i + 1] = avg
          diffData.data[i + 2] = avg
          diffData.data[i + 3] = 128
        }
      }

      ctx.putImageData(diffData, 0, 0)
      const diffDataUrl = canvas.toDataURL("image/png")

      return {
        diffPercent: totalPixels > 0 ? diffPixels / totalPixels : 0,
        diffDataUrl,
      }
    },
    { pretexB64, refB64, tolerance: CHANNEL_TOLERANCE },
  )

  // Write diff PNG
  const diffBase64 = result.diffDataUrl.split(",")[1]
  writeFileSync(diffPath, Buffer.from(diffBase64, "base64"))

  return { diffPercent: result.diffPercent }
}

async function main() {
  // Step 1: Build PreTeX bundle (uses bundle-entry.ts which exposes PreTeX on window)
  console.log("Building PreTeX bundle...")
  const bundlePath = join(TESTS_DIR, "pretex-math.js")
  const buildResult = Bun.spawnSync({
    cmd: ["bun", "build", join(TESTS_DIR, "bundle-entry.ts"), "--outfile", bundlePath, "--target", "browser"],
    cwd: join(TESTS_DIR, "..", "..", ".."),
  })
  if (buildResult.exitCode !== 0) {
    console.error("Bundle build failed:", buildResult.stderr.toString())
    process.exit(1)
  }
  console.log("Bundle built.")

  // Step 2: Render all expressions with PreTeX via Playwright
  console.log("Rendering PreTeX expressions...")
  const browser = await chromium.launch()
  const page = await browser.newPage({ deviceScaleFactor: 2 })

  const pretexHtml = buildPretexHtml()
  await page.setContent(pretexHtml, { waitUntil: "networkidle" })

  // Capture PreTeX renders
  const pretexResults = await page.evaluate(() => (window as unknown as { __pretexResults: Record<string, { ok: boolean; error?: string }> }).__pretexResults)

  const results: TestResult[] = []

  for (const tc of ALL_TEST_CASES) {
    const referencePng = join(REFERENCES_DIR, `${tc.name}.png`)
    const pretexPng = join(OUTPUT_DIR, `${tc.name}-pretex.png`)
    const diffPng = join(OUTPUT_DIR, `${tc.name}-diff.png`)

    // Check if reference exists
    if (!existsSync(referencePng)) {
      results.push({
        name: tc.name,
        latex: tc.latex,
        displayMode: tc.displayMode,
        status: "skip",
        diffPercent: 0,
        message: "No reference image",
        pretexPng: "",
        referencePng: "",
        diffPng: "",
      })
      continue
    }

    // Check if PreTeX rendered successfully
    const pretexResult = pretexResults[tc.name]
    if (!pretexResult?.ok) {
      results.push({
        name: tc.name,
        latex: tc.latex,
        displayMode: tc.displayMode,
        status: "error",
        diffPercent: 1,
        message: `PreTeX error: ${pretexResult?.error ?? "unknown"}`,
        pretexPng: "",
        referencePng: referencePng,
        diffPng: "",
      })
      continue
    }

    // Screenshot PreTeX render
    const el = await page.$(`#expr-${tc.name}`)
    if (!el) {
      results.push({
        name: tc.name,
        latex: tc.latex,
        displayMode: tc.displayMode,
        status: "error",
        diffPercent: 1,
        message: "PreTeX element not found in DOM",
        pretexPng: "",
        referencePng: referencePng,
        diffPng: "",
      })
      continue
    }

    await el.screenshot({ path: pretexPng })

    // Compare
    try {
      const { diffPercent } = await compareImages(page, pretexPng, referencePng, diffPng)
      const passed = diffPercent <= PASS_THRESHOLD

      results.push({
        name: tc.name,
        latex: tc.latex,
        displayMode: tc.displayMode,
        status: passed ? "pass" : "fail",
        diffPercent,
        message: passed ? "OK" : `${(diffPercent * 100).toFixed(1)}% pixel diff`,
        pretexPng,
        referencePng,
        diffPng,
      })
    } catch (err) {
      results.push({
        name: tc.name,
        latex: tc.latex,
        displayMode: tc.displayMode,
        status: "error",
        diffPercent: 1,
        message: `Compare error: ${err}`,
        pretexPng,
        referencePng,
        diffPng: "",
      })
    }
  }

  await browser.close()

  // Step 3: Print summary
  const passed = results.filter((r) => r.status === "pass").length
  const failed = results.filter((r) => r.status === "fail").length
  const errors = results.filter((r) => r.status === "error").length
  const skipped = results.filter((r) => r.status === "skip").length

  console.log("\n=== Results ===")
  console.log(`  Pass: ${passed}  Fail: ${failed}  Error: ${errors}  Skip: ${skipped}`)
  console.log(`  Total: ${results.length}\n`)

  for (const r of results) {
    const icon = r.status === "pass" ? "✓" : r.status === "fail" ? "✗" : r.status === "error" ? "!" : "⊘"
    const pct = r.status !== "skip" ? ` (${(r.diffPercent * 100).toFixed(1)}%)` : ""
    console.log(`  ${icon} ${r.name}${pct} ${r.message !== "OK" ? "— " + r.message : ""}`)
  }

  // Step 4: Write results JSON for report generation
  const resultsPath = join(TESTS_DIR, "results.json")
  writeFileSync(resultsPath, JSON.stringify(results, null, 2))
  console.log(`\nResults written to ${resultsPath}`)
  console.log(`Run: bun run src/math/tests/generate-report.ts`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
