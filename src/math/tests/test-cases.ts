// PreTeX visual regression test cases

export type TestCase = {
  name: string
  latex: string
  displayMode: boolean
}

// --- Basic ---

const basic: TestCase[] = [
  { name: "superscript", latex: "x^2", displayMode: false },
  { name: "subscript", latex: "a_n", displayMode: false },
  { name: "complex-superscript", latex: "x^{2n+1}", displayMode: false },
  { name: "double-subscript", latex: "a_{i,j}", displayMode: false },
  { name: "super-and-sub", latex: "x_i^2", displayMode: false },
  { name: "nested-scripts", latex: "e^{x^2}", displayMode: false },
  { name: "simple-addition", latex: "a + b = c", displayMode: false },
  { name: "multiplication", latex: "a \\cdot b", displayMode: false },
]

// --- Fractions ---

const fractions: TestCase[] = [
  { name: "simple-fraction", latex: "\\frac{a}{b}", displayMode: true },
  { name: "fraction-expressions", latex: "\\frac{x+1}{x-1}", displayMode: true },
  { name: "dfrac", latex: "\\dfrac{1}{2}", displayMode: true },
  { name: "nested-fraction", latex: "\\frac{\\frac{a}{b}}{c}", displayMode: true },
  { name: "double-nested-fraction", latex: "\\frac{1}{1+\\frac{1}{1+\\frac{1}{x}}}", displayMode: true },
  { name: "fraction-inline", latex: "\\frac{a}{b}", displayMode: false },
]

// --- Radicals ---

const radicals: TestCase[] = [
  { name: "sqrt", latex: "\\sqrt{x}", displayMode: false },
  { name: "cube-root", latex: "\\sqrt[3]{x}", displayMode: false },
  { name: "sqrt-expression", latex: "\\sqrt{x^2+y^2}", displayMode: true },
  { name: "nested-sqrt", latex: "\\sqrt{\\sqrt{x}}", displayMode: true },
]

// --- Greek letters ---

const greek: TestCase[] = [
  { name: "greek-sum", latex: "\\alpha + \\beta = \\gamma", displayMode: false },
  { name: "sigma", latex: "\\Sigma", displayMode: false },
  { name: "pi-r-squared", latex: "\\pi r^2", displayMode: false },
  { name: "theta-phi", latex: "\\theta + \\phi", displayMode: false },
]

// --- Operators ---

const operators: TestCase[] = [
  { name: "summation", latex: "\\sum_{i=0}^{n} x_i", displayMode: true },
  { name: "integral", latex: "\\int_0^\\infty f(x)\\,dx", displayMode: true },
  { name: "product", latex: "\\prod_{k=1}^N a_k", displayMode: true },
  { name: "limit", latex: "\\lim_{x\\to 0} \\frac{\\sin x}{x}", displayMode: true },
  { name: "summation-inline", latex: "\\sum_{i=0}^{n} x_i", displayMode: false },
]

// --- Delimiters ---

const delimiters: TestCase[] = [
  { name: "parens-fraction", latex: "\\left(\\frac{a}{b}\\right)", displayMode: true },
  { name: "brackets-sum", latex: "\\left[\\sum_i x_i\\right]", displayMode: true },
  { name: "set-builder", latex: "\\left\\{x \\mid x > 0\\right\\}", displayMode: true },
  { name: "abs-value", latex: "\\left|x\\right|", displayMode: false },
]

// --- Matrices ---

const matrices: TestCase[] = [
  { name: "pmatrix-2x2", latex: "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}", displayMode: true },
]

// --- Accents ---

const accents: TestCase[] = [
  { name: "hat", latex: "\\hat{x}", displayMode: false },
  { name: "bar", latex: "\\bar{y}", displayMode: false },
  { name: "vec", latex: "\\vec{v}", displayMode: false },
  { name: "dot", latex: "\\dot{x}", displayMode: false },
]

// --- Text ---

const text: TestCase[] = [
  { name: "text-if", latex: "\\text{if } x > 0", displayMode: false },
  { name: "text-mixed", latex: "f(x) = x^2 \\text{ for all } x", displayMode: false },
]

// --- Complex expressions ---

const complex: TestCase[] = [
  { name: "euler-identity", latex: "e^{i\\pi} + 1 = 0", displayMode: true },
  { name: "quadratic-formula", latex: "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}", displayMode: true },
  { name: "cauchy-integral", latex: "f(a) = \\frac{1}{2\\pi i} \\oint_\\gamma \\frac{f(z)}{z-a}\\,dz", displayMode: true },
  { name: "maxwell-gauss", latex: "\\nabla \\cdot \\mathbf{E} = \\frac{\\rho}{\\varepsilon_0}", displayMode: true },
  { name: "binomial-theorem", latex: "(x+y)^n = \\sum_{k=0}^{n} \\binom{n}{k} x^k y^{n-k}", displayMode: true },
  { name: "taylor-series", latex: "f(x) = \\sum_{n=0}^{\\infty} \\frac{f^{(n)}(a)}{n!}(x-a)^n", displayMode: true },
]

// --- Edge cases ---

const edgeCases: TestCase[] = [
  { name: "empty-group", latex: "x^{}", displayMode: false },
  { name: "deeply-nested", latex: "\\frac{\\frac{\\frac{a}{b}}{\\frac{c}{d}}}{\\frac{e}{f}}", displayMode: true },
  { name: "long-subscript-chain", latex: "x_{a_{b_{c_{d}}}}", displayMode: false },
  { name: "single-char", latex: "x", displayMode: false },
  { name: "single-number", latex: "42", displayMode: false },
  { name: "negative-number", latex: "-1", displayMode: false },
]

export const ALL_TEST_CASES: TestCase[] = [
  ...basic,
  ...fractions,
  ...radicals,
  ...greek,
  ...operators,
  ...delimiters,
  ...matrices,
  ...accents,
  ...text,
  ...complex,
  ...edgeCases,
]
