// PreTeX canvas renderer

import type { PositionedBox, FontStyle } from "./types"
import { parseMath } from "./parser"
import { layoutMath } from "./layout"

type RenderOptions = {
  color: string
}

const DEFAULT_OPTIONS: RenderOptions = {
  color: "#000000",
}

const fontStyleToCSS = (style: FontStyle): string => {
  switch (style) {
    case "normal": return "normal"
    case "italic": return "italic"
    case "bold": return "bold"
    case "bold-italic": return "italic bold"
  }
}

const buildFontString = (fontSize: number, fontFamily: string, fontStyle: string): string =>
  `${fontStyle} ${fontSize}px ${fontFamily}`

export function renderMath(
  ctx: CanvasRenderingContext2D,
  posBox: PositionedBox,
  x: number,
  y: number,
  options: RenderOptions = DEFAULT_OPTIONS,
): void {
  ctx.textBaseline = "alphabetic"
  ctx.fillStyle = options.color
  let currentFont = ""

  const setFont = (font: string) => {
    if (font !== currentFont) {
      ctx.font = font
      currentFont = font
    }
  }

  const walk = (node: PositionedBox, bx: number, by: number) => {
    const nx = bx + node.x
    const ny = by + node.y
    const box = node.box

    switch (box.type) {
      case "symbol": {
        const font = buildFontString(box.fontSize, box.fontFamily, "normal")
        setFont(font)
        ctx.fillText(box.char, nx, ny)
        break
      }

      case "text": {
        const cssStyle = fontStyleToCSS(box.fontStyle)
        const font = buildFontString(box.fontSize, box.fontFamily, cssStyle)
        setFont(font)
        ctx.fillText(box.text, nx, ny)
        break
      }

      case "fraction": {
        // Draw numerator and denominator via children
        for (const child of node.children) {
          walk(child, nx, ny)
        }
        // Draw fraction bar
        const barY = ny - box.numShift + box.numerator.height + (box.barThickness / 2)
        ctx.beginPath()
        ctx.lineWidth = box.barThickness
        ctx.strokeStyle = options.color
        ctx.moveTo(nx, barY)
        ctx.lineTo(nx + box.width, barY)
        ctx.stroke()
        break
      }

      case "radical": {
        // Draw radicand via children
        for (const child of node.children) {
          walk(child, nx, ny)
        }
        // Draw radical sign as a path
        const surdW = box.surdWidth
        const totalH = box.height + box.depth
        const ruleY = ny - box.height
        const bottomY = ny + box.depth

        ctx.beginPath()
        ctx.lineWidth = box.ruleThickness
        ctx.strokeStyle = options.color
        // Short horizontal tail at bottom-left
        ctx.moveTo(nx, ny - totalH * 0.4)
        // Diagonal down to the bottom of the surd
        ctx.lineTo(nx + surdW * 0.35, bottomY)
        // Diagonal up to the top-left of the overline
        ctx.lineTo(nx + surdW, ruleY)
        // Horizontal overline across the radicand
        ctx.lineTo(nx + box.width, ruleY)
        ctx.stroke()
        break
      }

      case "delimiter": {
        const normalSize = box.targetSize
        if (box.actualSize <= normalSize * 1.5) {
          // Small delimiter — just draw the character
          const font = buildFontString(box.actualSize, "serif", "normal")
          setFont(font)
          ctx.fillText(box.char, nx, ny)
        } else {
          // Tall delimiter — scale the character to fit
          const font = buildFontString(box.actualSize, "serif", "normal")
          setFont(font)
          ctx.fillText(box.char, nx, ny)
        }
        break
      }

      case "operator": {
        const size = box.displaySize > 0 ? box.displaySize : box.fontSize
        const font = buildFontString(size, "serif", "normal")
        setFont(font)
        ctx.fillText(box.char, nx, ny)
        // Limits (if any) are positioned children
        for (const child of node.children) {
          walk(child, nx, ny)
        }
        break
      }

      case "accent": {
        // Draw base via children
        for (const child of node.children) {
          walk(child, nx, ny)
        }
        // Draw accent character centered above base
        const accentX = nx + (box.base.width - box.width) / 2
        const accentY = ny - box.base.height
        // Use base font size (accent inherits from context)
        const baseBox = box.base
        const fontSize = baseBox.type === "symbol" ? baseBox.fontSize
          : baseBox.type === "text" ? baseBox.fontSize
          : 16 // fallback
        const font = buildFontString(fontSize, "serif", "normal")
        setFont(font)
        ctx.fillText(box.accent, accentX, accentY)
        break
      }

      case "matrix": {
        // Draw delimiters if present
        if (box.leftDelim) {
          const font = buildFontString(box.height + box.depth, "serif", "normal")
          setFont(font)
          ctx.fillText(box.leftDelim, nx, ny)
        }
        if (box.rightDelim) {
          const font = buildFontString(box.height + box.depth, "serif", "normal")
          setFont(font)
          ctx.fillText(box.rightDelim, nx + box.width - 10, ny)
        }
        // Row/cell content are positioned children
        for (const child of node.children) {
          walk(child, nx, ny)
        }
        break
      }

      case "script":
      case "hbox":
      case "vbox": {
        // Just recurse into positioned children
        for (const child of node.children) {
          walk(child, nx, ny)
        }
        break
      }

      case "space":
      case "phantom": {
        // Nothing to draw
        break
      }
    }
  }

  walk(posBox, x, y)
}

export function renderToCanvas(latex: string, fontSize: number): HTMLCanvasElement {
  const parsed = parseMath(latex)
  const positioned = layoutMath(parsed, "display", fontSize)

  const totalWidth = Math.ceil(positioned.box.width)
  const totalHeight = Math.ceil(positioned.box.height + positioned.box.depth)

  const canvas = document.createElement("canvas")
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio : 1
  canvas.width = totalWidth * dpr
  canvas.height = totalHeight * dpr
  canvas.style.width = `${totalWidth}px`
  canvas.style.height = `${totalHeight}px`

  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Could not get 2d context")

  ctx.scale(dpr, dpr)

  // Render at (0, height) so baseline is positioned correctly
  // (y=0 is top of canvas, baseline is at box.height from top)
  renderMath(ctx, positioned, 0, positioned.box.height)

  return canvas
}
