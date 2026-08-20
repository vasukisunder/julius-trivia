import { useEffect, useRef, useState } from 'react'
import { TEAMMATES } from '../data'
import { shuffle } from '../data/teams'
import { teamColor } from '../theme'
import type { Team, ViewMode } from '../types'
import { Wordmark } from './Wordmark'
import { JoinQR } from './JoinQR'
import { buzzUrl } from '../routes'

type Props = {
  /** Teams live in shared state, so host and presentation show the same draw. */
  teams: Team[]
  /** Bumps on each fresh draw; editing a roster must not replay the scramble. */
  drawSeq: number
  mode: ViewMode
  onRedraw: () => void
  onConfirm: () => void
  onAddMember: (teamId: number, name: string) => void
  onRemoveMember: (teamId: number, name: string) => void
  onRename: (teamId: number, name: string) => void
  onBack: () => void
}

const ROLL_MS = 60      // how fast names cycle while scrambling
const LAND_MS = 130     // gap between each name locking in

export function TeamDraft({
  teams, drawSeq, mode, onRedraw, onConfirm, onAddMember, onRemoveMember, onRename,
  onBack,
}: Props) {
  const [landed, setLanded] = useState(0)
  const [rolling, setRolling] = useState(false)
  const [scramble, setScramble] = useState<string[]>(TEAMMATES)
  const [adding, setAdding] = useState<number | null>(null)
  const [draftName, setDraftName] = useState('')
  // Drag state, so the column under the cursor can show it will accept the drop.
  const [dragging, setDragging] = useState<string | null>(null)
  const [over, setOver] = useState<number | null>(null)
  const timers = useRef<number[]>([])
  const editable = mode === 'host'

  const total = teams.reduce((n, t) => n + t.members.length, 0)

  const clearTimers = () => {
    timers.current.forEach((t) => {
      clearTimeout(t)
      clearInterval(t)
    })
    timers.current = []
  }

  // Keyed on drawSeq, not on teams: a hand edit should not restart the scramble.
  useEffect(() => {
    clearTimers()
    setLanded(0)
    setRolling(true)

    const count = teams.reduce((n, t) => n + t.members.length, 0)
    const roll = window.setInterval(() => setScramble(shuffle(TEAMMATES)), ROLL_MS)
    timers.current.push(roll)

    for (let i = 1; i <= count; i++) {
      timers.current.push(
        window.setTimeout(() => {
          setLanded(i)
          if (i === count) {
            clearInterval(roll)
            setRolling(false)
          }
        }, 500 + i * LAND_MS),
      )
    }
    return clearTimers
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawSeq])

  /** Slots are dealt round-robin, so the nth name sits at team n%count. */
  const dealIndex = (team: number, row: number) => row * teams.length + team

  function commitAdd(teamId: number) {
    if (draftName.trim()) onAddMember(teamId, draftName)
    setDraftName('')
    setAdding(null)
  }

  return (
    <div className="draft">
      <div className="draft-head">
        <div className="draft-head-text">
        <Wordmark />
        <h1 className="draft-title">Teams</h1>
        <p className="draft-count">
          {total} players · {teams.length} teams
        </p>
        </div>
        <JoinQR url={buzzUrl()} />
      </div>

      <div className="draft-grid">
        {teams.map((team, t) => (
          <div
            className={`draft-col${over === team.id ? ' dropping' : ''}`}
            key={team.id}
            style={{ ['--team' as string]: teamColor(t) }}
            onDragOver={(e) => {
              if (!editable || !dragging) return
              e.preventDefault()
              setOver(team.id)
            }}
            onDragLeave={() => setOver((o) => (o === team.id ? null : o))}
            onDrop={(e) => {
              e.preventDefault()
              if (dragging) onAddMember(team.id, dragging)
              setDragging(null)
              setOver(null)
            }}
          >
            <input
              className="draft-col-name"
              value={team.name}
              aria-label={`Name for ${team.name}`}
              placeholder="Name this team"
              readOnly={!editable}
              onChange={(e) => onRename(team.id, e.target.value)}
            />
            <div className="draft-list">
              {team.members.map((name, row) => {
                // Once the scramble finishes everything reads as landed, so a
                // name added afterwards does not appear stuck mid-roll.
                const isLanded = !rolling || dealIndex(t, row) < landed
                const idx = dealIndex(t, row)
                return (
                  <div
                    key={name + row}
                    className={`draft-member ${isLanded ? 'landed' : 'rolling'}${
                      dragging === name ? ' dragging' : ''
                    }${editable && isLanded ? ' draggable' : ''}`}
                    draggable={editable && isLanded}
                    onDragStart={() => setDragging(name)}
                    onDragEnd={() => { setDragging(null); setOver(null) }}
                  >
                    <span>{isLanded ? name : scramble[(idx * 5 + row) % scramble.length]}</span>
                    {isLanded && (
                      <button
                        className="draft-remove"
                        disabled={!editable}
                        onClick={() => onRemoveMember(team.id, name)}
                        aria-label={`Remove ${name} from ${team.name}`}
                      >
                        ×
                      </button>
                    )}
                  </div>
                )
              })}

              {!rolling && (
                adding === team.id ? (
                  <input
                    className="draft-add-input"
                    autoFocus
                    value={draftName}
                    placeholder="Name"
                    onChange={(e) => setDraftName(e.target.value)}
                    onBlur={() => commitAdd(team.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitAdd(team.id)
                      if (e.key === 'Escape') { setDraftName(''); setAdding(null) }
                    }}
                  />
                ) : (
                  <button
                    className="draft-add"
                    disabled={!editable}
                    onClick={() => setAdding(team.id)}
                  >
                    + Add player
                  </button>
                )
              )}
            </div>
          </div>
        ))}
      </div>

      {editable && (
        <div className="draft-foot">
          <button className="bigbtn" disabled={rolling} onClick={onConfirm}>
            Start game
          </button>
          <button className="bigbtn ghost" disabled={rolling} onClick={onRedraw}>
            Shuffle again
          </button>
          <button className="bigbtn ghost" disabled={rolling} onClick={onBack}>
            Edit players
          </button>
        </div>
      )}
    </div>
  )
}
