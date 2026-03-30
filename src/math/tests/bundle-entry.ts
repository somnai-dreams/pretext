// Bundle entry point that exposes PreTeX on window for test pages
import { renderMathToCanvas } from "../integration"

;(window as unknown as { PreTeX: { renderMathToCanvas: typeof renderMathToCanvas } }).PreTeX = {
  renderMathToCanvas,
}
