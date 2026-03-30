// PreTeX layout engine

import type { MathBox, PositionedBox, MathStyle } from "./types"

export function layoutMath(
  box: MathBox,
  _style: MathStyle,
  _fontSize: number,
): PositionedBox {
  // Stub: position at origin
  return {
    box,
    x: 0,
    y: 0,
  }
}
