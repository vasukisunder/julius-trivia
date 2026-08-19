import { useEffect, useRef, useState } from 'react'
import type { Award, Buzz, Clue, PlayerStyle, Team, ViewMode } from '../types'
import { PlayerIcon } from './PlayerPill'
import { useAwardFlash } from '../state/useAwardFlash'
import { teamColor } from '../theme'

type Props = {
  clue: Clue
  categoryName: string
  /** The category's hue, carried through from the board. */
  accent: string
  mode: ViewMode
  teams: Team[]
  awardedIds: number[]
  wasPlayed: boolean
  /** Shared, so host and presentation reveal at the same moment. */
  revealed: boolean
  /** Epoch ms the countdown ends; shared so both screens show the same clock. */
  timerEndsAt: number | null
  /** The award that just landed, so the stage can celebrate it. */
  lastAward: Award | null
  /** This clue's key, so a previous clue's award cannot replay here. */
  clueKeyStr: string
  buzzOpen: boolean
  buzzes: Buzz[]
  playerStyles: Record<string, PlayerStyle>
  lockedOut: number[]
  /** The buzz with the floor — fastest from a team not already wrong. */
  onTheSpot: Buzz | null
  onReveal: () => void
  onOpenBuzzers: () => void
  onCloseBuzzers: () => void
  onMarkWrong: (teamId: number) => void
  onAwardTo: (teamId: number) => void
  onDone: () => void
  onDismiss: () => void
  onReturnToBoard: () => void
}

/** Seconds remaining, or null when no timer is running. */
function useCountdown(endsAt: number | null): number | null {
  const [, tick] = useState(0)

  useEffect(() => {
    if (endsAt === null) return
    // Quarter-second ticks so both windows land on the same displayed second.
    const id = window.setInterval(() => tick((n) => n + 1), 250)
    return () => clearInterval(id)
  }, [endsAt])

  if (endsAt === null) return null
  return Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
}

export function ClueStage({
  clue, categoryName, accent, mode, teams, awardedIds, wasPlayed, revealed, timerEndsAt,
  lastAward, clueKeyStr, buzzOpen, buzzes, playerStyles, lockedOut, onTheSpot,
  onReveal, onOpenBuzzers, onCloseBuzzers, onMarkWrong, onAwardTo, onDone, onDismiss,
  onReturnToBoard,
}: Props) {
  // The host always sees the answer. The room only after a reveal.
  const isHost = mode === 'host'
  const hostSees = isHost
  const showAnswer = hostSees || revealed
  const left = useCountdown(timerEndsAt)
  const stageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (mode !== 'host') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onDismiss() }
      if (e.key === ' ' && !revealed) { e.preventDefault(); onReveal() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mode, revealed, onDismiss, onReveal])

  // Keep focus inside the stage while it is up.
  useEffect(() => {
    const onFocus = (e: FocusEvent) => {
      if (stageRef.current && !stageRef.current.contains(e.target as Node)) {
        stageRef.current.querySelector<HTMLElement>('button')?.focus()
      }
    }
    document.addEventListener('focusin', onFocus)
    return () => document.removeEventListener('focusin', onFocus)
  }, [])

  // Fires only for an award won on THIS clue, and never on mount.
  const cheer = useAwardFlash(lastAward, 2200, clueKeyStr)

  const cheerTeam = cheer ? teams.find((t) => t.id === cheer.teamId) : null
  const cheerIndex = cheerTeam ? teams.indexOf(cheerTeam) : 0

  const heading = clue.kind === 'lie' ? clue.person : categoryName
  const low = left !== null && left <= 5
  const teamIndexOf = (id: number) => Math.max(0, teams.findIndex((t) => t.id === id))
  const teamName = (id: number) => teams.find((t) => t.id === id)?.name ?? ''

  return (
    <div className="stage-scrim" style={{ ['--cat' as string]: accent }} ref={stageRef}>
      {cheer && cheerTeam && (
        <div className="cheer" style={{ ['--team' as string]: teamColor(cheerIndex) }}>
          <div className="cheer-rings" aria-hidden="true">
            <i /><i /><i />
          </div>
          <div className="cheer-body">
            <div className="cheer-points">+{cheer.points}</div>
            <div className="cheer-team">{cheerTeam.name}</div>
          </div>
        </div>
      )}

      <div className="stage-top">
        <div className="stage-cat">
          {heading} <span className="stage-pts">· {clue.points} points</span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {left !== null && <span className={`countdown${low ? ' low' : ''}`}>{left}s</span>}
          <button className="stage-close" disabled={!isHost} onClick={onDismiss}>Close</button>
        </div>
      </div>

      <div className={`timerbar${low ? ' low' : ''}`}>
        <i style={{ transform: `scaleX(${left === null ? 0 : left / 25})` }} />
      </div>

      <div className="stage-body">
        {clue.kind === 'standard' ? (
          <>
            <p className="clue">{clue.question}</p>
            {clue.credit && <p className="credit">{clue.credit}</p>}
          </>
        ) : (
          <>
            <p className="clue">Which one is the lie about {clue.person}?</p>
            <ol className="statements">
              {clue.statements.map((st, i) => (
                <li
                  key={i}
                  className={`statement${
                    showAnswer ? (clue.lieIndex === i ? ' lie' : ' truth') : ''
                  }`}
                >
                  {st}
                </li>
              ))}
            </ol>
            {showAnswer && clue.credit && <p className="credit">{clue.credit}</p>}
          </>
        )}

        {clue.kind === 'standard' && showAnswer && (
          <div className={`answer${hostSees && !revealed ? ' host-only' : ''}`}>
            <span className="label">{hostSees && !revealed ? 'Answer (host only)' : 'Answer'}</span>
            <span className="answer-val">{clue.answer}</span>
          </div>
        )}

        {buzzOpen && (
          <div className="buzzpanel">
            {onTheSpot ? (
              <div
                className="onspot"
                style={{ ['--team' as string]: teamColor(teamIndexOf(onTheSpot.teamId)) }}
              >
                <span className="onspot-team">{teamName(onTheSpot.teamId)}</span>
                <span className="onspot-name">{onTheSpot.name} buzzed first</span>
              </div>
            ) : buzzes.length ? (
              <div className="onspot none">Everyone who buzzed is out</div>
            ) : (
              <div className="onspot waiting">Buzzers are open</div>
            )}

            {buzzes.length > 0 && (
              <ol className="buzzlist">
                {buzzes.map((b, i) => {
                  const out = lockedOut.includes(b.teamId)
                  const live = onTheSpot?.playerId === b.playerId
                  return (
                    <li
                      key={b.playerId}
                      className={`buzzrow${out ? ' out' : ''}${live ? ' live' : ''}`}
                      style={{ ['--team' as string]: teamColor(teamIndexOf(b.teamId)) }}
                    >
                      <span className="buzzrank">{i + 1}</span>
                      {playerStyles[b.name] && (
                        <span
                          className="buzzicon"
                          style={{ color: playerStyles[b.name].color }}
                        >
                          <PlayerIcon icon={playerStyles[b.name].icon} size={15} />
                        </span>
                      )}
                      <span className="buzzname">{b.name}</span>
                      <span className="buzzteam">{teamName(b.teamId)}</span>
                      <span className="buzzms">{(b.reactionMs / 1000).toFixed(2)}s</span>
                    </li>
                  )
                })}
              </ol>
            )}
          </div>
        )}
      </div>

      {/* The room sees the same controls the host is working; they are inert
          here, and the answer is the only thing withheld. */}
      <div className="stage-foot">
        {buzzOpen ? (
          <button className="sbtn" disabled={!isHost} onClick={onCloseBuzzers}>
            Stop buzzers
          </button>
        ) : (
          <button className="sbtn primary" disabled={!isHost} onClick={onOpenBuzzers}>
            Open buzzers
          </button>
        )}

        {/* With someone on the spot, the only two calls that matter. */}
        {onTheSpot && (
          <>
            <button
              className="sbtn correct"
              disabled={!isHost}
              onClick={() => onAwardTo(onTheSpot.teamId)}
            >
              Correct
            </button>
            <button
              className="sbtn incorrect"
              disabled={!isHost}
              onClick={() => onMarkWrong(onTheSpot.teamId)}
            >
              Wrong — pass on
            </button>
          </>
        )}

        {!revealed && (
          <button className="sbtn" disabled={!isHost} onClick={onReveal}>
            Show answer to room
          </button>
        )}

        {/* Manual award, for anything the buzzers did not settle. */}
        {!onTheSpot && teams.map((team, i) => (
          <button
            key={team.id}
            className="sbtn award"
            style={{ ['--team' as string]: teamColor(i) }}
            disabled={!isHost}
            aria-pressed={awardedIds.includes(team.id)}
            onClick={() => onAwardTo(team.id)}
          >
            {team.name}
          </button>
        ))}

        <button className="sbtn" disabled={!isHost} onClick={onDone}>Done</button>
        {wasPlayed && (
          <button className="sbtn" disabled={!isHost} onClick={onReturnToBoard}>
            Put back
          </button>
        )}
      </div>
    </div>
  )
}
