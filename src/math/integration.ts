// PreTeX measurement integration

import { parseMath } from "./parser"
import { layoutMath } from "./layout"

export function measureMath(
  latex: string,
  fontSize: number,
): { width: number; height: number; depth: number } {
  const box = parseMath(latex)
  const positioned = layoutMath(box, "display", fontSize)
  return {
    width: positioned.box.width,
    height: positioned.box.height,
    depth: positioned.box.depth,
  }
}
