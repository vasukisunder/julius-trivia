import { CATEGORY_COLORS } from '../theme'

/** Pop Culture's green. Read from the palette so it follows that column. */
const BRAND = CATEGORY_COLORS[3]

/**
 * The wordmark, in one place. It used to be inlined on four screens and drifted
 * out of case on two of them.
 */
export function Wordmark() {
  return (
    <div className="wordmark">
      <span style={{ color: BRAND }}>Julius</span> Trivia Night
    </div>
  )
}
