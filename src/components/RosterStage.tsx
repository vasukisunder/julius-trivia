import { useState } from 'react'
import { MAX_TEAMS, MIN_TEAMS } from '../data/teams'
import type { ViewMode } from '../types'
import { Wordmark } from './Wordmark'

type Props = {
  roster: string[]
  teamCount: number
  mode: ViewMode
  onAdd: (name: string) => void
  onRemove: (name: string) => void
  onSetTeamCount: (count: number) => void
  onShuffle: () => void
  onResetRoster: () => void
  /** True when the roster still matches the sign-up list. */
  isOriginal: boolean
}

/**
 * Step one of setup: confirm who actually turned up, before anything is drawn.
 * Editing the roster first is what lets the shuffle come out even — adding a
 * latecomer after the draw would leave one team a player short.
 */
export function RosterStage({
  roster, teamCount, mode, onAdd, onRemove, onSetTeamCount, onShuffle,
  onResetRoster, isOriginal,
}: Props) {
  const [name, setName] = useState('')
  const editable = mode === 'host'

  function commit() {
    if (name.trim()) onAdd(name)
    setName('')
  }

  // How the draw will split, shown before committing to it.
  const split = Array.from({ length: teamCount }, (_, i) =>
    Math.floor(roster.length / teamCount) + (i < roster.length % teamCount ? 1 : 0),
  )

  return (
    <div className="draft">
      <div className="draft-head">
        <Wordmark />
        <h1 className="draft-title">Who's here?</h1>
        <p className="draft-count">
          {roster.length} playing · {teamCount} teams of {split.join('/')}
        </p>
      </div>

      <div className="roster-grid">
        {roster.map((person) => (
          <div className="roster-chip" key={person}>
            <span>{person}</span>
            <button
              className="roster-remove"
              disabled={!editable}
              onClick={() => onRemove(person)}
              aria-label={`Remove ${person}`}
            >
              ×
            </button>
          </div>
        ))}

        <div className="roster-chip add">
          <input
            value={name}
            placeholder="Add someone"
            disabled={!editable}
            onChange={(e) => setName(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit()
              if (e.key === 'Escape') setName('')
            }}
          />
        </div>
      </div>

      {/* The room sees the same controls the host is using; only answers are
          held back. On the shared screen they are inert. */}
      <div className="draft-foot">
        <button
          className="bigbtn"
          disabled={!editable || roster.length < teamCount}
          onClick={onShuffle}
        >
          Shuffle into teams
        </button>

        <button
          className="bigbtn ghost"
          disabled={!editable || isOriginal}
          onClick={onResetRoster}
        >
          Reset list
        </button>

        <div className="teamcount">
          <span className="label">Teams</span>
          {Array.from({ length: MAX_TEAMS - MIN_TEAMS + 1 }, (_, i) => {
            const n = MIN_TEAMS + i
            return (
              <button
                key={n}
                className="countbtn"
                disabled={!editable}
                aria-pressed={n === teamCount}
                onClick={() => onSetTeamCount(n)}
              >
                {n}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
