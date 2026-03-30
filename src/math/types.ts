// PreTeX core box model types

// --- Math styles ---

export type MathStyle = "display" | "text" | "script" | "scriptscript"

export type CrampedMathStyle =
  | "display-cramped"
  | "text-cramped"
  | "script-cramped"
  | "scriptscript-cramped"

export type MathStyleWithCramped = MathStyle | CrampedMathStyle

export const crampedStyle = (style: MathStyle): CrampedMathStyle =>
  `${style}-cramped` as CrampedMathStyle

export const nextScriptStyle = (style: MathStyle): MathStyle => {
  const transitions: Record<MathStyle, MathStyle> = {
    display: "script",
    text: "script",
    script: "scriptscript",
    scriptscript: "scriptscript",
  }
  return transitions[style]
}

export const nextCrampedStyle = (style: MathStyle): CrampedMathStyle =>
  crampedStyle(style)

export const styleSizeFactor = (style: MathStyle): number => {
  const factors: Record<MathStyle, number> = {
    display: 1.0,
    text: 1.0,
    script: 0.7,
    scriptscript: 0.5,
  }
  return factors[style]
}

// --- Atom types (TeX classification for spacing) ---

export type MathAtom = "ord" | "op" | "bin" | "rel" | "open" | "close" | "punct" | "inner"

// TeX inter-atom spacing table
// Values are in mu (math units, 1mu = 1/18 em)
// 0 = no space, 1 = thin space (3mu), 2 = medium space (4mu), 3 = thick space (5mu)
type SpacingLevel = 0 | 1 | 2 | 3

const SPACING_TABLE: Record<MathAtom, Record<MathAtom, SpacingLevel>> = {
  //             ord  op   bin  rel  open close punct inner
  ord:   { ord: 0, op: 1, bin: 2, rel: 3, open: 0, close: 0, punct: 0, inner: 1 },
  op:    { ord: 1, op: 1, bin: 0, rel: 3, open: 0, close: 0, punct: 0, inner: 1 },
  bin:   { ord: 2, op: 2, bin: 0, rel: 0, open: 2, close: 0, punct: 0, inner: 2 },
  rel:   { ord: 3, op: 3, bin: 0, rel: 0, open: 3, close: 0, punct: 0, inner: 3 },
  open:  { ord: 0, op: 0, bin: 0, rel: 0, open: 0, close: 0, punct: 0, inner: 0 },
  close: { ord: 0, op: 1, bin: 2, rel: 3, open: 0, close: 0, punct: 0, inner: 1 },
  punct: { ord: 1, op: 1, bin: 0, rel: 1, open: 1, close: 1, punct: 1, inner: 1 },
  inner: { ord: 1, op: 1, bin: 2, rel: 3, open: 1, close: 0, punct: 1, inner: 1 },
}

const MU_VALUES: Record<SpacingLevel, number> = {
  0: 0,
  1: 3,  // thin space
  2: 4,  // medium space
  3: 5,  // thick space
}

/** Returns inter-atom spacing in mu (math units). In script/scriptscript styles, thin spaces are suppressed. */
export const atomSpacing = (left: MathAtom, right: MathAtom, style: MathStyle): number => {
  const level = SPACING_TABLE[left][right]
  // In script and scriptscript styles, only thick spaces survive (TeX behavior)
  if ((style === "script" || style === "scriptscript") && level < 3) return 0
  return MU_VALUES[level]
}

// --- Font style ---

export type FontStyle = "normal" | "italic" | "bold" | "bold-italic"

// --- Box types ---

type BoxBase = {
  width: number
  height: number
  depth: number
}

export type HBox = BoxBase & {
  type: "hbox"
  children: MathBox[]
  shift: number // vertical shift for baseline alignment
}

export type VBoxChild = {
  box: MathBox
  shift: number // horizontal shift
}

export type VBox = BoxBase & {
  type: "vbox"
  children: VBoxChild[]
}

export type FractionBox = BoxBase & {
  type: "fraction"
  numerator: MathBox
  denominator: MathBox
  barThickness: number
  numShift: number   // vertical shift of numerator above baseline
  denomShift: number // vertical shift of denominator below baseline
}

export type RadicalBox = BoxBase & {
  type: "radical"
  radicand: MathBox
  index: MathBox | null // nth root index, null for square root
  surdWidth: number
  ruleThickness: number
}

export type ScriptBox = BoxBase & {
  type: "script"
  base: MathBox
  superscript: MathBox | null
  subscript: MathBox | null
}

export type DelimiterBox = BoxBase & {
  type: "delimiter"
  char: string
  targetSize: number // requested size
  actualSize: number // size achieved (may differ for extensible delimiters)
}

export type SpaceBox = BoxBase & {
  type: "space"
}

export type TextBox = BoxBase & {
  type: "text"
  text: string
  fontFamily: string
  fontSize: number
  fontStyle: FontStyle
}

export type SymbolBox = BoxBase & {
  type: "symbol"
  char: string
  fontFamily: string
  fontSize: number
  atomType: MathAtom
  italicCorrection: number
}

export type OperatorBox = BoxBase & {
  type: "operator"
  char: string
  limits: boolean    // whether limits go above/below (vs superscript/subscript)
  fontSize: number
  displaySize: number // larger size used in display style
}

export type AccentBox = BoxBase & {
  type: "accent"
  base: MathBox
  accent: string
  isWide: boolean // wide accents like \widehat stretch to cover base
}

export type MatrixBox = BoxBase & {
  type: "matrix"
  rows: MathBox[][]
  colAlignment: ("l" | "c" | "r")[]
  rowSpacing: number
  colSpacing: number
  leftDelim: string | null
  rightDelim: string | null
}

export type PhantomBox = BoxBase & {
  type: "phantom"
  child: MathBox
  showWidth: boolean  // if false, width is 0
  showHeight: boolean // if false, height and depth are 0
}

// --- Union type ---

export type MathBox =
  | HBox
  | VBox
  | FractionBox
  | RadicalBox
  | ScriptBox
  | DelimiterBox
  | SpaceBox
  | TextBox
  | SymbolBox
  | OperatorBox
  | AccentBox
  | MatrixBox
  | PhantomBox

// --- Positioned box (layout output) ---

export type PositionedBox = {
  box: MathBox
  x: number
  y: number
  children: PositionedBox[]
}
