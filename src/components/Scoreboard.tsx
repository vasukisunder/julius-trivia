import { useEffect, useRef, useState } from 'react'
import type { Award, PlayerStyle, Team, ViewMode } from '../types'
import { teamColor } from '../theme'
import { useAwardFlash } from '../state/useAwardFlash'
import { PlayerPill } from './PlayerPill'

/**
 * Rolls a score up to its new value instead of snapping, so points landing is
 * something you watch happen.
 */
function useCountUp(target: number): number {
  const [shown, setShown] = useState(target)
  const from = useRef(target)

  useEffect(() => {
    if (shown === target) return
    from.current = shown
    const start = performance.now()
    const span = Math.min(900, 260 + Math.abs(target - from.current) * 0.7)
    let raf = 0

    const step = (now: number) => {
      const t = Math.min(1, (now - start) / span)
      // Ease-out so it decelerates into the final number.
      const eased = 1 - Math.pow(1 - t, 3)
      setShown(Math.round(from.current + (target - from.current) * eased))
      if (t < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target])

  return shown
}

type Props = {
  teams: Team[]
  scores: Map<number, number>
  playerStyles: Record<string, PlayerStyle>
  mode: ViewMode
  /** The latest award, so the winning team's panel can celebrate. */
  lastAward: Award | null
  onRename: (teamId: number, name: string) => void
  onAdjust: (teamId: number, delta: number) => void
}

const STEPS = [100, 200, 300, 400, 500, 600]

export function Scoreboard({
  teams, scores, playerStyles, mode, lastAward, onRename, onAdjust,
}: Props) {
  // Same guards as the stage: no flash on mount, and it clears itself.
  const flash = useAwardFlash(lastAward, 1400)
  // The old board only stepped by 100, so undoing a mis-awarded 600 took six
  // clicks. The host picks the increment by clicking through it.
  const [stepIdx, setStepIdx] = useState(0)
  const step = STEPS[stepIdx]
  const top = Math.max(0, ...teams.map((t) => scores.get(t.id) ?? 0))

  return (
    <div className="scores">
      {teams.map((team, i) => {
        const score = scores.get(team.id) ?? 0
        const isLead = score > 0 && score === top
        const celebrating = flash?.teamId === team.id ? flash.seq : 0
        return (
          <div
            className={`team${celebrating ? ' celebrating' : ''}`}
            key={team.id}
            style={{ ['--team' as string]: teamColor(i) }}
          >
            <div className="team-head">
              <input
                className="team-name"
                value={team.name}
                aria-label="Team name"
                onChange={(e) => onRename(team.id, e.target.value)}
                placeholder="Name this team"
                readOnly={mode === 'present'}
              />
              {isLead && <span className="lead">Leading</span>}
            </div>

            <div className="team-body">
              <TeamScore score={score} celebrating={celebrating} points={flash?.points ?? 0} />
              <div className="roster">
                {team.members.map((m) => (
                  <PlayerPill key={m} name={m} style={playerStyles[m]} size="sm" />
                ))}
              </div>

              <div className="stepper">
                <button
                  className="step"
                  disabled={mode !== 'host'}
                  onClick={() => onAdjust(team.id, -step)}
                  aria-label={`Subtract ${step} from ${team.name}`}
                >
                  –
                </button>
                <button
                  className="step"
                  disabled={mode !== 'host'}
                  onClick={() => onAdjust(team.id, step)}
                  aria-label={`Add ${step} to ${team.name}`}
                >
                  +
                </button>
                <button
                  className="step-amt"
                  disabled={mode !== 'host'}
                  onClick={() => setStepIdx((i) => (i + 1) % STEPS.length)}
                  aria-label={`Step amount ${step}, click to change`}
                >
                  {step}
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Score with the roll-up, plus the floating "+400" on an award. */
function TeamScore({
  score, celebrating, points,
}: { score: number; celebrating: number; points: number }) {
  const shown = useCountUp(score)
  return (
    <div className={`team-score${score < 0 ? ' neg' : ''}`}>
      {shown}
      {celebrating > 0 && (
        <span className="score-pop" key={celebrating}>+{points}</span>
      )}
    </div>
  )
}
