import { layoutNextLine, layoutWithLines, prepareWithSegments, type LayoutCursor, type LayoutLine, type PreparedTextWithSegments } from '../src/layout.ts'
import { BODY_COPY } from './logo-columns-text.ts'
import openaiLogoUrl from './assets/openai-symbol.svg'
import claudeLogoUrl from './assets/claude-symbol.svg'
import {
  getPolygonIntervalForBand,
  getRectIntervalsForBand,
  getWrapHull,
  isPointInPolygon,
  subtractIntervals,
  transformWrapPoints,
  type Interval,
  type Point,
  type Rect,
} from './wrap-geometry.ts'

const BODY_FONT = '16px "Helvetica Neue", Helvetica, Arial, sans-serif'
const BODY_LINE_HEIGHT = 25
const CREDIT_TEXT = 'Leopold Aschenbrenner'
const CREDIT_FONT = '12px "Helvetica Neue", Helvetica, Arial, sans-serif'
const CREDIT_LINE_HEIGHT = 16
const HEADLINE_TEXT = 'SITUATIONAL AWARENESS: THE DECADE AHEAD'
const HEADLINE_FONT_FAMILY = '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino, serif'
const OPENAI_LOGO_SRC = openaiLogoUrl
const CLAUDE_LOGO_SRC = claudeLogoUrl
const HEADLINE_WORDS = HEADLINE_TEXT.split(/\s+/)
const HINT_PILL_SAFE_TOP = 72

type LogoKind = 'openai' | 'claude'
type SpinState = {
  from: number
  to: number
  start: number
  duration: number
}
type LogoAnimationState = {
  angle: number
  spin: SpinState | null
}

type PositionedLine = {
  x: number
  y: number
  text: string
}

type BandObstacle =
  | {
      kind: 'polygon'
      points: Point[]
      horizontalPadding: number
      verticalPadding: number
    }
  | {
      kind: 'rects'
      rects: Rect[]
      horizontalPadding: number
      verticalPadding: number
    }

type PageLayout = {
  gutter: number
  headlineTop: number
  headlineWidth: number
  headlineFont: string
  headlineLineHeight: number
  headlineLines: LayoutLine[]
  headlineRects: Rect[]
  creditTop: number
  creditRegion: Rect
  leftRegion: Rect
  rightRegion: Rect
  openaiRect: Rect
  claudeRect: Rect
}

type LogoHits = { openai: Point[]; claude: Point[] }
type WrapHulls = {
  openaiLayout: Point[]
  claudeLayout: Point[]
  openaiHit: Point[]
  claudeHit: Point[]
}

const stageNode = document.getElementById('stage')
if (!(stageNode instanceof HTMLDivElement)) throw new Error('#stage not found')
const stage = stageNode

type DomCache = {
  headline: HTMLHeadingElement // cache lifetime: page
  credit: HTMLParagraphElement // cache lifetime: page
  openaiLogo: HTMLImageElement // cache lifetime: page
  claudeLogo: HTMLImageElement // cache lifetime: page
  headlineLines: HTMLDivElement[] // cache lifetime: headline line count
  bodyLines: HTMLDivElement[] // cache lifetime: visible line count
}

const preparedByKey = new Map<string, PreparedTextWithSegments>()
const scheduled = { value: false }
const events: { mousemove: MouseEvent | null; click: MouseEvent | null; blur: boolean } = {
  mousemove: null,
  click: null,
  blur: false,
}
const pointer = { x: -Infinity, y: -Infinity }
let currentLogoHits: LogoHits | null = null
let hoveredLogo: LogoKind | null = null
const logoAnimations: { openai: LogoAnimationState; claude: LogoAnimationState } = {
  openai: { angle: 0, spin: null },
  claude: { angle: 0, spin: null },
}

const domCache: DomCache = {
  headline: createHeadline(),
  credit: createCredit(),
  openaiLogo: createLogo('logo logo--openai', 'OpenAI symbol', OPENAI_LOGO_SRC),
  claudeLogo: createLogo('logo logo--claude', 'Claude symbol', CLAUDE_LOGO_SRC),
  headlineLines: [],
  bodyLines: [],
}
let mounted = false

function createHeadline(): HTMLHeadingElement {
  const element = document.createElement('h1')
  element.className = 'headline'
  return element
}

function createCredit(): HTMLParagraphElement {
  const element = document.createElement('p')
  element.className = 'credit'
  element.textContent = CREDIT_TEXT
  return element
}

function createLogo(className: string, alt: string, src: string): HTMLImageElement {
  const element = document.createElement('img')
  element.className = className
  element.alt = alt
  element.src = src
  element.draggable = false
  return element
}

function ensureMounted(): void {
  if (mounted) return
  stage.append(
    domCache.headline,
    domCache.credit,
    domCache.openaiLogo,
    domCache.claudeLogo,
  )
  mounted = true
}

const [, openaiLayout, claudeLayout, openaiHit, claudeHit] = await Promise.all([
  document.fonts.ready,
  getWrapHull(OPENAI_LOGO_SRC, { smoothRadius: 6, mode: 'mean' }),
  getWrapHull(CLAUDE_LOGO_SRC, { smoothRadius: 6, mode: 'mean' }),
  getWrapHull(OPENAI_LOGO_SRC, { smoothRadius: 3, mode: 'mean' }),
  getWrapHull(CLAUDE_LOGO_SRC, { smoothRadius: 5, mode: 'mean' }),
])
const wrapHulls: WrapHulls = { openaiLayout, claudeLayout, openaiHit, claudeHit }

function getTypography(): { font: string, lineHeight: number } {
  return { font: BODY_FONT, lineHeight: BODY_LINE_HEIGHT }
}

function getPrepared(text: string, font: string): PreparedTextWithSegments {
  const key = `${font}::${text}`
  const cached = preparedByKey.get(key)
  if (cached !== undefined) return cached
  const prepared = prepareWithSegments(text, font)
  preparedByKey.set(key, prepared)
  return prepared
}

function getObstacleIntervals(obstacle: BandObstacle, bandTop: number, bandBottom: number): Interval[] {
  switch (obstacle.kind) {
    case 'polygon': {
      const interval = getPolygonIntervalForBand(
        obstacle.points,
        bandTop,
        bandBottom,
        obstacle.horizontalPadding,
        obstacle.verticalPadding,
      )
      return interval === null ? [] : [interval]
    }
    case 'rects':
      return getRectIntervalsForBand(
        obstacle.rects,
        bandTop,
        bandBottom,
        obstacle.horizontalPadding,
        obstacle.verticalPadding,
      )
  }
}

function layoutColumn(
  prepared: PreparedTextWithSegments,
  startCursor: LayoutCursor,
  region: Rect,
  lineHeight: number,
  obstacles: BandObstacle[],
  side: 'left' | 'right',
): { lines: PositionedLine[], cursor: LayoutCursor } {
  let cursor: LayoutCursor = startCursor
  let lineTop = region.y
  const lines: PositionedLine[] = []

  while (true) {
    if (lineTop + lineHeight > region.y + region.height) break

    const bandTop = lineTop
    const bandBottom = lineTop + lineHeight
    const blocked: Interval[] = []
    for (const obstacle of obstacles) blocked.push(...getObstacleIntervals(obstacle, bandTop, bandBottom))

    const slots = subtractIntervals(
      { left: region.x, right: region.x + region.width },
      blocked,
    )
    if (slots.length === 0) {
      lineTop += lineHeight
      continue
    }

    const slot = slots.reduce((best, candidate) => {
      const bestWidth = best.right - best.left
      const candidateWidth = candidate.right - candidate.left
      if (candidateWidth > bestWidth) return candidate
      if (candidateWidth < bestWidth) return best
      if (side === 'left') return candidate.left > best.left ? candidate : best
      return candidate.left < best.left ? candidate : best
    })
    const width = slot.right - slot.left
    const line = layoutNextLine(prepared, cursor, width)
    if (line === null) break

    lines.push({
      x: Math.round(slot.left),
      y: Math.round(lineTop),
      text: line.text,
    })

    cursor = line.end
    lineTop += lineHeight
  }

  return { lines, cursor }
}

function syncPool<T extends HTMLElement>(pool: T[], length: number, create: () => T, parent: HTMLElement = stage): void {
  while (pool.length < length) {
    const element = create()
    pool.push(element)
    parent.appendChild(element)
  }
  while (pool.length > length) {
    const element = pool.pop()!
    element.remove()
  }
}

function projectHeadlineLines(lines: LayoutLine[], font: string, lineHeight: number): void {
  syncPool(domCache.headlineLines, lines.length, () => {
    const element = document.createElement('div')
    element.className = 'headline-line'
    return element
  }, domCache.headline)

  for (const [index, line] of lines.entries()) {
    const element = domCache.headlineLines[index]!
    element.textContent = line.text
    element.style.left = '0px'
    element.style.top = `${index * lineHeight}px`
    element.style.font = font
    element.style.lineHeight = `${lineHeight}px`
  }
}

function projectBodyLines(lines: PositionedLine[], className: string, font: string, lineHeight: number, startIndex: number): number {
  for (const [offset, line] of lines.entries()) {
    const element = domCache.bodyLines[startIndex + offset]!
    element.className = className
    element.textContent = line.text
    element.style.left = `${line.x}px`
    element.style.top = `${line.y}px`
    element.style.font = font
    element.style.lineHeight = `${lineHeight}px`
  }
  return startIndex + lines.length
}

function projectStaticLayout(layout: PageLayout, pageHeight: number): void {
  ensureMounted()
  stage.style.height = `${pageHeight}px`

  domCache.openaiLogo.style.left = `${layout.openaiRect.x}px`
  domCache.openaiLogo.style.top = `${layout.openaiRect.y}px`
  domCache.openaiLogo.style.width = `${layout.openaiRect.width}px`
  domCache.openaiLogo.style.height = `${layout.openaiRect.height}px`
  domCache.openaiLogo.style.transform = `rotate(${logoAnimations.openai.angle}rad)`

  domCache.claudeLogo.style.left = `${layout.claudeRect.x}px`
  domCache.claudeLogo.style.top = `${layout.claudeRect.y}px`
  domCache.claudeLogo.style.width = `${layout.claudeRect.width}px`
  domCache.claudeLogo.style.height = `${layout.claudeRect.height}px`
  domCache.claudeLogo.style.transform = `rotate(${logoAnimations.claude.angle}rad)`

  domCache.headline.style.left = `${layout.gutter}px`
  domCache.headline.style.top = `${layout.headlineTop}px`
  domCache.headline.style.width = `${layout.headlineWidth}px`
  domCache.headline.style.height = `${layout.headlineLines.length * layout.headlineLineHeight}px`
  domCache.headline.style.font = layout.headlineFont
  domCache.headline.style.lineHeight = `${layout.headlineLineHeight}px`
  domCache.headline.style.letterSpacing = '0px'
  projectHeadlineLines(layout.headlineLines, layout.headlineFont, layout.headlineLineHeight)

  domCache.credit.style.left = `${layout.gutter + 4}px`
  domCache.credit.style.top = `${layout.creditTop}px`
  domCache.credit.style.width = 'auto'
  domCache.credit.style.font = CREDIT_FONT
  domCache.credit.style.lineHeight = `${CREDIT_LINE_HEIGHT}px`
}

function getPreparedSingleLineWidth(text: string, font: string, lineHeight: number): number {
  const result = layoutWithLines(getPrepared(text, font), 10_000, lineHeight)
  return result.lines[0]!.width
}

function titleLayoutKeepsWholeWords(lines: LayoutLine[]): boolean {
  const words = new Set(HEADLINE_WORDS)
  for (const line of lines) {
    const tokens = line.text.split(' ').filter(Boolean)
    for (const token of tokens) {
      if (!words.has(token)) return false
    }
  }
  return true
}

function fitHeadlineFontSize(headlineWidth: number, pageWidth: number): number {
  const maxSize = Math.min(94.4, Math.max(55.2, pageWidth * 0.055))
  let low = Math.max(22, pageWidth * 0.026)
  let high = maxSize
  let best = low

  for (let iteration = 0; iteration < 10; iteration++) {
    const size = (low + high) / 2
    const lineHeight = Math.round(size * 0.92)
    const font = `700 ${size}px ${HEADLINE_FONT_FAMILY}`
    let widestWord = 0

    for (const word of HEADLINE_WORDS) {
      const width = getPreparedSingleLineWidth(word, font, lineHeight)
      if (width > widestWord) widestWord = width
    }

    const titleLayout = layoutWithLines(getPrepared(HEADLINE_TEXT, font), headlineWidth, lineHeight)
    if (widestWord <= headlineWidth - 8 && titleLayoutKeepsWholeWords(titleLayout.lines)) {
      best = size
      low = size
    } else {
      high = size
    }
  }

  return Math.round(best * 10) / 10
}

function setHoveredLogo(nextHovered: LogoKind | null): void {
  if (hoveredLogo === nextHovered) return
  hoveredLogo = nextHovered
}

function easeSpin(t: number): number {
  const oneMinusT = 1 - t
  return 1 - oneMinusT * oneMinusT * oneMinusT
}

function getLogoAnimation(kind: LogoKind): LogoAnimationState {
  switch (kind) {
    case 'openai':
      return logoAnimations.openai
    case 'claude':
      return logoAnimations.claude
  }
}

function updateLogoSpin(logo: LogoAnimationState, now: number): boolean {
  if (logo.spin === null) return false

  const progress = Math.min(1, (now - logo.spin.start) / logo.spin.duration)
  logo.angle = logo.spin.from + (logo.spin.to - logo.spin.from) * easeSpin(progress)
  if (progress >= 1) {
    logo.angle = logo.spin.to
    logo.spin = null
    return false
  }
  return true
}

function updateSpinState(now: number): boolean {
  const openaiAnimating = updateLogoSpin(logoAnimations.openai, now)
  const claudeAnimating = updateLogoSpin(logoAnimations.claude, now)
  return openaiAnimating || claudeAnimating
}

function startLogoSpin(kind: LogoKind, direction: 1 | -1, now: number): void {
  const logo = getLogoAnimation(kind)
  const delta = direction * Math.PI
  logo.spin = {
    from: logo.angle,
    to: logo.angle + delta,
    start: now,
    duration: 900,
  }
}

function getLogoProjection(layout: PageLayout, lineHeight: number): {
  openaiObstacle: BandObstacle
  claudeObstacle: BandObstacle
  hits: LogoHits
} {
  const openaiWrap = transformWrapPoints(wrapHulls.openaiLayout, layout.openaiRect, logoAnimations.openai.angle)
  const claudeWrap = transformWrapPoints(wrapHulls.claudeLayout, layout.claudeRect, logoAnimations.claude.angle)
  return {
    openaiObstacle: {
      kind: 'polygon',
      points: openaiWrap,
      horizontalPadding: Math.round(lineHeight * 0.82),
      verticalPadding: Math.round(lineHeight * 0.26),
    },
    claudeObstacle: {
      kind: 'polygon',
      points: claudeWrap,
      horizontalPadding: Math.round(lineHeight * 0.28),
      verticalPadding: Math.round(lineHeight * 0.12),
    },
    hits: {
      openai: transformWrapPoints(wrapHulls.openaiHit, layout.openaiRect, logoAnimations.openai.angle),
      claude: transformWrapPoints(wrapHulls.claudeHit, layout.claudeRect, logoAnimations.claude.angle),
    },
  }
}

function buildLayout(pageWidth: number, pageHeight: number, lineHeight: number): PageLayout {
  const gutter = Math.round(Math.max(52, pageWidth * 0.048))
  const centerGap = Math.round(Math.max(28, pageWidth * 0.025))
  const columnWidth = Math.round((pageWidth - gutter * 2 - centerGap) / 2)

  const headlineTop = Math.round(Math.max(42, pageWidth * 0.04, HINT_PILL_SAFE_TOP))
  const headlineWidth = Math.round(Math.min(pageWidth - gutter * 2, Math.max(columnWidth, pageWidth * 0.5)))
  const headlineFontSize = fitHeadlineFontSize(headlineWidth, pageWidth)
  const headlineLineHeight = Math.round(headlineFontSize * 0.92)
  const headlineFont = `700 ${headlineFontSize}px ${HEADLINE_FONT_FAMILY}`
  const headlineResult = layoutWithLines(
    getPrepared(HEADLINE_TEXT, headlineFont),
    headlineWidth,
    headlineLineHeight,
  )
  const headlineLines = headlineResult.lines
  const headlineRects = headlineLines.map((line, index) => ({
    x: gutter,
    y: headlineTop + index * headlineLineHeight,
    width: Math.ceil(line.width),
    height: headlineLineHeight,
  }))

  const creditGap = Math.round(Math.max(14, lineHeight * 0.6))
  const creditTop = headlineTop + headlineResult.height + creditGap
  const copyTop = creditTop + CREDIT_LINE_HEIGHT + Math.round(Math.max(20, lineHeight * 0.9))
  const openaiShrinkT = Math.max(0, Math.min(1, (960 - pageWidth) / 260))
  const OPENAI_SIZE = 400 - openaiShrinkT * 56
  const openaiSize = Math.round(Math.min(OPENAI_SIZE, pageHeight * 0.43))
  const claudeSize = Math.round(Math.max(276, Math.min(500, pageWidth * 0.355, pageHeight * 0.45)))

  const creditRegion: Rect = {
    x: gutter + 4,
    y: creditTop,
    width: headlineWidth,
    height: CREDIT_LINE_HEIGHT,
  }

  const leftRegion: Rect = {
    x: gutter,
    y: copyTop,
    width: columnWidth,
    height: pageHeight - copyTop - gutter,
  }

  const rightRegion: Rect = {
    x: gutter + columnWidth + centerGap,
    y: headlineTop,
    width: columnWidth,
    height: pageHeight - headlineTop - gutter,
  }

  const openaiRect: Rect = {
    x: leftRegion.x - Math.round(openaiSize * 0.3),
    y: pageHeight - gutter - openaiSize + Math.round(openaiSize * 0.2),
    width: openaiSize,
    height: openaiSize,
  }

  const claudeRect: Rect = {
    x: pageWidth - Math.round(claudeSize * 0.69),
    y: -Math.round(claudeSize * 0.22),
    width: claudeSize,
    height: claudeSize,
  }

  return {
    gutter,
    headlineTop,
    headlineWidth,
    headlineFont,
    headlineLineHeight,
    headlineLines,
    headlineRects,
    creditTop,
    creditRegion,
    leftRegion,
    rightRegion,
    openaiRect,
    claudeRect,
  }
}

function evaluateLayout(
  layout: PageLayout,
  lineHeight: number,
  preparedBody: PreparedTextWithSegments,
): {
  creditLeft: number
  leftLines: PositionedLine[]
  rightLines: PositionedLine[]
  hits: LogoHits
} {
  const { openaiObstacle, claudeObstacle, hits } = getLogoProjection(layout, lineHeight)

  const titleObstacle: BandObstacle = {
    kind: 'rects',
    rects: layout.headlineRects,
    horizontalPadding: Math.round(lineHeight * 0.95),
    verticalPadding: Math.round(lineHeight * 0.3),
  }

  const creditWidth = Math.ceil(getPreparedSingleLineWidth(CREDIT_TEXT, CREDIT_FONT, CREDIT_LINE_HEIGHT))
  const creditBlocked = getObstacleIntervals(
    openaiObstacle,
    layout.creditRegion.y,
    layout.creditRegion.y + layout.creditRegion.height,
  )
  const creditSlots = subtractIntervals(
    {
      left: layout.creditRegion.x,
      right: layout.creditRegion.x + layout.creditRegion.width,
    },
    creditBlocked,
  )
  let creditLeft = layout.creditRegion.x
  for (const slot of creditSlots) {
    if (slot.right - slot.left >= creditWidth) {
      creditLeft = Math.round(slot.left)
      break
    }
  }

  const leftResult = layoutColumn(
    preparedBody,
    { segmentIndex: 0, graphemeIndex: 0 },
    layout.leftRegion,
    lineHeight,
    [openaiObstacle],
    'left',
  )

  const rightResult = layoutColumn(
    preparedBody,
    leftResult.cursor,
    layout.rightRegion,
    lineHeight,
    [titleObstacle, claudeObstacle, openaiObstacle],
    'right',
  )

  return {
    creditLeft,
    leftLines: leftResult.lines,
    rightLines: rightResult.lines,
    hits,
  }
}

function render(now: number): boolean {
  const { font, lineHeight } = getTypography()
  const root = document.documentElement
  const pageWidth = root.clientWidth
  const pageHeight = root.clientHeight

  // === handle inputs against the previous committed hit geometry
  if (events.click !== null) {
    pointer.x = events.click.clientX
    pointer.y = events.click.clientY
  }
  if (events.mousemove !== null) {
    pointer.x = events.mousemove.clientX
    pointer.y = events.mousemove.clientY
  }

  const previousLogoHits = currentLogoHits
  const nextHovered =
    events.blur || previousLogoHits === null
      ? null
      : isPointInPolygon(previousLogoHits.openai, pointer.x, pointer.y)
        ? 'openai'
        : isPointInPolygon(previousLogoHits.claude, pointer.x, pointer.y)
          ? 'claude'
          : null
  setHoveredLogo(nextHovered)

  if (events.click !== null && previousLogoHits !== null) {
    if (isPointInPolygon(previousLogoHits.openai, pointer.x, pointer.y)) {
      startLogoSpin('openai', -1, now)
    } else if (isPointInPolygon(previousLogoHits.claude, pointer.x, pointer.y)) {
      startLogoSpin('claude', 1, now)
    }
  }

  const animating = updateSpinState(now)
  const preparedBody = getPrepared(BODY_COPY, font)
  const layout = buildLayout(pageWidth, pageHeight, lineHeight)
  const { creditLeft, leftLines, rightLines, hits } = evaluateLayout(layout, lineHeight, preparedBody)

  // === commit state
  events.mousemove = null
  events.click = null
  events.blur = false
  currentLogoHits = hits

  // === DOM writes
  projectStaticLayout(layout, pageHeight)
  domCache.credit.style.left = `${creditLeft}px`
  syncPool(domCache.bodyLines, leftLines.length + rightLines.length, () => {
    const element = document.createElement('div')
    element.className = 'line'
    return element
  })
  let nextIndex = 0
  nextIndex = projectBodyLines(leftLines, 'line line--left', font, lineHeight, nextIndex)
  projectBodyLines(rightLines, 'line line--right', font, lineHeight, nextIndex)
  document.body.style.cursor = hoveredLogo === null ? 'default' : 'pointer'

  return animating
}

function scheduleRender(): void {
  if (scheduled.value) return
  scheduled.value = true
  requestAnimationFrame(function renderAndMaybeScheduleAnotherRender(now) {
    scheduled.value = false
    if (render(now)) scheduleRender()
  })
}

window.addEventListener('resize', scheduleRender)
document.addEventListener('mousemove', event => {
  events.mousemove = event
  scheduleRender()
})
window.addEventListener('blur', () => {
  events.blur = true
  scheduleRender()
})
document.addEventListener('click', event => {
  events.click = event
  scheduleRender()
})
scheduleRender()
