import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

type GatsbyLineMismatch = {
  line: number
  ours: string
  browser: string
}

type GatsbyNavigationBreakMismatch = {
  line: number
  deltaText: string
  oursContext: string
  browserContext: string
  reasonGuess: string
}

type GatsbyNavigationReport = {
  status: 'ready' | 'error'
  requestId?: string
  width?: number
  predictedHeight?: number
  actualHeight?: number
  diffPx?: number
  predictedLineCount?: number
  browserLineCount?: number
  mismatchCount?: number
  firstMismatch?: GatsbyLineMismatch | null
  firstBreakMismatch?: GatsbyNavigationBreakMismatch | null
  message?: string
}

type SweepMismatch = {
  width: number
  diffPx: number
  predictedHeight: number
  actualHeight: number
  predictedLineCount: number | null
  browserLineCount: number | null
  mismatchCount: number | null
  firstBreakMismatch: GatsbyNavigationBreakMismatch | null
  firstMismatch: GatsbyLineMismatch | null
}

type SweepSummary = {
  browser: string
  start: number
  end: number
  step: number
  widthCount: number
  exactCount: number
  mismatches: SweepMismatch[]
}

type SweepOptions = {
  start: number
  end: number
  step: number
  port: number
  browser: string
  diagnose: boolean
  diagnoseLimit: number
  output: string | null
}

function parseNumberFlag(name: string, fallback: number): number {
  const prefix = `--${name}=`
  const arg = process.argv.find(value => value.startsWith(prefix))
  if (arg === undefined) return fallback
  const parsed = Number.parseInt(arg.slice(prefix.length), 10)
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid value for --${name}: ${arg.slice(prefix.length)}`)
  }
  return parsed
}

function parseStringFlag(name: string): string | null {
  const prefix = `--${name}=`
  const arg = process.argv.find(value => value.startsWith(prefix))
  return arg === undefined ? null : arg.slice(prefix.length)
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

function parseOptions(): SweepOptions {
  const start = parseNumberFlag('start', 300)
  const end = parseNumberFlag('end', 900)
  const step = parseNumberFlag('step', 10)
  const port = parseNumberFlag('port', Number.parseInt(process.env['GATSBY_CHECK_PORT'] ?? '3210', 10))
  const browser = (parseStringFlag('browser') ?? process.env['GATSBY_CHECK_BROWSER'] ?? 'chrome').toLowerCase()
  const diagnose = hasFlag('diagnose')
  const diagnoseLimit = parseNumberFlag('diagnose-limit', 6)
  const output = parseStringFlag('output')

  if (step <= 0) throw new Error('--step must be > 0')
  if (end < start) throw new Error('--end must be >= --start')
  if (browser !== 'chrome' && browser !== 'safari') {
    throw new Error(`Unsupported browser ${browser}; expected chrome or safari`)
  }

  return { start, end, step, port, browser, diagnose, diagnoseLimit, output }
}

const options = parseOptions()
const baseUrl = `http://localhost:${options.port}/gatsby`

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function canReachServer(): Promise<boolean> {
  try {
    const response = await fetch(baseUrl)
    return response.ok
  } catch {
    return false
  }
}

async function waitForServer(): Promise<void> {
  for (let i = 0; i < 200; i++) {
    if (await canReachServer()) return
    await sleep(100)
  }
  throw new Error(`Timed out waiting for local Bun server on ${baseUrl}`)
}

function navigateBrowser(url: string): void {
  if (options.browser === 'safari') {
    execFileSync('osascript', [
      '-e',
      'tell application "Safari" to activate',
      '-e',
      'tell application "Safari" to if (count of windows) = 0 then make new document',
      '-e',
      `tell application "Safari" to set URL of current tab of front window to ${JSON.stringify(url)}`,
    ], { encoding: 'utf8' })
    return
  }

  execFileSync('osascript', [
    '-e',
    'tell application "Google Chrome" to activate',
    '-e',
    'tell application "Google Chrome" to if (count of windows) = 0 then make new window',
    '-e',
    `tell application "Google Chrome" to set URL of active tab of front window to ${JSON.stringify(url)}`,
  ], { encoding: 'utf8' })
}

function readBrowserReportText(): string {
  try {
    if (options.browser === 'safari') {
      const url = execFileSync('osascript', [
        '-e',
        'tell application "Safari" to get URL of current tab of front window',
      ], { encoding: 'utf8' }).trim()
      const hashIndex = url.indexOf('#report=')
      if (hashIndex === -1) return ''
      return decodeURIComponent(url.slice(hashIndex + '#report='.length))
    }

    return execFileSync('osascript', [
      '-e',
      'tell application "Google Chrome" to execute active tab of front window javascript "(() => { const el = document.getElementById(\'gatsby-report\'); return el && el.dataset.ready === \'1\' && el.textContent ? el.textContent : \'\'; })()"',
    ], { encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

async function loadBrowserReport(url: string, expectedRequestId: string): Promise<GatsbyNavigationReport> {
  navigateBrowser(url)

  for (let i = 0; i < 600; i++) {
    await sleep(100)
    const reportJson = readBrowserReportText()
    if (reportJson === '' || reportJson === 'null') continue

    const report = JSON.parse(reportJson) as GatsbyNavigationReport
    if (report.requestId === expectedRequestId) {
      return report
    }
  }

  throw new Error(`Timed out waiting for Gatsby report from ${options.browser}`)
}

function getTargetWidths(): number[] {
  const widths: number[] = []
  for (let width = options.start; width <= options.end; width += options.step) {
    widths.push(width)
  }
  return widths
}

function formatSignedInt(value: number): string {
  return `${value > 0 ? '+' : ''}${Math.round(value)}`
}

function formatRanges(widths: number[], step: number): string {
  if (widths.length === 0) return '-'

  const parts: string[] = []
  let rangeStart = widths[0]!
  let previous = widths[0]!

  for (let i = 1; i < widths.length; i++) {
    const width = widths[i]!
    if (width === previous + step) {
      previous = width
      continue
    }
    parts.push(rangeStart === previous ? `${rangeStart}` : `${rangeStart}-${previous}`)
    rangeStart = width
    previous = width
  }

  parts.push(rangeStart === previous ? `${rangeStart}` : `${rangeStart}-${previous}`)
  return parts.join(', ')
}

function printSummary(summary: SweepSummary): void {
  console.log(
    `swept ${summary.widthCount} widths (${summary.start}-${summary.end} step ${summary.step}) in ${summary.browser}: ${summary.exactCount} exact, ${summary.mismatches.length} nonzero`,
  )

  if (summary.mismatches.length === 0) {
    return
  }

  const byDiff = new Map<number, number[]>()
  for (const mismatch of summary.mismatches) {
    const bucket = byDiff.get(mismatch.diffPx)
    if (bucket === undefined) {
      byDiff.set(mismatch.diffPx, [mismatch.width])
    } else {
      bucket.push(mismatch.width)
    }
  }

  const sortedBuckets = [...byDiff.entries()].sort((a, b) => a[0] - b[0])
  for (const [diffPx, widths] of sortedBuckets) {
    console.log(`  ${formatSignedInt(diffPx)}px: ${formatRanges(widths, summary.step)}`)
  }

  console.log('  first mismatches:')
  for (const mismatch of summary.mismatches.slice(0, 10)) {
    const lines =
      mismatch.predictedLineCount !== null && mismatch.browserLineCount !== null
        ? ` | lines ${mismatch.predictedLineCount}/${mismatch.browserLineCount}`
        : ''
    const reason = mismatch.firstBreakMismatch?.reasonGuess ?? 'no break diagnostic'
    console.log(`    ${mismatch.width}px -> ${formatSignedInt(mismatch.diffPx)}px${lines} | ${reason}`)
  }
}

function maybeWriteSummary(summary: SweepSummary): void {
  if (options.output === null) return
  writeFileSync(options.output, `${JSON.stringify(summary, null, 2)}\n`, 'utf8')
  console.log(`wrote ${options.output}`)
}

function runDetailedDiagnose(mismatches: SweepMismatch[]): void {
  if (!options.diagnose || mismatches.length === 0) return

  const widths = mismatches
    .slice(0, options.diagnoseLimit)
    .map(mismatch => String(mismatch.width))

  console.log(`diagnosing ${widths.length} widths with slow checker: ${widths.join(', ')}`)

  const result = spawnSync(
    'bun',
    ['run', 'scripts/gatsby-check.ts', ...widths],
    {
      cwd: process.cwd(),
      env: { ...process.env, GATSBY_CHECK_BROWSER: options.browser, GATSBY_CHECK_PORT: String(options.port) },
      encoding: 'utf8',
    },
  )

  if (result.stdout.length > 0) process.stdout.write(result.stdout)
  if (result.stderr.length > 0) process.stderr.write(result.stderr)
  if (result.status !== 0) {
    throw new Error(`gatsby-check exited with status ${result.status ?? 'unknown'}`)
  }
}

let serverProcess: ReturnType<typeof spawn> | null = null

try {
  if (!(await canReachServer())) {
    serverProcess = spawn('/bin/zsh', ['-lc', `bun --port=${options.port} --no-hmr pages/*.html`], {
      cwd: process.cwd(),
      stdio: 'ignore',
    })
    await waitForServer()
  }

  const mismatches: SweepMismatch[] = []
  const widths = getTargetWidths()

  for (const width of widths) {
    const requestId = `${Date.now()}-${width}-${Math.random().toString(36).slice(2, 8)}`
    const url = `${baseUrl}?report=1&diagnostic=light&width=${width}&requestId=${requestId}`
    const report = await loadBrowserReport(url, requestId)

    if (report.status === 'error') {
      throw new Error(report.message ?? `Gatsby report failed at width ${width}`)
    }

    const diffPx = report.diffPx ?? 0
    if (diffPx === 0) continue

    mismatches.push({
      width: report.width ?? width,
      diffPx,
      predictedHeight: report.predictedHeight ?? 0,
      actualHeight: report.actualHeight ?? 0,
      predictedLineCount: report.predictedLineCount ?? null,
      browserLineCount: report.browserLineCount ?? null,
      mismatchCount: report.mismatchCount ?? null,
      firstBreakMismatch: report.firstBreakMismatch ?? null,
      firstMismatch: report.firstMismatch ?? null,
    })

    console.log(
      `${width}px -> ${formatSignedInt(diffPx)}px | ${report.predictedHeight ?? 0}/${report.actualHeight ?? 0}${report.firstBreakMismatch?.reasonGuess ? ` | ${report.firstBreakMismatch.reasonGuess}` : ''}`,
    )
  }

  const summary: SweepSummary = {
    browser: options.browser,
    start: options.start,
    end: options.end,
    step: options.step,
    widthCount: widths.length,
    exactCount: widths.length - mismatches.length,
    mismatches,
  }

  printSummary(summary)
  maybeWriteSummary(summary)
  runDetailedDiagnose(mismatches)
} finally {
  if (serverProcess !== null) {
    serverProcess.kill('SIGTERM')
  }
}
