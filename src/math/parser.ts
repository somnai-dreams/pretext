// PreTeX LaTeX math parser — recursive descent

import type {
  MathBox,
  HBox,
  FractionBox,
  RadicalBox,
  ScriptBox,
  DelimiterBox,
  SpaceBox,
  TextBox,
  SymbolBox,
  OperatorBox,
} from "./types"
import { MATH_SYMBOLS } from "./symbols"

// --- Operator commands that get limits by default ---

const OPERATOR_COMMANDS = new Set([
  "sum", "prod", "int", "iint", "iiint", "oint",
  "lim", "limsup", "liminf",
  "max", "min", "sup", "inf",
  "det", "gcd", "log", "ln", "exp", "sin", "cos", "tan",
  "sec", "csc", "cot", "arcsin", "arccos", "arctan",
  "sinh", "cosh", "tanh",
  "dim", "ker", "hom", "deg",
])

const LIMITS_OPERATORS = new Set([
  "sum", "prod", "int", "iint", "iiint", "oint",
  "lim", "limsup", "liminf",
  "max", "min", "sup", "inf",
])

// --- Spacing command widths (in em units) ---

const SPACING_COMMANDS: Record<string, number> = {
  ",": 0.167,   // \,  thin space
  ":": 0.222,   // \:  medium space (also \;)
  ";": 0.278,   // \;  thick space
  "!": -0.167,  // \!  negative thin space
  "quad": 1.0,
  "qquad": 2.0,
}

// --- Font style commands ---

const FONT_STYLE_COMMANDS: Record<string, { fontFamily: string; fontStyle: string }> = {
  mathbb: { fontFamily: "double-struck", fontStyle: "normal" },
  mathcal: { fontFamily: "script", fontStyle: "normal" },
  mathbf: { fontFamily: "serif", fontStyle: "bold" },
  mathrm: { fontFamily: "serif", fontStyle: "normal" },
  mathit: { fontFamily: "serif", fontStyle: "italic" },
  mathsf: { fontFamily: "sans-serif", fontStyle: "normal" },
  mathtt: { fontFamily: "monospace", fontStyle: "normal" },
  boldsymbol: { fontFamily: "serif", fontStyle: "bold" },
}

// --- Delimiter pairs ---

const LEFT_DELIMITERS: Record<string, string> = {
  "(": "(",
  "[": "[",
  "\\{": "{",
  "|": "|",
  "\\|": "‖",
  ".": "",  // invisible delimiter
}

const RIGHT_DELIMITERS: Record<string, string> = {
  ")": ")",
  "]": "]",
  "\\}": "}",
  "|": "|",
  "\\|": "‖",
  ".": "",
}

// --- Factory functions ---

function makeSymbol(char: string, fontFamily = "serif", fontSize = 10): SymbolBox {
  return {
    type: "symbol",
    char,
    fontFamily,
    fontSize,
    width: 0,
    height: 0,
    depth: 0,
  }
}

function makeHBox(children: MathBox[]): HBox {
  return {
    type: "hbox",
    children,
    width: 0,
    height: 0,
    depth: 0,
  }
}

function makeSpace(width: number): SpaceBox {
  return {
    type: "space",
    width,
    height: 0,
    depth: 0,
  }
}

function makeText(text: string, fontFamily = "serif", fontStyle = "normal"): TextBox {
  return {
    type: "text",
    text,
    fontFamily,
    fontSize: 10,
    fontStyle,
    width: 0,
    height: 0,
    depth: 0,
  }
}

function makeOperator(name: string): OperatorBox {
  const char = MATH_SYMBOLS[name] ?? name
  return {
    type: "operator",
    char,
    limits: LIMITS_OPERATORS.has(name),
    fontSize: 10,
    width: 0,
    height: 0,
    depth: 0,
  }
}

function makeDelimiter(char: string, size = 1): DelimiterBox {
  return {
    type: "delimiter",
    char,
    size,
    width: 0,
    height: 0,
    depth: 0,
  }
}

function makeFraction(numerator: MathBox, denominator: MathBox): FractionBox {
  return {
    type: "fraction",
    numerator,
    denominator,
    barThickness: 0.4,
    width: 0,
    height: 0,
    depth: 0,
  }
}

function makeRadical(radicand: MathBox, index: MathBox | null): RadicalBox {
  return {
    type: "radical",
    radicand,
    index,
    surdWidth: 0.5,
    width: 0,
    height: 0,
    depth: 0,
  }
}

function makeScript(
  base: MathBox,
  superscript: MathBox | null,
  subscript: MathBox | null,
): ScriptBox {
  return {
    type: "script",
    base,
    superscript,
    subscript,
    width: 0,
    height: 0,
    depth: 0,
  }
}

// --- Parse result ---

type ParseResult = {
  box: MathBox
  pos: number
}

// --- Core parsing ---

/** Read a brace-delimited group. `pos` should be right after the opening '{'. */
function parseGroup(input: string, pos: number): ParseResult {
  const children: MathBox[] = []
  let i = pos
  while (i < input.length && input[i] !== "}") {
    const result = parseExpr(input, i)
    children.push(result.box)
    i = result.pos
  }
  if (i < input.length) i++ // skip '}'
  return {
    box: children.length === 1 ? children[0] : makeHBox(children),
    pos: i,
  }
}

/** Read a required brace group or single token if no brace. */
function parseRequiredArg(input: string, pos: number): ParseResult {
  if (pos < input.length && input[pos] === "{") {
    return parseGroup(input, pos + 1)
  }
  // Single token fallback
  if (pos < input.length) {
    return parseToken(input, pos)
  }
  return { box: makeHBox([]), pos }
}

/** Read an alphabetic command name starting at `pos` (right after backslash). */
function readCommandName(input: string, pos: number): { name: string; pos: number } {
  let i = pos
  let name = ""
  while (i < input.length && /[a-zA-Z]/.test(input[i])) {
    name += input[i]
    i++
  }
  return { name, pos: i }
}

/** Try to read a delimiter token for \left / \right. */
function readDelimiterToken(input: string, pos: number): { char: string; pos: number } | null {
  if (pos >= input.length) return null

  // Backslash-prefixed delimiters: \{ \} \|
  if (input[pos] === "\\") {
    const next = pos + 1 < input.length ? input[pos + 1] : ""
    if (next === "{" || next === "}" || next === "|") {
      return { char: "\\" + next, pos: pos + 2 }
    }
    // \langle, \rangle etc — read as command
    const cmd = readCommandName(input, pos + 1)
    if (cmd.name === "langle") return { char: "⟨", pos: cmd.pos }
    if (cmd.name === "rangle") return { char: "⟩", pos: cmd.pos }
    if (cmd.name === "lfloor") return { char: "⌊", pos: cmd.pos }
    if (cmd.name === "rfloor") return { char: "⌋", pos: cmd.pos }
    if (cmd.name === "lceil") return { char: "⌈", pos: cmd.pos }
    if (cmd.name === "rceil") return { char: "⌉", pos: cmd.pos }
    return null
  }

  // Single character delimiters
  const ch = input[pos]
  if ("()[]|.".includes(ch)) {
    return { char: ch, pos: pos + 1 }
  }

  return null
}

/** Parse \left ... \right pair. `pos` is right after "left". */
function parseLeftRight(input: string, pos: number): ParseResult {
  const leftDelim = readDelimiterToken(input, pos)
  if (!leftDelim) {
    return { box: makeSymbol("("), pos }
  }

  const leftChar = LEFT_DELIMITERS[leftDelim.char] ?? leftDelim.char
  const children: MathBox[] = [makeDelimiter(leftChar)]
  let i = leftDelim.pos

  // Parse until \right
  while (i < input.length) {
    if (input[i] === "\\" && input.slice(i + 1, i + 6) === "right") {
      i += 6 // skip \right
      const rightDelim = readDelimiterToken(input, i)
      if (rightDelim) {
        const rightChar = RIGHT_DELIMITERS[rightDelim.char] ?? rightDelim.char
        children.push(makeDelimiter(rightChar))
        i = rightDelim.pos
      }
      return { box: makeHBox(children), pos: i }
    }

    const result = parseExpr(input, i)
    children.push(result.box)
    i = result.pos
  }

  // Unmatched \left — return what we have
  return { box: makeHBox(children), pos: i }
}

/** Parse \begin{env}...\end{env}. `pos` is right after "begin". */
function parseEnvironment(input: string, pos: number): ParseResult {
  // Read environment name
  if (pos >= input.length || input[pos] !== "{") {
    return { box: makeHBox([]), pos }
  }
  let i = pos + 1
  let envName = ""
  while (i < input.length && input[i] !== "}") {
    envName += input[i]
    i++
  }
  if (i < input.length) i++ // skip '}'

  // Parse rows until \end{envName}
  const endTag = "\\end{" + envName + "}"
  const rows: MathBox[][] = []
  let currentRow: MathBox[] = []
  let currentCell: MathBox[] = []

  while (i < input.length) {
    // Check for \end{envName}
    if (input.slice(i, i + endTag.length) === endTag) {
      // Flush current cell/row
      if (currentCell.length > 0) {
        currentRow.push(currentCell.length === 1 ? currentCell[0] : makeHBox(currentCell))
      }
      if (currentRow.length > 0) {
        rows.push(currentRow)
      }
      i += endTag.length
      break
    }

    // Row separator \\
    if (input[i] === "\\" && i + 1 < input.length && input[i + 1] === "\\") {
      if (currentCell.length > 0) {
        currentRow.push(currentCell.length === 1 ? currentCell[0] : makeHBox(currentCell))
      }
      rows.push(currentRow)
      currentRow = []
      currentCell = []
      i += 2
      continue
    }

    // Column separator &
    if (input[i] === "&") {
      currentRow.push(currentCell.length === 1 ? currentCell[0] : makeHBox(currentCell))
      currentCell = []
      i++
      continue
    }

    // Skip whitespace between tokens
    if (input[i] === " " || input[i] === "\n" || input[i] === "\t") {
      i++
      continue
    }

    const result = parseExpr(input, i)
    currentCell.push(result.box)
    i = result.pos
  }

  // Determine delimiter chars based on environment
  let leftChar = ""
  let rightChar = ""
  if (envName === "pmatrix") { leftChar = "("; rightChar = ")" }
  else if (envName === "bmatrix") { leftChar = "["; rightChar = "]" }
  else if (envName === "Bmatrix") { leftChar = "{"; rightChar = "}" }
  else if (envName === "vmatrix") { leftChar = "|"; rightChar = "|" }
  else if (envName === "Vmatrix") { leftChar = "‖"; rightChar = "‖" }
  // matrix and cases — no delimiters (or { for cases)
  else if (envName === "cases") { leftChar = "{"; rightChar = "" }

  // Build matrix as VBox of HBoxes (rows), wrapped in delimiters
  const rowBoxes: MathBox[] = rows.map(row => makeHBox(row))
  const matrixBody: MathBox = {
    type: "vbox",
    children: rowBoxes,
    width: 0,
    height: 0,
    depth: 0,
  }

  const outerChildren: MathBox[] = []
  if (leftChar) outerChildren.push(makeDelimiter(leftChar))
  outerChildren.push(matrixBody)
  if (rightChar) outerChildren.push(makeDelimiter(rightChar))

  return {
    box: outerChildren.length === 1 ? outerChildren[0] : makeHBox(outerChildren),
    pos: i,
  }
}

/** Parse a backslash command. `pos` is right after the backslash. */
function parseCommand(input: string, pos: number): ParseResult {
  // Single-character commands (spacing: \, \; \: \!)
  if (pos < input.length && !(/[a-zA-Z]/.test(input[pos]))) {
    const ch = input[pos]
    const spaceWidth = SPACING_COMMANDS[ch]
    if (spaceWidth !== undefined) {
      return { box: makeSpace(spaceWidth), pos: pos + 1 }
    }
    // Unknown single-char command — treat as symbol
    return { box: makeSymbol(ch), pos: pos + 1 }
  }

  const { name, pos: afterName } = readCommandName(input, pos)
  let i = afterName

  // --- Fraction ---
  if (name === "frac") {
    const num = parseRequiredArg(input, i)
    const den = parseRequiredArg(input, num.pos)
    return { box: makeFraction(num.box, den.box), pos: den.pos }
  }

  // --- Square root / nth root ---
  if (name === "sqrt") {
    let index: MathBox | null = null
    // Check for optional [n] index
    if (i < input.length && input[i] === "[") {
      i++ // skip '['
      const indexChildren: MathBox[] = []
      while (i < input.length && input[i] !== "]") {
        const r = parseExpr(input, i)
        indexChildren.push(r.box)
        i = r.pos
      }
      if (i < input.length) i++ // skip ']'
      index = indexChildren.length === 1 ? indexChildren[0] : makeHBox(indexChildren)
    }
    const radicand = parseRequiredArg(input, i)
    return { box: makeRadical(radicand.box, index), pos: radicand.pos }
  }

  // --- \text ---
  if (name === "text" || name === "textrm" || name === "textit" || name === "textbf") {
    if (i < input.length && input[i] === "{") {
      let text = ""
      i++ // skip '{'
      let braceDepth = 1
      while (i < input.length && braceDepth > 0) {
        if (input[i] === "{") braceDepth++
        else if (input[i] === "}") {
          braceDepth--
          if (braceDepth === 0) break
        }
        text += input[i]
        i++
      }
      if (i < input.length) i++ // skip '}'
      const style = name === "textbf" ? "bold" : name === "textit" ? "italic" : "normal"
      return { box: makeText(text, "serif", style), pos: i }
    }
  }

  // --- \left ... \right ---
  if (name === "left") {
    return parseLeftRight(input, i)
  }

  // --- \begin{env} ---
  if (name === "begin") {
    return parseEnvironment(input, i)
  }

  // --- Font style commands (\mathbb, \mathcal, etc.) ---
  const fontStyle = FONT_STYLE_COMMANDS[name]
  if (fontStyle) {
    const arg = parseRequiredArg(input, i)
    // Apply font to all symbol children
    const styled = applyFontStyle(arg.box, fontStyle.fontFamily, fontStyle.fontStyle)
    return { box: styled, pos: arg.pos }
  }

  // --- Spacing commands (multi-char: \quad, \qquad) ---
  const spaceWidth = SPACING_COMMANDS[name]
  if (spaceWidth !== undefined) {
    return { box: makeSpace(spaceWidth), pos: i }
  }

  // --- Operator commands ---
  if (OPERATOR_COMMANDS.has(name)) {
    return { box: makeOperator(name), pos: i }
  }

  // --- General symbol via symbols.ts lookup ---
  const char = MATH_SYMBOLS[name]
  if (char !== undefined) {
    return { box: makeSymbol(char), pos: i }
  }

  // Unknown command — render name as text fallback
  return { box: makeSymbol(name), pos: i }
}

/** Apply font family/style to a box tree (recursively for containers). */
function applyFontStyle(box: MathBox, fontFamily: string, fontStyle: string): MathBox {
  if (box.type === "symbol") {
    return { ...box, fontFamily }
  }
  if (box.type === "text") {
    return { ...box, fontFamily, fontStyle }
  }
  if (box.type === "hbox") {
    return { ...box, children: box.children.map(c => applyFontStyle(c, fontFamily, fontStyle)) }
  }
  return box
}

/** Parse a single token (no script attachment). */
function parseToken(input: string, pos: number): ParseResult {
  const ch = input[pos]

  if (ch === "\\") {
    return parseCommand(input, pos + 1)
  }

  if (ch === "{") {
    return parseGroup(input, pos + 1)
  }

  if (ch === " " || ch === "\n" || ch === "\t") {
    return { box: makeSpace(0), pos: pos + 1 }
  }

  // Plain character
  return { box: makeSymbol(ch), pos: pos + 1 }
}

/** Parse a token and attach any trailing super/subscripts. */
function parseExpr(input: string, pos: number): ParseResult {
  const result = parseToken(input, pos)
  return attachScripts(result.box, input, result.pos)
}

/** Consume trailing ^ and _ to form a ScriptBox. */
function attachScripts(base: MathBox, input: string, pos: number): ParseResult {
  let i = pos
  let sup: MathBox | null = null
  let sub: MathBox | null = null

  while (i < input.length) {
    if (input[i] === "^" && sup === null) {
      i++
      const result = parseRequiredArg(input, i)
      sup = result.box
      i = result.pos
    } else if (input[i] === "_" && sub === null) {
      i++
      const result = parseRequiredArg(input, i)
      sub = result.box
      i = result.pos
    } else {
      break
    }
  }

  if (sup !== null || sub !== null) {
    return { box: makeScript(base, sup, sub), pos: i }
  }

  return { box: base, pos: i }
}

// --- Public API ---

export function parseMath(input: string): MathBox {
  const children: MathBox[] = []
  let i = 0

  while (i < input.length) {
    const result = parseExpr(input, i)
    children.push(result.box)
    i = result.pos
  }

  if (children.length === 0) return makeHBox([])
  if (children.length === 1) return children[0]
  return makeHBox(children)
}
