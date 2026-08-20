import { useEffect, useState } from 'react'
import type { GameState, PlayerLook, ViewMode } from '../types'
import { standings } from '../state/gameState'
import { teamColor } from '../theme'
import { Confetti } from './Confetti'
import { PlayerPill } from './PlayerPill'

/** Kept in step with the value App dispatches. */
const CEREMONY_SECONDS = 3

type Props = {
  state: GameState
  styleOf: (name: string) => PlayerLook
  mode: ViewMode
  /** Host only: the countdown reaching zero moves it on. */
  onReveal: () => void
  onEnd: () => void
}

/** Seconds left on the countdown, or null. */
function useCountdown(endsAt: number | null, onZero: () => void): number | null {
  const [, tick] = useState(0)

  useEffect(() => {
    if (endsAt === null) return
    const id = window.setInterval(() => tick((n) => n + 1), 200)
    return () => clearInterval(id)
  }, [endsAt])

  const left = endsAt === null ? null : Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))

  useEffect(() => {
    if (endsAt !== null && left === 0) onZero()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, endsAt])

  return left
}

/**
 * The end of the night: a countdown, then the winner.
 *
 * Both halves run off shared state, so the number on the host's screen and the
 * number the room is watching are the same number.
 */
export function Ceremony({ state, styleOf, mode, onReveal, onEnd }: Props) {
  const isHost = mode === 'host'
  // Only the host's clock advances it; a mirror doing so would fire twice.
  const left = useCountdown(state.ceremonyEndsAt, isHost ? onReveal : () => {})

  // Cycles the team names during the countdown.
  const [rolling, setRolling] = useState(state.teams[0]?.name ?? '')
  useEffect(() => {
    if (state.ceremony !== 'countdown' || !state.teams.length) return
    let i = 0
    const id = window.setInterval(() => {
      i += 1
      setRolling(state.teams[i % state.teams.length].name || `Team ${(i % state.teams.length) + 1}`)
    }, 90)
    return () => clearInterval(id)
  }, [state.ceremony, state.teams])

  const total = CEREMONY_SECONDS
  const progress = left === null ? 1 : Math.min(1, Math.max(0, 1 - left / total))

  const rows = standings(state)
  const winners = rows.filter((r) => r.rank === 1)
  const rest = rows.filter((r) => r.rank !== 1)
  const tied = winners.length > 1

  if (state.ceremony === 'countdown') {
    return (
      <div className="ceremony countdown">
        <p className="ceremony-kicker">Counting up the scores…</p>
        {/* A roulette of team names rather than digits ticking down: it echoes the
            team draw, and it builds towards an answer instead of just elapsing. */}
        <div className="ceremony-roulette">{rolling}</div>
        <div className="ceremony-bar">
          <i style={{ transform: `scaleX(${progress})` }} />
        </div>
      </div>
    )
  }

  return (
    <div className="ceremony winner">
      <Confetti seed={1} big />

      <p className="ceremony-kicker">Game over</p>

      <div className="winners">
        {winners.map((w) => (
          <div
            className="winner-card"
            key={w.team.id}
            style={{ ['--team' as string]: teamColor(state.teams.indexOf(w.team)) }}
          >
            <div className="winner-crown">{tied ? 'Joint winners' : 'Winners'}</div>
            <div className="winner-name">{w.team.name}</div>
            <div className="winner-score">{w.score}</div>
            {/* The individuals, not just the team name — they are who won it. */}
            <div className="winner-members">
              {w.team.members.map((m) => (
                <PlayerPill key={m} name={m} style={styleOf(m)} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {rest.length > 0 && (
        <ol className="standings">
          {rest.map((r) => (
            <li
              className="standing"
              key={r.team.id}
              style={{ ['--team' as string]: teamColor(state.teams.indexOf(r.team)) }}
            >
              <span className="standing-rank">{r.rank}</span>
              <span className="standing-name">{r.team.name}</span>
              <span className="standing-score">{r.score}</span>
            </li>
          ))}
        </ol>
      )}

      {isHost && (
        <button className="step-btn go" onClick={onEnd}>Back to the board</button>
      )}
    </div>
  )
}
