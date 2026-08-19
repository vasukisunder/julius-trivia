import { useEffect, useRef, useState } from 'react'
import type { Award } from '../types'

/**
 * Returns the award to celebrate right now, or null.
 *
 * Two guards, both learned from a bug where every newly opened clue replayed the
 * previous clue's celebration:
 *
 *  1. The sequence number present on first render is treated as already seen, so
 *     mounting never fires a flash — only an award arriving afterwards does.
 *  2. When `expectKey` is given, the award must belong to that clue.
 */
export function useAwardFlash(
  award: Award | null,
  ms: number,
  expectKey?: string,
): Award | null {
  const [flash, setFlash] = useState<Award | null>(null)
  // Seeded on first render with whatever is already in state.
  const seen = useRef<number>(award?.seq ?? 0)

  const seq = award?.seq ?? 0
  const matches = !expectKey || award?.key === expectKey

  useEffect(() => {
    if (!award || seq <= seen.current) return
    seen.current = seq
    if (!matches) return

    setFlash(award)
    const id = window.setTimeout(() => setFlash(null), ms)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seq])

  return flash
}
