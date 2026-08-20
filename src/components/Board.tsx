import type { Category, ClueRef, PlayerStyle, ViewMode } from '../types'
import { clueKey } from '../types'
import { catColor } from '../theme'
import { PEOPLE } from '../data'

type Props = {
  categories: Category[]
  /** Player colours, so a name in the host's answer key wears its owner's colour. */
  styleOf: (name: string) => PlayerStyle
  used: Set<string>
  mode: ViewMode
  /** Omitted in presentation mode: the shared screen mirrors, it does not drive. */
  onOpen?: (ref: ClueRef) => void
  /** The tile the host has under the cursor, mirrored onto the shared screen. */
  hoveredKey?: string | null
  /** Host only: report what is under the cursor so the room can follow along. */
  onHover?: (key: string | null) => void
}

/**
 * Short answer text for the host's in-situ answer key. For a spot-the-lie card
 * the useful thing is which statement is false, so it leads with that.
 */
function answerFor(clue: Category['clues'][number]): string {
  if (clue.kind === 'lie') return `${clue.person}: lie is #${clue.lieIndex + 1}`
  if (clue.kind === 'match') return clue.items.map((i) => i.person).join(' · ')
  return clue.answer
}

export function Board({
  categories, styleOf, used, mode, onOpen, hoveredKey, onHover,
}: Props) {
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
              className={
                `tile${isUsed ? ' used' : ''}${onOpen ? '' : ' static'}` +
                // The shared screen has no cursor of its own, so the host's
                // hover is mirrored in as a class.
                (hoveredKey === key ? ' remote-hover' : '')
              }
              style={{ ['--cat' as string]: catColor(c) }}
              disabled={!onOpen}
              onMouseEnter={() => onHover?.(key)}
              onMouseLeave={() => onHover?.(null)}
              onClick={() => onOpen?.({ categoryIndex: c, clueIndex: r })}
              aria-label={
                isUsed
                  ? `${category.name}, ${clue.points} points, already played — reopen`
                  : `${category.name}, ${clue.points} points`
              }
            >
              <span className="tile-pts">{clue.points}</span>
              {mode === 'host' && !isUsed && (
                <span
                  className="tile-ans"
                  // A name in the answer key wears its owner's colour, same as
                  // everywhere else the person appears.
                  style={
                    clue.kind === 'standard' && PEOPLE.includes(clue.answer.trim())
                      ? { color: styleOf(clue.answer.trim()).color }
                      : undefined
                  }
                >
                  {answerFor(clue)}
                </span>
              )}
            </button>
          )
        }),
      )}
    </div>
  )
}
