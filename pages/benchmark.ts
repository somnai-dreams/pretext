import { prepare, layout, clearCache } from '../src/layout.ts'
import type { PreparedText } from '../src/layout.ts'
import { TEXTS } from '../src/test-data.ts'

const COUNT = 500
const FONT_FAMILY = '"Helvetica Neue", Helvetica, Arial, sans-serif'
const FONT_SIZE = 16
const FONT = `${FONT_SIZE}px ${FONT_FAMILY}`
const LINE_HEIGHT = Math.round(FONT_SIZE * 1.2)
const WIDTH_BEFORE = 400
const WIDTH_AFTER = 300
const WARMUP = 2
const RUNS = 10

// Filter edge cases — not realistic comments
const commentTexts = TEXTS.filter(t => t.text.trim().length > 1)
const texts: string[] = []
for (let i = 0; i < COUNT; i++) {
  texts.push(commentTexts[i % commentTexts.length]!.text)
}

function median(times: number[]): number {
  const sorted = [...times].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!
}

function bench(fn: () => void): number {
  for (let i = 0; i < WARMUP; i++) fn()
  const times: number[] = []
  for (let i = 0; i < RUNS; i++) {
    const t0 = performance.now()
    fn()
    times.push(performance.now() - t0)
  }
  return median(times)
}

// Yield to let the browser paint status updates
function nextFrame(): Promise<void> {
  return new Promise(resolve => { requestAnimationFrame(() => { resolve() }) })
}

async function run() {
  const root = document.getElementById('root')!

  // Create visible DOM container
  const container = document.createElement('div')
  container.style.cssText = 'position:relative;overflow:hidden;height:1px'
  document.body.appendChild(container)

  const divs: HTMLDivElement[] = []
  for (let i = 0; i < COUNT; i++) {
    const div = document.createElement('div')
    div.style.font = FONT
    div.style.lineHeight = `${LINE_HEIGHT}px`
    div.style.width = `${WIDTH_BEFORE}px`
    div.style.position = 'relative'
    div.style.wordWrap = 'break-word'
    div.style.overflowWrap = 'break-word'
    div.textContent = texts[i]!
    container.appendChild(div)
    divs.push(div)
  }
  divs[0]!.getBoundingClientRect() // force initial layout

  // Pre-prepare for layout benchmark
  const prepared: PreparedText[] = []
  for (let i = 0; i < COUNT; i++) {
    prepared.push(prepare(texts[i]!, FONT, LINE_HEIGHT))
  }

  type Result = { label: string, ms: number, desc: string }
  const results: Result[] = []

  // --- 1. prepare() ---
  root.innerHTML = '<p>Benchmarking prepare()...</p>'
  await nextFrame()
  const tPrepare = bench(() => {
    clearCache()
    for (let i = 0; i < COUNT; i++) {
      prepare(texts[i]!, FONT, LINE_HEIGHT)
    }
  })
  results.push({ label: 'Our library: prepare()', ms: tPrepare, desc: 'Segment + measure (one-time)' })

  // --- 2. layout() ---
  root.innerHTML = '<p>Benchmarking layout()...</p>'
  await nextFrame()
  const tLayout = bench(() => {
    for (let i = 0; i < COUNT; i++) {
      layout(prepared[i]!, WIDTH_AFTER)
    }
  })
  results.push({ label: 'Our library: layout()', ms: tLayout, desc: 'Pure arithmetic (resize hot path)' })

  // --- 3. DOM batch ---
  root.innerHTML = '<p>Benchmarking DOM batch...</p>'
  await nextFrame()
  for (const div of divs) div.style.width = `${WIDTH_BEFORE}px`
  divs[0]!.getBoundingClientRect()
  const tBatch = bench(() => {
    for (let i = 0; i < COUNT; i++) divs[i]!.style.width = `${WIDTH_AFTER}px`
    for (let i = 0; i < COUNT; i++) divs[i]!.getBoundingClientRect().height
    for (let i = 0; i < COUNT; i++) divs[i]!.style.width = `${WIDTH_BEFORE}px`
    divs[0]!.getBoundingClientRect()
  })
  results.push({ label: 'DOM batch', ms: tBatch, desc: 'Write all, read all (one reflow)' })

  // --- 4. DOM interleaved ---
  root.innerHTML = '<p>Benchmarking DOM interleaved...</p>'
  await nextFrame()
  for (const div of divs) div.style.width = `${WIDTH_BEFORE}px`
  divs[0]!.getBoundingClientRect()
  const tInterleaved = bench(() => {
    for (let i = 0; i < COUNT; i++) {
      divs[i]!.style.width = `${WIDTH_AFTER}px`
      divs[i]!.getBoundingClientRect().height
    }
    for (let i = 0; i < COUNT; i++) divs[i]!.style.width = `${WIDTH_BEFORE}px`
    divs[0]!.getBoundingClientRect()
  })
  results.push({ label: 'DOM interleaved', ms: tInterleaved, desc: 'Write+read per div (N reflows)' })

  document.body.removeChild(container)

  // --- Render ---
  const fastest = Math.min(...results.map(r => r.ms))

  let html = `
    <div class="summary">
      <span class="big">${tLayout.toFixed(2)}ms</span> layout (${COUNT} texts)
      <span class="sep">|</span>
      ${(tInterleaved / tLayout).toFixed(0)}× faster than DOM interleaved
      <span class="sep">|</span>
      ${(tBatch / tLayout).toFixed(0)}× faster than DOM batch
    </div>
    <table>
      <tr><th>Approach</th><th>Median (ms)</th><th>Relative</th><th>Description</th></tr>
  `
  for (const r of results) {
    const rel = r.ms / fastest
    const cls = rel < 1.5 ? 'fast' : rel < 10 ? 'mid' : 'slow'
    html += `<tr class="${cls}">
      <td>${r.label}</td>
      <td>${r.ms.toFixed(2)}</td>
      <td>${rel < 1.01 ? 'fastest' : rel.toFixed(1) + '×'}</td>
      <td>${r.desc}</td>
    </tr>`
  }
  html += '</table>'
  html += `<p class="note">${COUNT} texts × ${WARMUP} warmup + ${RUNS} measured runs. ${FONT}. Resize ${WIDTH_BEFORE}→${WIDTH_AFTER}px. Visible containers, position:relative.</p>`

  root.innerHTML = html
}

run()
