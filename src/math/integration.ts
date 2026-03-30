// PreTeX integration bridge — connects math typesetting to pretext's text layout

import type { MathStyle, PositionedBox } from "./types"
import { parseMath } from "./parser"
import { layoutMath } from "./layout"
import { renderMath } from "./render"

// --- Types ---

export type MathMeasurement = {
  width: number
  height: number
  depth: number
}

export type RenderMathOptions = {
  color?: string
  displayStyle?: boolean
  fontFamily?: string
}

export type RenderMathResult = {
  canvas: HTMLCanvasElement
  width: number
  height: number
  depth: number
  baseline: number
}

export type MathInlineBox = {
  width: number
  height: number
  depth: number
  baseline: number
  latex: string
  fontSize: number
  render: (ctx: CanvasRenderingContext2D, x: number, y: number) => void
}

export type TextSegment = { type: "text"; content: string }
export type MathSegment = { type: "math"; latex: string; display: boolean }
export type TextMathSegment = TextSegment | MathSegment

// --- Core pipeline ---

function parseAndLayout(
  latex: string,
  fontSize: number,
  style: MathStyle,
): PositionedBox {
  const box = parseMath(latex)
  return layoutMath(box, style, fontSize)
}

// --- Public API ---

/** Parse → layout → extract dimensions. Key API for embedding math inline in text. */
export function measureMath(
  latex: string,
  fontSize: number,
): MathMeasurement {
  const positioned = parseAndLayout(latex, fontSize, "display")
  return {
    width: positioned.box.width,
    height: positioned.box.height,
    depth: positioned.box.depth,
  }
}

/** Full render pipeline: parse → layout → create canvas → render. */
export function renderMathToCanvas(
  latex: string,
  fontSize: number,
  options?: RenderMathOptions,
): RenderMathResult {
  const style: MathStyle = options?.displayStyle === false ? "text" : "display"
  const positioned = parseAndLayout(latex, fontSize, style)

  const totalWidth = Math.ceil(positioned.box.width)
  const totalHeight = Math.ceil(positioned.box.height + positioned.box.depth)
  const baseline = positioned.box.height

  const canvas = document.createElement("canvas")
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio : 1
  canvas.width = totalWidth * dpr
  canvas.height = totalHeight * dpr
  canvas.style.width = `${totalWidth}px`
  canvas.style.height = `${totalHeight}px`

  const ctx = canvas.getContext("2d")
  if (ctx) {
    ctx.scale(dpr, dpr)
    renderMath(ctx, positioned, 0, baseline, {
      color: options?.color ?? "#000000",
    })
  }

  return {
    canvas,
    width: positioned.box.width,
    height: positioned.box.height,
    depth: positioned.box.depth,
    baseline,
  }
}

/**
 * Create a box for inline math embedding in pretext's text layout.
 * Uses "text" math style (compact, no display-mode limits).
 * The render callback draws the math at (x, y) where y is the baseline.
 */
export function createMathBox(
  latex: string,
  fontSize: number,
): MathInlineBox {
  const positioned = parseAndLayout(latex, fontSize, "text")

  return {
    width: positioned.box.width,
    height: positioned.box.height,
    depth: positioned.box.depth,
    baseline: positioned.box.height,
    latex,
    fontSize,
    render(ctx: CanvasRenderingContext2D, x: number, y: number) {
      renderMath(ctx, positioned, x, y, {
        color: typeof ctx.fillStyle === "string" ? ctx.fillStyle : "#000000",
      })
    },
  }
}

/**
 * Split text containing $inline$ and $$display$$ math delimiters into segments.
 * Returns array of plain text and math segments in order.
 */
export function processMathInText(text: string): TextMathSegment[] {
  const segments: TextMathSegment[] = []
  let i = 0

  while (i < text.length) {
    // Display math: $$...$$
    if (text[i] === "$" && i + 1 < text.length && text[i + 1] === "$") {
      const start = i + 2
      const end = text.indexOf("$$", start)
      if (end !== -1) {
        segments.push({ type: "math", latex: text.slice(start, end), display: true })
        i = end + 2
        continue
      }
    }

    // Inline math: $...$
    if (text[i] === "$") {
      const start = i + 1
      const end = text.indexOf("$", start)
      if (end !== -1) {
        segments.push({ type: "math", latex: text.slice(start, end), display: false })
        i = end + 1
        continue
      }
    }

    // Plain text — collect until next $
    const nextDollar = text.indexOf("$", i)
    const plainEnd = nextDollar === -1 ? text.length : nextDollar
    if (plainEnd > i) {
      segments.push({ type: "text", content: text.slice(i, plainEnd) })
    }
    i = plainEnd
  }

  return segments
}
