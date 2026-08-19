import type { Category, ClueRef, ViewMode } from '../types'
import { clueKey } from '../types'
import { catColor } from '../theme'

type Props = {
  categories: Category[]
  used: Set<string>
  mode: ViewMode
  /** Omitted in presentation mode: the shared screen mirrors, it does not drive. */
  onOpen?: (ref: ClueRef) => void
}

/** Short answer text for the host's in-situ answer key. */
function answerFor(clue: Category['clues'][number]): string {
  return clue.kind === 'lie' ? `${clue.person} · #${clue.lieIndex + 1}` : clue.answer
}

export function Board({ categories, used, mode, onOpen }: Props) {
  // Categories may hold different numbers of clues; pad the short ones so the
  // rows across the board stay level.
  const rows = Math.max(...categories.map((c) => c.clues.length))

  return (
    <div className="board" style={{ ['--cols' as string]: categories.length }}>
      {categories.map((category, c) => (
        <div
          className="cat"
          key={category.name}
          style={{ ['--cat' as string]: catColor(c) }}
        >
          {category.name}
        </div>
      ))}

      {/* Row-major so the CSS grid lays out rows of equal point value. */}
      {Array.from({ length: rows }, (_, r) =>
        categories.map((category, c) => {
          const clue = category.clues[r]
          if (!clue) return <div className="tile-placeholder" key={`${c}-${r}`} aria-hidden="true" />

          const key = clueKey({ categoryIndex: c, clueIndex: r })
          const isUsed = used.has(key)

          return (
            <button
              key={key}
              className={`tile${isUsed ? ' used' : ''}${onOpen ? '' : ' static'}`}
              style={{ ['--cat' as string]: catColor(c) }}
              disabled={!onOpen}
              onClick={() => onOpen?.({ categoryIndex: c, clueIndex: r })}
              aria-label={
                isUsed
                  ? `${category.name}, ${clue.points} points, already played — reopen`
                  : `${category.name}, ${clue.points} points`
              }
            >
              <span className="tile-pts">{clue.points}</span>
              {mode === 'host' && !isUsed && (
                <span className="tile-ans">{answerFor(clue)}</span>
              )}
            </button>
          )
        }),
      )}
    </div>
  )
}
