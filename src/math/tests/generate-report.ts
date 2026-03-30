// Generate visual regression report HTML from test results
// Usage: cd /home/max/dev/pretext && bun run src/math/tests/generate-report.ts

import { readFileSync, writeFileSync, existsSync } from "fs"
import { join, relative } from "path"

const TESTS_DIR = import.meta.dir
const RESULTS_PATH = join(TESTS_DIR, "results.json")
const REPORT_PATH = join(TESTS_DIR, "report.html")

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

function imgTag(absPath: string, alt: string): string {
  if (!absPath || !existsSync(absPath)) return `<span class="no-img">N/A</span>`
  const rel = relative(TESTS_DIR, absPath)
  return `<img src="${rel}" alt="${alt}" />`
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

function main() {
  if (!existsSync(RESULTS_PATH)) {
    console.error("No results.json found. Run run-tests.ts first.")
    process.exit(1)
  }

  const results: TestResult[] = JSON.parse(readFileSync(RESULTS_PATH, "utf-8"))

  const passed = results.filter((r) => r.status === "pass").length
  const failed = results.filter((r) => r.status === "fail").length
  const errors = results.filter((r) => r.status === "error").length
  const skipped = results.filter((r) => r.status === "skip").length

  const rows = results
    .map((r) => {
      const statusClass = r.status
      const statusLabel = r.status === "pass" ? "PASS" : r.status === "fail" ? "FAIL" : r.status === "error" ? "ERR" : "SKIP"
      const pct = r.status !== "skip" ? `${(r.diffPercent * 100).toFixed(1)}%` : "—"

      return `<tr class="${statusClass}">
  <td class="name">${escapeHtml(r.name)}</td>
  <td class="latex"><code>${escapeHtml(r.latex)}</code></td>
  <td class="mode">${r.displayMode ? "display" : "inline"}</td>
  <td class="status"><span class="badge ${statusClass}">${statusLabel}</span></td>
  <td class="diff-pct">${pct}</td>
  <td class="img-cell">${imgTag(r.pretexPng, "PreTeX")}</td>
  <td class="img-cell">${imgTag(r.referencePng, "KaTeX")}</td>
  <td class="img-cell">${imgTag(r.diffPng, "Diff")}</td>
  <td class="message">${escapeHtml(r.message)}</td>
</tr>`
    })
    .join("\n")

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>PreTeX Visual Regression Report</title>
<style>
  * { box-sizing: border-box; margin: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f5f5f5; padding: 24px; color: #222; }
  h1 { margin-bottom: 8px; }
  .summary { margin-bottom: 20px; font-size: 15px; }
  .summary span { font-weight: 600; margin-right: 16px; }
  .summary .pass-count { color: #16a34a; }
  .summary .fail-count { color: #dc2626; }
  .summary .error-count { color: #ea580c; }
  .summary .skip-count { color: #6b7280; }
  table { border-collapse: collapse; width: 100%; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
  th { background: #1e293b; color: white; text-align: left; padding: 10px 12px; font-size: 13px; font-weight: 500; }
  td { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  tr.fail { background: #fef2f2; }
  tr.error { background: #fff7ed; }
  tr.skip { background: #f9fafb; opacity: 0.7; }
  .badge { padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
  .badge.pass { background: #dcfce7; color: #16a34a; }
  .badge.fail { background: #fee2e2; color: #dc2626; }
  .badge.error { background: #ffedd5; color: #ea580c; }
  .badge.skip { background: #f3f4f6; color: #6b7280; }
  .img-cell img { max-height: 60px; max-width: 200px; display: block; image-rendering: auto; }
  .no-img { color: #9ca3af; font-style: italic; }
  code { background: #f1f5f9; padding: 2px 6px; border-radius: 3px; font-size: 12px; }
  .diff-pct { font-variant-numeric: tabular-nums; }
</style>
</head>
<body>
<h1>PreTeX vs KaTeX — Visual Regression</h1>
<div class="summary">
  <span class="pass-count">Pass: ${passed}</span>
  <span class="fail-count">Fail: ${failed}</span>
  <span class="error-count">Error: ${errors}</span>
  <span class="skip-count">Skip: ${skipped}</span>
  <span>Total: ${results.length}</span>
</div>
<table>
<thead>
  <tr><th>Name</th><th>LaTeX</th><th>Mode</th><th>Status</th><th>Diff%</th><th>PreTeX</th><th>KaTeX</th><th>Diff</th><th>Notes</th></tr>
</thead>
<tbody>
${rows}
</tbody>
</table>
</body>
</html>`

  writeFileSync(REPORT_PATH, html)
  console.log(`Report written to ${REPORT_PATH}`)
}

main()
