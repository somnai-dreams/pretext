// PreTeX LaTeX parser

import type {
  MathBox,
  HBox,
  FractionBox,
  RadicalBox,
  ScriptBox,
  TextBox,
  SymbolBox,
  OperatorBox,
} from "./types"
import { MATH_SYMBOLS } from "./symbols"

const OPERATOR_COMMANDS = new Set(["sum", "prod", "int", "lim", "max", "min"])

function makeSymbol(char: string): SymbolBox {
  return {
    type: "symbol",
    char,
    fontFamily: "serif",
    fontSize: 10,
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

type ParseResult = {
  box: MathBox
  pos: number
}

function parseGroup(input: string, pos: number): ParseResult {
  // Expects pos to be right after '{'
  const children: MathBox[] = []
  let i = pos
  while (i < input.length && input[i] !== "}") {
    const result = parseToken(input, i)
    children.push(result.box)
    i = result.pos
  }
  if (i < input.length) i++ // skip '}'
  return {
    box: children.length === 1 ? children[0] : makeHBox(children),
    pos: i,
  }
}

function parseCommand(input: string, pos: number): ParseResult {
  // pos is right after '\'
  let i = pos
  let name = ""
  while (i < input.length && /[a-zA-Z]/.test(input[i])) {
    name += input[i]
    i++
  }

  if (name === "frac") {
    // expect two groups
    if (i < input.length && input[i] === "{") {
      const num = parseGroup(input, i + 1)
      i = num.pos
      if (i < input.length && input[i] === "{") {
        const den = parseGroup(input, i + 1)
        const box: FractionBox = {
          type: "fraction",
          numerator: num.box,
          denominator: den.box,
          barThickness: 0.4,
          width: 0,
          height: 0,
          depth: 0,
        }
        return { box, pos: den.pos }
      }
    }
  }

  if (name === "sqrt") {
    if (i < input.length && input[i] === "{") {
      const radicand = parseGroup(input, i + 1)
      const box: RadicalBox = {
        type: "radical",
        radicand: radicand.box,
        index: null,
        surdWidth: 0.5,
        width: 0,
        height: 0,
        depth: 0,
      }
      return { box, pos: radicand.pos }
    }
  }

  if (name === "text") {
    if (i < input.length && input[i] === "{") {
      let text = ""
      i++ // skip '{'
      while (i < input.length && input[i] !== "}") {
        text += input[i]
        i++
      }
      if (i < input.length) i++ // skip '}'
      const box: TextBox = {
        type: "text",
        text,
        fontFamily: "serif",
        fontSize: 10,
        fontStyle: "normal",
        width: 0,
        height: 0,
        depth: 0,
      }
      return { box, pos: i }
    }
  }

  // Check operator commands
  if (OPERATOR_COMMANDS.has(name)) {
    const char = MATH_SYMBOLS[name] ?? name
    const box: OperatorBox = {
      type: "operator",
      char,
      limits: true,
      fontSize: 10,
      width: 0,
      height: 0,
      depth: 0,
    }
    return { box, pos: i }
  }

  // General symbol command
  const char = MATH_SYMBOLS[name] ?? name
  return { box: makeSymbol(char), pos: i }
}

function parseToken(input: string, pos: number): ParseResult {
  const ch = input[pos]

  if (ch === "\\") {
    return parseCommand(input, pos + 1)
  }

  if (ch === "{") {
    return parseGroup(input, pos + 1)
  }

  if (ch === " ") {
    return { box: { type: "space", width: 0, height: 0, depth: 0 }, pos: pos + 1 }
  }

  // Plain character
  return { box: makeSymbol(ch), pos: pos + 1 }
}

function attachScripts(
  base: MathBox,
  input: string,
  pos: number,
): ParseResult {
  let i = pos
  let superscript: MathBox | null = null
  let subscript: MathBox | null = null

  while (i < input.length) {
    if (input[i] === "^") {
      i++
      if (i < input.length && input[i] === "{") {
        const result = parseGroup(input, i + 1)
        superscript = result.box
        i = result.pos
      } else if (i < input.length) {
        superscript = makeSymbol(input[i])
        i++
      }
    } else if (input[i] === "_") {
      i++
      if (i < input.length && input[i] === "{") {
        const result = parseGroup(input, i + 1)
        subscript = result.box
        i = result.pos
      } else if (i < input.length) {
        subscript = makeSymbol(input[i])
        i++
      }
    } else {
      break
    }
  }

  if (superscript !== null || subscript !== null) {
    const box: ScriptBox = {
      type: "script",
      base,
      superscript,
      subscript,
      width: 0,
      height: 0,
      depth: 0,
    }
    return { box, pos: i }
  }

  return { box: base, pos: i }
}

export function parseMath(input: string): MathBox {
  const children: MathBox[] = []
  let i = 0

  while (i < input.length) {
    const result = parseToken(input, i)
    // Check for trailing ^ or _
    const withScripts = attachScripts(result.box, input, result.pos)
    children.push(withScripts.box)
    i = withScripts.pos
  }

  if (children.length === 0) {
    return makeHBox([])
  }

  if (children.length === 1) {
    return children[0]
  }

  return makeHBox(children)
}
