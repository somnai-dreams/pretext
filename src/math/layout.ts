// PreTeX layout engine

import type {
  MathBox, PositionedBox, MathStyle, MathAtom,
  HBox, VBox, VBoxChild, FractionBox, RadicalBox, ScriptBox,
  DelimiterBox, SpaceBox, TextBox, SymbolBox, OperatorBox,
  AccentBox, MatrixBox, PhantomBox,
} from "./types"
import { atomSpacing, nextScriptStyle } from "./types"
import {
  getMetrics, getTexParam, getStyleScale,
  isBigOp, isRelation, isBinaryOp,
} from "./fonts"

// Coordinate convention:
//   x: rightward from parent's left edge
//   y: offset from parent's baseline (positive = downward)
//   height: extent above baseline (positive)
//   depth: extent below baseline (positive)

// --- Helpers ---

function muToPx(mu: number, fontSize: number): number {
  return mu * fontSize / 18
}

function mkPos(box: MathBox, x: number, y: number, children: PositionedBox[] = []): PositionedBox {
  return { box, x, y, children }
}

function inferAtomType(box: MathBox): MathAtom {
  switch (box.type) {
    case "symbol": {
      if (box.atomType) return box.atomType
      if (isRelation(box.char)) return "rel"
      if (isBinaryOp(box.char)) return "bin"
      if (isBigOp(box.char)) return "op"
      if ("([{⟨⌊⌈".includes(box.char)) return "open"
      if (")]}⟩⌋⌉".includes(box.char)) return "close"
      if (",;".includes(box.char)) return "punct"
      return "ord"
    }
    case "operator": return "op"
    case "delimiter": {
      if (!box.char) return "ord"
      if ("([{⟨⌊⌈".includes(box.char)) return "open"
      if (")]}⟩⌋⌉".includes(box.char)) return "close"
      return "ord"
    }
    case "fraction": return "inner"
    case "script": return inferAtomType(box.base)
    case "hbox":
      return box.children.length > 0
        ? inferAtomType(box.children[box.children.length - 1]!)
        : "ord"
    default: return "ord"
  }
}

function leadingAtom(box: MathBox): MathAtom {
  if (box.type === "hbox" && box.children.length > 0) return leadingAtom(box.children[0]!)
  if (box.type === "script") return leadingAtom(box.base)
  return inferAtomType(box)
}

function computeBounds(children: PositionedBox[]): { width: number; height: number; depth: number } {
  let width = 0
  let height = 0
  let depth = 0
  for (const c of children) {
    width = Math.max(width, c.x + c.box.width)
    height = Math.max(height, c.box.height - c.y)
    depth = Math.max(depth, c.box.depth + c.y)
  }
  return { width, height: Math.max(0, height), depth: Math.max(0, depth) }
}

// Handle parser's loose typing: VBox children may be bare MathBox or proper VBoxChild
function extractVBoxChild(child: VBoxChild): { box: MathBox; shift: number } {
  if (child.box !== undefined && child.box !== null && typeof child.box === "object" && "type" in child.box) {
    return { box: child.box, shift: child.shift || 0 }
  }
  return { box: child as unknown as MathBox, shift: 0 }
}

// --- Leaf layouts ---

function layoutSymbol(box: SymbolBox, style: MathStyle, fontSize: number): PositionedBox {
  const m = getMetrics(box.char, fontSize, style)
  box.width = m.width
  box.height = m.height
  box.depth = m.depth
  box.italicCorrection = m.italicCorrection
  box.fontSize = fontSize * getStyleScale(style)
  return mkPos(box, 0, 0)
}

function layoutText(box: TextBox, style: MathStyle, fontSize: number): PositionedBox {
  const s = fontSize * getStyleScale(style)
  box.width = s * 0.5 * box.text.length
  box.height = s * 0.683
  box.depth = 0
  box.fontSize = s
  return mkPos(box, 0, 0)
}

function layoutSpace(box: SpaceBox, style: MathStyle, fontSize: number): PositionedBox {
  const s = fontSize * getStyleScale(style)
  box.width = box.width * s
  box.height = 0
  box.depth = 0
  return mkPos(box, 0, 0)
}

function layoutOp(box: OperatorBox, style: MathStyle, fontSize: number): PositionedBox {
  const m = getMetrics(box.char, fontSize, style)
  box.width = m.width
  box.height = m.height
  box.depth = m.depth
  box.fontSize = fontSize * getStyleScale(style)
  box.displaySize = m.height + m.depth
  return mkPos(box, 0, 0)
}

function layoutDelim(box: DelimiterBox, style: MathStyle, fontSize: number): PositionedBox {
  if (!box.char) {
    box.width = 0
    box.height = 0
    box.depth = 0
    return mkPos(box, 0, 0)
  }
  const m = getMetrics(box.char, fontSize, style)
  const target = box.targetSize || 0
  if (target > 0) {
    const baseTotal = m.height + m.depth
    const scale = baseTotal > 0 ? Math.max(1, target / baseTotal) : 1
    box.width = m.width * Math.min(scale, 1.2)
    box.height = m.height * scale
    box.depth = m.depth * scale
  } else {
    box.width = m.width
    box.height = m.height
    box.depth = m.depth
  }
  box.actualSize = box.height + box.depth
  return mkPos(box, 0, 0)
}

// --- HBox layout ---

function layoutHBox(box: HBox, style: MathStyle, fontSize: number): PositionedBox {
  if (box.children.length === 0) {
    box.width = 0
    box.height = 0
    box.depth = 0
    return mkPos(box, 0, 0, [])
  }

  const laidOut = box.children.map(c => layoutMath(c, style, fontSize))

  // Size delimiters to match enclosed content
  let contentH = 0
  let contentD = 0
  for (const child of laidOut) {
    if (child.box.type !== "delimiter") {
      contentH = Math.max(contentH, child.box.height)
      contentD = Math.max(contentD, child.box.depth)
    }
  }
  const contentTotal = contentH + contentD
  if (contentTotal > 0) {
    for (const child of laidOut) {
      if (child.box.type === "delimiter" && child.box.char) {
        const dm = getMetrics(child.box.char, fontSize, style)
        const baseTotal = dm.height + dm.depth
        if (contentTotal > baseTotal) {
          const scale = contentTotal / baseTotal
          child.box.width = dm.width * Math.min(scale, 1.5)
          child.box.height = contentH
          child.box.depth = contentD
          child.box.actualSize = contentTotal
          child.box.targetSize = contentTotal
        }
      }
    }
  }

  // Position left-to-right with inter-atom spacing
  const result: PositionedBox[] = []
  let x = 0
  const scaledFs = fontSize * getStyleScale(style)
  let lastAtom: MathAtom | null = null

  for (let i = 0; i < laidOut.length; i++) {
    const child = laidOut[i]!
    const origChild = box.children[i]!
    const isZeroSpace = child.box.type === "space" && child.box.width === 0

    if (!isZeroSpace && lastAtom !== null) {
      const curAtom = leadingAtom(origChild)
      const mu = atomSpacing(lastAtom, curAtom, style)
      if (mu > 0) x += muToPx(mu, scaledFs)
    }

    result.push(mkPos(child.box, x, 0, child.children))
    x += child.box.width

    if (!isZeroSpace) {
      lastAtom = inferAtomType(origChild)
    }
  }

  const bounds = computeBounds(result)
  box.width = bounds.width
  box.height = bounds.height
  box.depth = bounds.depth

  return mkPos(box, 0, 0, result)
}

// --- VBox layout ---

function layoutVBox(box: VBox, style: MathStyle, fontSize: number): PositionedBox {
  const items = box.children.map(c => extractVBoxChild(c))
  if (items.length === 0) {
    box.width = 0
    box.height = 0
    box.depth = 0
    return mkPos(box, 0, 0, [])
  }

  const scaledFs = fontSize * getStyleScale(style)
  const laidOut = items.map(item => ({
    pb: layoutMath(item.box, style, fontSize),
    shift: item.shift,
  }))

  // Stack rows vertically, centered on the math axis
  const rowGap = scaledFs * 0.2
  let totalH = 0
  for (let i = 0; i < laidOut.length; i++) {
    const item = laidOut[i]!
    totalH += item.pb.box.height + item.pb.box.depth
    if (i < laidOut.length - 1) totalH += rowGap
  }

  const axis = getTexParam("axisHeight", scaledFs)
  let curTop = -(axis + totalH / 2)
  const result: PositionedBox[] = []
  let maxW = 0

  for (let i = 0; i < laidOut.length; i++) {
    const { pb, shift } = laidOut[i]!
    const baselineY = curTop + pb.box.height
    result.push(mkPos(pb.box, shift, baselineY, pb.children))
    maxW = Math.max(maxW, shift + pb.box.width)
    curTop = baselineY + pb.box.depth
    if (i < laidOut.length - 1) curTop += rowGap
  }

  const bounds = computeBounds(result)
  box.width = maxW
  box.height = bounds.height
  box.depth = bounds.depth

  return mkPos(box, 0, 0, result)
}

// --- Script layout ---

function layoutScript(box: ScriptBox, style: MathStyle, fontSize: number): PositionedBox {
  const basePb = layoutMath(box.base, style, fontSize)

  // Operators with limits in display style: place sup/sub above/below
  if (box.base.type === "operator" && box.base.limits && style === "display") {
    return layoutLimits(box, basePb, style, fontSize)
  }

  return layoutScriptSide(box, basePb, style, fontSize)
}

function layoutLimits(
  box: ScriptBox,
  basePb: PositionedBox,
  style: MathStyle,
  fontSize: number,
): PositionedBox {
  const scaledFs = fontSize * getStyleScale(style)
  const scriptSt = nextScriptStyle(style)
  const children: PositionedBox[] = []

  const baseW = basePb.box.width
  let maxW = baseW
  children.push(mkPos(basePb.box, 0, 0, basePb.children))

  if (box.superscript) {
    const supPb = layoutMath(box.superscript, scriptSt, fontSize)
    const gap = getTexParam("bigOpSpacing1", scaledFs)
    const supY = -(basePb.box.height + gap + supPb.box.depth)
    children.push(mkPos(supPb.box, 0, supY, supPb.children))
    maxW = Math.max(maxW, supPb.box.width)
  }

  if (box.subscript) {
    const subPb = layoutMath(box.subscript, scriptSt, fontSize)
    const gap = getTexParam("bigOpSpacing3", scaledFs)
    const subY = basePb.box.depth + gap + subPb.box.height
    children.push(mkPos(subPb.box, 0, subY, subPb.children))
    maxW = Math.max(maxW, subPb.box.width)
  }

  // Center all children horizontally within maxW
  for (let i = 0; i < children.length; i++) {
    const c = children[i]!
    children[i] = mkPos(c.box, (maxW - c.box.width) / 2, c.y, c.children)
  }

  const bounds = computeBounds(children)
  box.width = bounds.width
  box.height = bounds.height
  box.depth = bounds.depth

  return mkPos(box, 0, 0, children)
}

function layoutScriptSide(
  box: ScriptBox,
  basePb: PositionedBox,
  style: MathStyle,
  fontSize: number,
): PositionedBox {
  const scaledFs = fontSize * getStyleScale(style)
  const scriptSt = nextScriptStyle(style)
  const children: PositionedBox[] = [mkPos(basePb.box, 0, 0, basePb.children)]

  // Italic correction shifts superscript rightward
  let italicCorr = 0
  if (box.base.type === "symbol") {
    italicCorr = box.base.italicCorrection || 0
  }

  const baseW = basePb.box.width
  const baseH = basePb.box.height
  const baseD = basePb.box.depth

  let supPb: PositionedBox | null = null
  let subPb: PositionedBox | null = null
  if (box.superscript) supPb = layoutMath(box.superscript, scriptSt, fontSize)
  if (box.subscript) subPb = layoutMath(box.subscript, scriptSt, fontSize)

  if (supPb && !subPb) {
    // Superscript only
    const shift = Math.max(
      getTexParam("supShift", scaledFs),
      baseH - getTexParam("supDrop", scaledFs),
      getTexParam("superBottomMin", scaledFs) + supPb.box.depth,
    )
    children.push(mkPos(supPb.box, baseW + italicCorr, -shift, supPb.children))
  } else if (subPb && !supPb) {
    // Subscript only
    const shift = Math.max(
      getTexParam("subShift", scaledFs),
      baseD + getTexParam("subDrop", scaledFs),
    )
    children.push(mkPos(subPb.box, baseW, shift, subPb.children))
  } else if (supPb && subPb) {
    // Both: ensure minimum gap between them
    let supShift = Math.max(
      getTexParam("supShift", scaledFs),
      baseH - getTexParam("supDrop", scaledFs),
    )
    let subShift = Math.max(
      getTexParam("subShift", scaledFs),
      baseD + getTexParam("subDrop", scaledFs),
    )

    const gap = (supShift - supPb.box.depth) - (subShift - subPb.box.height)
    const minGap = getTexParam("subSuperGapMin", scaledFs)
    if (gap < minGap) {
      const adj = (minGap - gap) / 2
      supShift += adj
      subShift += adj
    }

    // Ensure superscript bottom stays above minimum
    const supBottom = supShift - supPb.box.depth
    const minBottom = getTexParam("superBottomMin", scaledFs)
    if (supBottom < minBottom) {
      supShift += minBottom - supBottom
    }

    children.push(mkPos(supPb.box, baseW + italicCorr, -supShift, supPb.children))
    children.push(mkPos(subPb.box, baseW, subShift, subPb.children))
  }

  const bounds = computeBounds(children)
  box.width = bounds.width
  box.height = bounds.height
  box.depth = bounds.depth

  return mkPos(box, 0, 0, children)
}

// --- Fraction layout ---

function layoutFraction(box: FractionBox, style: MathStyle, fontSize: number): PositionedBox {
  const scaledFs = fontSize * getStyleScale(style)
  const isDisplay = style === "display"

  // Layout num/denom in next smaller style
  const numStyle: MathStyle = isDisplay ? "text" : "script"
  const denomStyle: MathStyle = isDisplay ? "text" : "script"
  const numPb = layoutMath(box.numerator, numStyle, fontSize)
  const denomPb = layoutMath(box.denominator, denomStyle, fontSize)

  const axis = getTexParam("axisHeight", scaledFs)
  const ruleThick = getTexParam("ruleThickness", scaledFs)

  let numShift = isDisplay
    ? getTexParam("fractionNumeratorShiftUp", scaledFs)
    : getTexParam("fractionNumeratorShiftUpText", scaledFs)
  let denomShift = isDisplay
    ? getTexParam("fractionDenominatorShiftDown", scaledFs)
    : getTexParam("fractionDenominatorShiftDownText", scaledFs)

  const numGapMin = isDisplay
    ? getTexParam("fractionNumeratorGapMin", scaledFs)
    : getTexParam("fractionNumeratorGapMinText", scaledFs)
  const denomGapMin = isDisplay
    ? getTexParam("fractionDenominatorGapMin", scaledFs)
    : getTexParam("fractionDenominatorGapMinText", scaledFs)

  // Ensure minimum gap above bar:
  //   numBottom (= numShift - numDepth) must be >= barTop (= axis + ruleThick/2) + numGapMin
  const gapAbove = (numShift - numPb.box.depth) - (axis + ruleThick / 2)
  if (gapAbove < numGapMin) numShift += numGapMin - gapAbove

  // Ensure minimum gap below bar:
  //   barBottom (= axis - ruleThick/2) must be >= denomTop (= denomHeight - denomShift) + denomGapMin
  const gapBelow = (axis - ruleThick / 2) - denomPb.box.height + denomShift
  if (gapBelow < denomGapMin) denomShift += denomGapMin - gapBelow

  box.numShift = numShift
  box.denomShift = denomShift
  box.barThickness = ruleThick

  // Center numerator and denominator horizontally
  const fracW = Math.max(numPb.box.width, denomPb.box.width)
  const numX = (fracW - numPb.box.width) / 2
  const denomX = (fracW - denomPb.box.width) / 2

  const children: PositionedBox[] = [
    mkPos(numPb.box, numX, -numShift, numPb.children),
    mkPos(denomPb.box, denomX, denomShift, denomPb.children),
  ]

  box.width = fracW
  box.height = numShift + numPb.box.height
  box.depth = denomShift + denomPb.box.depth

  return mkPos(box, 0, 0, children)
}

// --- Radical layout ---

function layoutRadical(box: RadicalBox, style: MathStyle, fontSize: number): PositionedBox {
  const scaledFs = fontSize * getStyleScale(style)
  const isDisplay = style === "display"

  const radPb = layoutMath(box.radicand, style, fontSize)

  const gap = isDisplay
    ? getTexParam("radicalVerticalGapDisplay", scaledFs)
    : getTexParam("radicalVerticalGap", scaledFs)
  const ruleThick = getTexParam("radicalRuleThickness", scaledFs)
  const extra = getTexParam("radicalExtraAscender", scaledFs)

  box.ruleThickness = ruleThick
  const surdW = scaledFs * 0.5
  box.surdWidth = surdW

  const children: PositionedBox[] = [
    mkPos(radPb.box, surdW, 0, radPb.children),
  ]

  // Optional nth-root index positioned at top-left of surd
  if (box.index) {
    const idxPb = layoutMath(box.index, "scriptscript", fontSize)
    const totalAbove = radPb.box.height + gap + ruleThick + extra
    const idxY = -(totalAbove - idxPb.box.depth * 0.6)
    children.push(mkPos(idxPb.box, 0, idxY, idxPb.children))
  }

  box.width = surdW + radPb.box.width
  box.height = radPb.box.height + gap + ruleThick + extra
  box.depth = radPb.box.depth

  return mkPos(box, 0, 0, children)
}

// --- Accent layout ---

function layoutAccent(box: AccentBox, style: MathStyle, fontSize: number): PositionedBox {
  const basePb = layoutMath(box.base, style, fontSize)
  const scaledFs = fontSize * getStyleScale(style)
  const accentBaseH = getTexParam("accentBaseHeight", scaledFs)
  const m = getMetrics(box.accent, fontSize, style)

  const accentSym: SymbolBox = {
    type: "symbol",
    char: box.accent,
    fontFamily: "serif",
    fontSize: scaledFs,
    width: box.isWide ? basePb.box.width : m.width,
    height: m.height,
    depth: m.depth,
    atomType: "ord",
    italicCorrection: 0,
  }

  const accentX = (basePb.box.width - accentSym.width) / 2
  const shift = Math.max(basePb.box.height, accentBaseH)

  const children: PositionedBox[] = [
    mkPos(basePb.box, 0, 0, basePb.children),
    mkPos(accentSym, accentX, -(shift + m.depth)),
  ]

  const bounds = computeBounds(children)
  box.width = basePb.box.width
  box.height = bounds.height
  box.depth = bounds.depth

  return mkPos(box, 0, 0, children)
}

// --- Matrix layout ---

function layoutMatrix(box: MatrixBox, style: MathStyle, fontSize: number): PositionedBox {
  if (box.rows.length === 0) {
    box.width = 0
    box.height = 0
    box.depth = 0
    return mkPos(box, 0, 0, [])
  }

  const scaledFs = fontSize * getStyleScale(style)
  const cells = box.rows.map(row => row.map(cell => layoutMath(cell, style, fontSize)))

  const numCols = Math.max(...box.rows.map(r => r.length))
  const colW: number[] = new Array(numCols).fill(0)
  const rowH: number[] = []
  const rowD: number[] = []

  for (let r = 0; r < cells.length; r++) {
    const row = cells[r]!
    let maxH = 0
    let maxD = 0
    for (let c = 0; c < row.length; c++) {
      const cell = row[c]!
      colW[c] = Math.max(colW[c] ?? 0, cell.box.width)
      maxH = Math.max(maxH, cell.box.height)
      maxD = Math.max(maxD, cell.box.depth)
    }
    rowH.push(maxH)
    rowD.push(maxD)
  }

  const colGap = box.colSpacing || scaledFs * 0.5
  const rowGap = box.rowSpacing || scaledFs * 0.2

  const totalW = colW.reduce((a, b) => a + b, 0) + Math.max(0, numCols - 1) * colGap
  let totalH = 0
  for (let r = 0; r < rowH.length; r++) {
    totalH += rowH[r]! + rowD[r]!
    if (r < rowH.length - 1) totalH += rowGap
  }

  // Center vertically on math axis
  const axis = getTexParam("axisHeight", scaledFs)
  let curTop = -(axis + totalH / 2)
  const result: PositionedBox[] = []

  for (let r = 0; r < cells.length; r++) {
    const row = cells[r]!
    const baselineY = curTop + rowH[r]!
    let curX = 0
    for (let c = 0; c < row.length; c++) {
      const cell = row[c]!
      const cw = colW[c] ?? 0
      const align = (box.colAlignment && box.colAlignment[c]) || "c"
      let cellX = curX
      if (align === "c") cellX += (cw - cell.box.width) / 2
      else if (align === "r") cellX += cw - cell.box.width
      result.push(mkPos(cell.box, cellX, baselineY, cell.children))
      curX += cw
      if (c < numCols - 1) curX += colGap
    }
    curTop = baselineY + rowD[r]!
    if (r < cells.length - 1) curTop += rowGap
  }

  const bounds = computeBounds(result)
  box.width = totalW
  box.height = bounds.height
  box.depth = bounds.depth

  return mkPos(box, 0, 0, result)
}

// --- Phantom layout ---

function layoutPhantom(box: PhantomBox, style: MathStyle, fontSize: number): PositionedBox {
  const childPb = layoutMath(box.child, style, fontSize)
  box.width = box.showWidth ? childPb.box.width : 0
  box.height = box.showHeight ? childPb.box.height : 0
  box.depth = box.showHeight ? childPb.box.depth : 0
  return mkPos(box, 0, 0, [mkPos(childPb.box, 0, 0, childPb.children)])
}

// --- Main entry ---

export function layoutMath(
  box: MathBox,
  style: MathStyle,
  fontSize: number,
): PositionedBox {
  switch (box.type) {
    case "symbol": return layoutSymbol(box, style, fontSize)
    case "text": return layoutText(box, style, fontSize)
    case "space": return layoutSpace(box, style, fontSize)
    case "operator": return layoutOp(box, style, fontSize)
    case "delimiter": return layoutDelim(box, style, fontSize)
    case "hbox": return layoutHBox(box, style, fontSize)
    case "vbox": return layoutVBox(box, style, fontSize)
    case "script": return layoutScript(box, style, fontSize)
    case "fraction": return layoutFraction(box, style, fontSize)
    case "radical": return layoutRadical(box, style, fontSize)
    case "accent": return layoutAccent(box, style, fontSize)
    case "matrix": return layoutMatrix(box, style, fontSize)
    case "phantom": return layoutPhantom(box, style, fontSize)
  }
}
