// PreTeX font metrics

export type FontMetrics = {
  width: number
  height: number
  depth: number
  italicCorrection: number
}

export function getMetrics(
  char: string,
  fontSize: number,
  style: string,
): FontMetrics {
  // Stub: estimate metrics based on fontSize
  const scale = fontSize / 10
  return {
    width: 0.6 * scale,
    height: 0.7 * scale,
    depth: 0.1 * scale,
    italicCorrection: style === "italic" ? 0.05 * scale : 0,
  }
}
