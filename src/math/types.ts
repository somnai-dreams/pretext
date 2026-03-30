// PreTeX core box model types

export type MathStyle = "display" | "text" | "script" | "scriptscript"

export type MathBoxType =
  | "hbox"
  | "vbox"
  | "fraction"
  | "radical"
  | "script"
  | "delimiter"
  | "space"
  | "text"
  | "symbol"
  | "operator"

type BoxBase = {
  width: number
  height: number
  depth: number
}

export type HBox = BoxBase & {
  type: "hbox"
  children: MathBox[]
}

export type VBox = BoxBase & {
  type: "vbox"
  children: MathBox[]
}

export type FractionBox = BoxBase & {
  type: "fraction"
  numerator: MathBox
  denominator: MathBox
  barThickness: number
}

export type RadicalBox = BoxBase & {
  type: "radical"
  radicand: MathBox
  index: MathBox | null
  surdWidth: number
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
  size: number
}

export type SpaceBox = BoxBase & {
  type: "space"
}

export type TextBox = BoxBase & {
  type: "text"
  text: string
  fontFamily: string
  fontSize: number
  fontStyle: string
}

export type SymbolBox = BoxBase & {
  type: "symbol"
  char: string
  fontFamily: string
  fontSize: number
}

export type OperatorBox = BoxBase & {
  type: "operator"
  char: string
  limits: boolean
  fontSize: number
}

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

export type PositionedBox = {
  box: MathBox
  x: number
  y: number
}
