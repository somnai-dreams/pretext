// PreTeX font metrics — Computer Modern proportions normalized to fontSize
// Multiply returned values by fontSize to get pixel dimensions

import type { MathStyle } from "./types"

export type FontMetrics = {
  width: number
  height: number
  depth: number
  italicCorrection: number
}

// Style scaling factors relative to text size (TeX standard)
const styleScale: Record<MathStyle, number> = {
  display: 1.0,
  text: 1.0,
  script: 0.7,
  scriptscript: 0.5,
}

// TeX typesetting parameters (normalized to fontSize)
// Sourced from Computer Modern / TeX Book Appendix G
const texParams: Record<string, number> = {
  // Axis and rules
  axisHeight: 0.25, // center of fraction bar above baseline
  ruleThickness: 0.04, // thickness of fraction bars, radical bars

  // Fraction spacing
  fractionNumeratorShiftUp: 0.676, // display style numerator rise
  fractionNumeratorShiftUpText: 0.394, // text style numerator rise
  fractionDenominatorShiftDown: 0.686, // display style denominator drop
  fractionDenominatorShiftDownText: 0.345, // text style denominator drop
  fractionNumeratorGapMin: 0.12, // min gap above fraction bar (display)
  fractionNumeratorGapMinText: 0.04, // min gap above fraction bar (text)
  fractionDenominatorGapMin: 0.12, // min gap below fraction bar (display)
  fractionDenominatorGapMinText: 0.04, // min gap below fraction bar (text)

  // Superscript/subscript
  supShift: 0.413, // superscript baseline rise (display/text)
  supShiftCramped: 0.363, // superscript rise in cramped mode
  supShiftScript: 0.363, // superscript rise at script size
  subShift: 0.15, // subscript baseline drop
  supDrop: 0.386, // how much super drops relative to top of base
  subDrop: 0.05, // how much sub drops relative to bottom of base
  subSuperGapMin: 0.16, // min gap between sub and super
  superBottomMin: 0.125, // min distance from super bottom to baseline
  subTopMax: 0.8, // max height of subscript (fraction of x-height)

  // Big operators
  bigOpSpacing1: 0.111, // above upper limit
  bigOpSpacing2: 0.167, // below upper limit baseline
  bigOpSpacing3: 0.2, // above lower limit top
  bigOpSpacing4: 0.6, // below lower limit baseline
  bigOpSpacing5: 0.1, // padding above/below limits

  // Delimiters
  delimiterFactor: 901, // TeX \delimiterfactor (per mille)
  delimiterShortfall: 0.5, // max shortfall in points at 10pt

  // Radical
  radicalVerticalGap: 0.05, // gap above radicand (text)
  radicalVerticalGapDisplay: 0.1, // gap above radicand (display)
  radicalRuleThickness: 0.04, // radical bar thickness
  radicalExtraAscender: 0.04, // extra height above radical bar

  // Spacing (in mu = 1/18 em, converted to em)
  thinSpace: 3 / 18, // thin space (3mu)
  medSpace: 4 / 18, // medium space (4mu)
  thickSpace: 5 / 18, // thick space (5mu)

  // General
  xHeight: 0.431, // x-height of text font
  quad: 1.0, // 1em
  extraSpace: 0.0555, // extra space after period

  // Stack/limit
  stackTopShiftUp: 0.686,
  stackBottomShiftDown: 0.686,
  stackGapMin: 0.2,
  stackDisplayGapMin: 0.42,

  // Accent
  accentBaseHeight: 0.431, // don't shift accent if base is shorter than this
  flattenedAccentBaseHeight: 0.646,
}

// --- Character metric tables ---
// All values normalized: multiply by fontSize for pixels
// Format: [width, height, depth, italicCorrection]

type MetricTuple = [number, number, number, number]

// Latin lowercase (cmmi10 — math italic)
const latinLower: Record<string, MetricTuple> = {
  a: [0.529, 0.431, 0.0, 0.0],
  b: [0.429, 0.694, 0.0, 0.0],
  c: [0.433, 0.431, 0.0, 0.0],
  d: [0.52, 0.694, 0.0, 0.069],
  e: [0.466, 0.431, 0.0, 0.0],
  f: [0.49, 0.694, 0.194, 0.108],
  g: [0.477, 0.431, 0.194, 0.036],
  h: [0.576, 0.694, 0.0, 0.0],
  i: [0.345, 0.66, 0.0, 0.0],
  j: [0.412, 0.66, 0.194, 0.0],
  k: [0.521, 0.694, 0.0, 0.0],
  l: [0.298, 0.694, 0.0, 0.0],
  m: [0.878, 0.431, 0.0, 0.0],
  n: [0.6, 0.431, 0.0, 0.0],
  o: [0.485, 0.431, 0.0, 0.0],
  p: [0.503, 0.431, 0.194, 0.0],
  q: [0.446, 0.431, 0.194, 0.0],
  r: [0.451, 0.431, 0.0, 0.0],
  s: [0.469, 0.431, 0.0, 0.0],
  t: [0.361, 0.615, 0.0, 0.0],
  u: [0.572, 0.431, 0.0, 0.0],
  v: [0.485, 0.431, 0.0, 0.069],
  w: [0.716, 0.431, 0.0, 0.069],
  x: [0.572, 0.431, 0.0, 0.0],
  y: [0.49, 0.431, 0.194, 0.069],
  z: [0.465, 0.431, 0.0, 0.0],
}

// Latin uppercase (cmmi10 — math italic)
const latinUpper: Record<string, MetricTuple> = {
  A: [0.75, 0.683, 0.0, 0.0],
  B: [0.759, 0.683, 0.0, 0.0],
  C: [0.715, 0.683, 0.0, 0.049],
  D: [0.828, 0.683, 0.0, 0.0],
  E: [0.738, 0.683, 0.0, 0.049],
  F: [0.643, 0.683, 0.0, 0.108],
  G: [0.786, 0.683, 0.0, 0.0],
  H: [0.831, 0.683, 0.0, 0.069],
  I: [0.44, 0.683, 0.0, 0.069],
  J: [0.555, 0.683, 0.0, 0.069],
  K: [0.849, 0.683, 0.0, 0.0],
  L: [0.681, 0.683, 0.0, 0.0],
  M: [0.97, 0.683, 0.0, 0.069],
  N: [0.803, 0.683, 0.0, 0.069],
  O: [0.763, 0.683, 0.0, 0.0],
  P: [0.642, 0.683, 0.0, 0.108],
  Q: [0.791, 0.683, 0.194, 0.0],
  R: [0.759, 0.683, 0.0, 0.0],
  S: [0.613, 0.683, 0.0, 0.049],
  T: [0.584, 0.683, 0.0, 0.108],
  U: [0.683, 0.683, 0.0, 0.069],
  V: [0.583, 0.683, 0.0, 0.222],
  W: [0.944, 0.683, 0.0, 0.139],
  X: [0.828, 0.683, 0.0, 0.0],
  Y: [0.581, 0.683, 0.0, 0.222],
  Z: [0.683, 0.683, 0.0, 0.0],
}

// Digits (cmr10 — upright)
const digits: Record<string, MetricTuple> = {
  "0": [0.5, 0.644, 0.0, 0.0],
  "1": [0.5, 0.644, 0.0, 0.0],
  "2": [0.5, 0.644, 0.0, 0.0],
  "3": [0.5, 0.644, 0.194, 0.0],
  "4": [0.5, 0.644, 0.0, 0.0],
  "5": [0.5, 0.644, 0.194, 0.0],
  "6": [0.5, 0.644, 0.0, 0.0],
  "7": [0.5, 0.644, 0.194, 0.0],
  "8": [0.5, 0.644, 0.0, 0.0],
  "9": [0.5, 0.644, 0.194, 0.0],
}

// Greek lowercase (cmmi10)
const greekLower: Record<string, MetricTuple> = {
  α: [0.64, 0.431, 0.0, 0.0],
  β: [0.566, 0.694, 0.194, 0.0],
  γ: [0.518, 0.431, 0.194, 0.069],
  δ: [0.444, 0.694, 0.0, 0.069],
  ε: [0.406, 0.431, 0.0, 0.0],
  ζ: [0.438, 0.694, 0.194, 0.0],
  η: [0.6, 0.431, 0.194, 0.0],
  θ: [0.501, 0.694, 0.0, 0.069],
  ι: [0.329, 0.431, 0.0, 0.0],
  κ: [0.521, 0.431, 0.0, 0.0],
  λ: [0.6, 0.694, 0.0, 0.0],
  μ: [0.572, 0.431, 0.194, 0.0],
  ν: [0.485, 0.431, 0.0, 0.069],
  ξ: [0.438, 0.694, 0.194, 0.069],
  ο: [0.485, 0.431, 0.0, 0.0],
  π: [0.572, 0.431, 0.0, 0.0],
  ρ: [0.517, 0.431, 0.194, 0.0],
  σ: [0.571, 0.431, 0.0, 0.0],
  ς: [0.394, 0.431, 0.194, 0.069],
  τ: [0.437, 0.431, 0.0, 0.069],
  υ: [0.54, 0.431, 0.0, 0.0],
  φ: [0.596, 0.694, 0.194, 0.069],
  χ: [0.572, 0.431, 0.194, 0.0],
  ψ: [0.6, 0.694, 0.194, 0.069],
  ω: [0.646, 0.431, 0.0, 0.0],
  ϵ: [0.406, 0.431, 0.0, 0.0], // lunate epsilon
  ϑ: [0.562, 0.694, 0.0, 0.069], // script theta
  ϕ: [0.596, 0.694, 0.194, 0.069], // straight phi
  ϱ: [0.517, 0.431, 0.194, 0.0], // varrho
  ϖ: [0.713, 0.431, 0.0, 0.0], // varpi
}

// Greek uppercase (cmr10 — upright, same as Latin in CM)
const greekUpper: Record<string, MetricTuple> = {
  Α: [0.75, 0.683, 0.0, 0.0], // Alpha = A
  Β: [0.708, 0.683, 0.0, 0.0], // Beta = B
  Γ: [0.625, 0.683, 0.0, 0.069],
  Δ: [0.833, 0.683, 0.0, 0.0],
  Ε: [0.681, 0.683, 0.0, 0.0], // Epsilon = E
  Ζ: [0.611, 0.683, 0.0, 0.0], // Zeta = Z
  Η: [0.75, 0.683, 0.0, 0.0], // Eta = H
  Θ: [0.778, 0.683, 0.0, 0.0],
  Ι: [0.361, 0.683, 0.0, 0.0], // Iota = I
  Κ: [0.778, 0.683, 0.0, 0.0], // Kappa = K
  Λ: [0.694, 0.683, 0.0, 0.0],
  Μ: [0.917, 0.683, 0.0, 0.0], // Mu = M
  Ν: [0.75, 0.683, 0.0, 0.0], // Nu = N
  Ξ: [0.667, 0.683, 0.0, 0.0],
  Ο: [0.778, 0.683, 0.0, 0.0], // Omicron = O
  Π: [0.764, 0.683, 0.0, 0.0],
  Ρ: [0.681, 0.683, 0.0, 0.0], // Rho = P
  Σ: [0.722, 0.683, 0.0, 0.0],
  Τ: [0.681, 0.683, 0.0, 0.069], // Tau = T
  Υ: [0.778, 0.683, 0.0, 0.069],
  Φ: [0.722, 0.683, 0.0, 0.0],
  Χ: [0.75, 0.683, 0.0, 0.0], // Chi = X
  Ψ: [0.778, 0.683, 0.0, 0.069],
  Ω: [0.722, 0.683, 0.0, 0.0],
}

// Binary operators (cmsy10)
const operators: Record<string, MetricTuple> = {
  "+": [0.778, 0.583, 0.083, 0.0],
  "−": [0.778, 0.25, -0.25, 0.0], // minus (centered on axis)
  "-": [0.778, 0.25, -0.25, 0.0], // hyphen-minus alias
  "×": [0.778, 0.583, 0.083, 0.0],
  "÷": [0.778, 0.583, 0.083, 0.0],
  "±": [0.778, 0.583, 0.083, 0.0],
  "∓": [0.778, 0.583, 0.083, 0.0],
  "·": [0.278, 0.31, -0.19, 0.0], // center dot
  "∘": [0.5, 0.431, 0.0, 0.0], // ring operator
  "⊕": [0.778, 0.583, 0.083, 0.0],
  "⊗": [0.778, 0.583, 0.083, 0.0],
  "∧": [0.667, 0.583, 0.083, 0.0],
  "∨": [0.667, 0.583, 0.083, 0.0],
  "∩": [0.667, 0.583, 0.083, 0.0],
  "∪": [0.667, 0.583, 0.083, 0.0],
  "⋅": [0.278, 0.31, -0.19, 0.0],
  "†": [0.444, 0.694, 0.194, 0.0],
  "‡": [0.444, 0.694, 0.194, 0.0],
  "⊔": [0.667, 0.583, 0.083, 0.0],
  "⊓": [0.667, 0.583, 0.083, 0.0],
  "\\": [0.5, 0.694, 0.194, 0.0],
  "⊖": [0.778, 0.583, 0.083, 0.0],
  "⋄": [0.5, 0.431, 0.0, 0.0],
  "△": [0.833, 0.683, 0.0, 0.0],
  "▽": [0.833, 0.683, 0.0, 0.0],
  "⊲": [0.778, 0.583, 0.083, 0.0],
  "⊳": [0.778, 0.583, 0.083, 0.0],
  "★": [0.5, 0.694, 0.0, 0.0],
}

// Relations (cmsy10 / cmr10)
const relations: Record<string, MetricTuple> = {
  "=": [0.778, 0.367, -0.133, 0.0],
  "<": [0.778, 0.534, 0.034, 0.0],
  ">": [0.778, 0.534, 0.034, 0.0],
  "≤": [0.778, 0.636, 0.136, 0.0],
  "≥": [0.778, 0.636, 0.136, 0.0],
  "≠": [0.778, 0.549, 0.049, 0.0],
  "≈": [0.778, 0.367, -0.133, 0.0],
  "≡": [0.778, 0.464, -0.036, 0.0],
  "∼": [0.778, 0.307, -0.193, 0.0],
  "≅": [0.778, 0.464, -0.036, 0.0],
  "≪": [0.778, 0.534, 0.034, 0.0],
  "≫": [0.778, 0.534, 0.034, 0.0],
  "∈": [0.778, 0.534, 0.034, 0.0],
  "∉": [0.778, 0.685, 0.034, 0.0],
  "∋": [0.778, 0.534, 0.034, 0.0],
  "⊂": [0.778, 0.534, 0.034, 0.0],
  "⊃": [0.778, 0.534, 0.034, 0.0],
  "⊆": [0.778, 0.636, 0.136, 0.0],
  "⊇": [0.778, 0.636, 0.136, 0.0],
  "⊥": [0.778, 0.683, 0.0, 0.0],
  "∥": [0.278, 0.694, 0.194, 0.0],
  "∝": [0.778, 0.431, 0.0, 0.0],
  "∞": [0.778, 0.431, 0.0, 0.0],
  "→": [1.0, 0.511, 0.011, 0.0],
  "←": [1.0, 0.511, 0.011, 0.0],
  "↔": [1.0, 0.511, 0.011, 0.0],
  "⇒": [1.0, 0.525, 0.025, 0.0],
  "⇐": [1.0, 0.525, 0.025, 0.0],
  "⇔": [1.0, 0.525, 0.025, 0.0],
  "↑": [0.5, 0.694, 0.194, 0.0],
  "↓": [0.5, 0.694, 0.194, 0.0],
  "↕": [0.5, 0.694, 0.194, 0.0],
  "⇑": [0.611, 0.694, 0.194, 0.0],
  "⇓": [0.611, 0.694, 0.194, 0.0],
  "⇕": [0.611, 0.694, 0.194, 0.0],
  "↦": [1.0, 0.511, 0.011, 0.0],
  "↩": [1.0, 0.511, 0.011, 0.0],
  "↪": [1.0, 0.511, 0.011, 0.0],
  "⊢": [0.778, 0.683, 0.0, 0.0],
  "⊣": [0.778, 0.683, 0.0, 0.0],
  "⊨": [0.778, 0.683, 0.0, 0.0],
  ":": [0.278, 0.431, 0.0, 0.0],
}

// Big operators (cmex10 — text size / display size)
const bigOps: Record<string, MetricTuple> = {
  "∑": [0.75, 0.75, 0.25, 0.0],
  "∏": [0.75, 0.75, 0.25, 0.0],
  "∐": [0.75, 0.75, 0.25, 0.0],
  "∫": [0.417, 0.75, 0.25, 0.152],
  "∬": [0.722, 0.75, 0.25, 0.152],
  "∭": [1.028, 0.75, 0.25, 0.152],
  "∮": [0.472, 0.75, 0.25, 0.152],
  "⋃": [0.667, 0.75, 0.25, 0.0],
  "⋂": [0.667, 0.75, 0.25, 0.0],
  "⨁": [0.778, 0.75, 0.25, 0.0],
  "⨂": [0.778, 0.75, 0.25, 0.0],
  "⨀": [0.778, 0.75, 0.25, 0.0],
  "⋁": [0.667, 0.75, 0.25, 0.0],
  "⋀": [0.667, 0.75, 0.25, 0.0],
  lim: [1.0, 0.683, 0.0, 0.0],
  max: [1.0, 0.683, 0.0, 0.0],
  min: [1.0, 0.683, 0.0, 0.0],
  sup: [1.0, 0.683, 0.0, 0.0],
  inf: [1.0, 0.683, 0.194, 0.0],
  det: [1.0, 0.683, 0.0, 0.0],
  dim: [1.0, 0.683, 0.0, 0.0],
  log: [1.0, 0.683, 0.194, 0.0],
  ln: [0.667, 0.683, 0.0, 0.0],
  sin: [1.0, 0.683, 0.0, 0.0],
  cos: [1.0, 0.683, 0.0, 0.0],
  tan: [1.0, 0.683, 0.0, 0.0],
  exp: [1.0, 0.683, 0.194, 0.0],
}

// Display-size big operators (1.2x text size, for display style)
const bigOpsDisplay: Record<string, MetricTuple> = {
  "∑": [1.0, 0.9, 0.4, 0.0],
  "∏": [1.0, 0.9, 0.4, 0.0],
  "∐": [1.0, 0.9, 0.4, 0.0],
  "∫": [0.556, 1.15, 0.65, 0.182],
  "∬": [0.963, 1.15, 0.65, 0.182],
  "∭": [1.37, 1.15, 0.65, 0.182],
  "∮": [0.611, 1.15, 0.65, 0.182],
  "⋃": [0.889, 0.9, 0.4, 0.0],
  "⋂": [0.889, 0.9, 0.4, 0.0],
  "⨁": [1.0, 0.9, 0.4, 0.0],
  "⨂": [1.0, 0.9, 0.4, 0.0],
  "⨀": [1.0, 0.9, 0.4, 0.0],
  "⋁": [0.889, 0.9, 0.4, 0.0],
  "⋀": [0.889, 0.9, 0.4, 0.0],
}

// Delimiters (cmex10 — base size)
const delimiters: Record<string, MetricTuple> = {
  "(": [0.389, 0.75, 0.25, 0.0],
  ")": [0.389, 0.75, 0.25, 0.0],
  "[": [0.278, 0.75, 0.25, 0.0],
  "]": [0.278, 0.75, 0.25, 0.0],
  "{": [0.389, 0.75, 0.25, 0.0],
  "}": [0.389, 0.75, 0.25, 0.0],
  "|": [0.278, 0.75, 0.25, 0.0],
  "‖": [0.5, 0.75, 0.25, 0.0],
  "/": [0.5, 0.75, 0.25, 0.0],
  "⌊": [0.278, 0.75, 0.25, 0.0],
  "⌋": [0.278, 0.75, 0.25, 0.0],
  "⌈": [0.278, 0.75, 0.25, 0.0],
  "⌉": [0.278, 0.75, 0.25, 0.0],
  "⟨": [0.389, 0.75, 0.25, 0.0],
  "⟩": [0.389, 0.75, 0.25, 0.0],
}

// Punctuation and misc (cmr10 / cmsy10)
const punctuation: Record<string, MetricTuple> = {
  ",": [0.278, 0.106, 0.194, 0.0],
  ";": [0.278, 0.431, 0.194, 0.0],
  ".": [0.278, 0.106, 0.0, 0.0],
  "!": [0.278, 0.694, 0.0, 0.0],
  "?": [0.472, 0.694, 0.0, 0.0],
  "'": [0.278, 0.694, 0.0, 0.0],
  "…": [1.0, 0.106, 0.0, 0.0],
  "⋯": [1.0, 0.31, 0.0, 0.0],
  "⋮": [0.278, 0.694, 0.0, 0.0],
  "⋱": [1.0, 0.694, 0.0, 0.0],
  "′": [0.275, 0.694, 0.0, 0.0],
  "¬": [0.667, 0.431, 0.0, 0.0],
  "∂": [0.5, 0.694, 0.0, 0.069],
  "∇": [0.833, 0.683, 0.0, 0.0],
  "ℏ": [0.576, 0.694, 0.0, 0.0],
  "ℓ": [0.298, 0.694, 0.0, 0.0],
  "℘": [0.6, 0.431, 0.194, 0.0],
  "ℜ": [0.722, 0.683, 0.0, 0.0],
  "ℑ": [0.611, 0.683, 0.0, 0.0],
  "∅": [0.5, 0.694, 0.0, 0.0],
  "∀": [0.722, 0.683, 0.0, 0.0],
  "∃": [0.556, 0.683, 0.0, 0.0],
}

// Lookup order for character metrics
function lookupMetric(char: string, style: MathStyle): MetricTuple | null {
  // Big operators get display-size metrics in display style
  if (style === "display" && char in bigOpsDisplay) {
    return bigOpsDisplay[char]
  }
  if (char in bigOps) return bigOps[char]

  if (char in latinLower) return latinLower[char]
  if (char in latinUpper) return latinUpper[char]
  if (char in digits) return digits[char]
  if (char in greekLower) return greekLower[char]
  if (char in greekUpper) return greekUpper[char]
  if (char in operators) return operators[char]
  if (char in relations) return relations[char]
  if (char in delimiters) return delimiters[char]
  if (char in punctuation) return punctuation[char]

  return null
}

// Default metrics for unknown characters
const defaultMetric: MetricTuple = [0.55, 0.683, 0.0, 0.0]

/**
 * Get font metrics for a character at a given size and style.
 * Returned values are in pixels (pre-multiplied by fontSize and style scale).
 */
export function getMetrics(
  char: string,
  fontSize: number,
  style: MathStyle,
): FontMetrics {
  const tuple = lookupMetric(char, style) ?? defaultMetric
  const scale = (fontSize / 10) * styleScale[style]

  return {
    width: tuple[0] * scale,
    height: tuple[1] * scale,
    depth: tuple[2] * scale,
    italicCorrection: tuple[3] * scale,
  }
}

/**
 * Get a TeX typesetting parameter scaled to fontSize.
 * Parameters without units (like delimiterFactor) are returned unscaled.
 */
export function getTexParam(param: string, fontSize: number): number {
  const value = texParams[param]
  if (value === undefined) return 0

  // delimiterFactor is per-mille, not a length
  if (param === "delimiterFactor") return value

  return value * (fontSize / 10)
}

/**
 * Get the style scaling factor for a given math style.
 */
export function getStyleScale(style: MathStyle): number {
  return styleScale[style]
}

/**
 * Get the next smaller style (for scripts).
 */
export function scriptStyle(style: MathStyle): MathStyle {
  switch (style) {
    case "display": return "script"
    case "text": return "script"
    case "script": return "scriptscript"
    case "scriptscript": return "scriptscript"
  }
}

/**
 * Check if a character is a big operator (uses limits in display).
 */
export function isBigOp(char: string): boolean {
  return char in bigOps
}

/**
 * Check if a character is a delimiter.
 */
export function isDelimiter(char: string): boolean {
  return char in delimiters
}

/**
 * Check if a character is a relation symbol.
 */
export function isRelation(char: string): boolean {
  return char in relations
}

/**
 * Check if a character is a binary operator.
 */
export function isBinaryOp(char: string): boolean {
  return char in operators
}
