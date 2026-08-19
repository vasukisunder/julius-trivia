import { useEffect, useRef, useState } from 'react'
import type { Award, Buzz, Clue, CluePhase, PlayerStyle, Team, ViewMode, Wrong } from '../types'
import { PlayerIcon } from './PlayerPill'
import { useAwardFlash } from '../state/useAwardFlash'
import { teamColor } from '../theme'

type Props = {
  clue: Clue
  categoryName: string
  accent: string
  mode: ViewMode
  teams: Team[]
  /** Where this clue is in its sequence. Drives everything below. */
  phase: CluePhase
  timerEndsAt: number | null
  buzzes: Buzz[]
  playerStyles: Record<string, PlayerStyle>
  lockedOut: number[]
  /** The buzz with the floor — fastest from a team not already ruled wrong. */
  onTheSpot: Buzz | null
  lastAward: Award | null
  lastWrong: Wrong | null
  /** This clue's key, so a previous clue's award cannot replay here. */
  clueKeyStr: string
  onOpenBuzzers: () => void
  onEndBuzzing: () => void
  onCorrect: (teamId: number) => void
  onWrong: (teamId: number) => void
  onSkipToAnswer: () => void
  onDone: () => void
  onDismiss: () => void
  onReturnToBoard: () => void
}

const TOTAL_SECONDS = 25

/** Seconds remaining, or null when no clock is running. */
function useCountdown(endsAt: number | null, onZero: () => void): number | null {
  const [, tick] = useState(0)
  const fired = useRef<number | null>(null)

  useEffect(() => {
    if (endsAt === null) return
    const id = window.setInterval(() => tick((n) => n + 1), 250)
    return () => clearInterval(id)
  }, [endsAt])

  const left = endsAt === null ? null : Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))

  // The clock running out is a step change, not just a number hitting zero. Only
  // one screen should announce it, and `fired` keeps it to once per clock.
  useEffect(() => {
    if (endsAt === null || left === null || left > 0) return
    if (fired.current === endsAt) return
    fired.current = endsAt
    onZero()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, endsAt])

  return left
}

export function ClueStage({
  clue, categoryName, accent, mode, teams, phase, timerEndsAt, buzzes, playerStyles,
  lockedOut, onTheSpot, lastAward, lastWrong, clueKeyStr,
  onOpenBuzzers, onEndBuzzing, onCorrect, onWrong, onSkipToAnswer, onDone, onDismiss,
  onReturnToBoard,
}: Props) {
  const isHost = mode === 'host'
  const stageRef = useRef<HTMLDivElement>(null)

  // Only the host's clock advances the step; a mirror announcing it too would
  // fire the transition twice.
  const left = useCountdown(timerEndsAt, isHost ? onEndBuzzing : () => {})

  const cheer = useAwardFlash(lastAward, 2200, clueKeyStr)
  const wrongFlash = useAwardFlash(
    lastWrong ? { ...lastWrong, points: 0 } : null,
    1200,
    clueKeyStr,
  )

  const teamOf = (id: number) => teams.find((t) => t.id === id)
  const indexOf = (id: number) => Math.max(0, teams.findIndex((t) => t.id === id))

  const cheerTeam = cheer ? teamOf(cheer.teamId) : null
  const spotTeam = onTheSpot ? teamOf(onTheSpot.teamId) : null
  const winner = phase === 'revealed' && lastAward?.key === clueKeyStr
    ? teamOf(lastAward.teamId)
    : null

  useEffect(() => {
    if (!isHost) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onDismiss() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isHost, onDismiss])

  const heading = clue.kind === 'lie' ? clue.person : categoryName
  const low = left !== null && left <= 5

  /** The step, named on screen so nobody has to infer where they are. */
  const stepLabel =
    phase === 'reading' ? 'Read the question' :
    phase === 'buzzing' ? 'Buzzers open' :
    phase === 'verdict' ? `${spotTeam?.name ?? 'Someone'} to answer` :
    'Answer'

  const showAnswer = isHost || phase === 'revealed'

  return (
    <div
      className={`stage-scrim phase-${phase}${wrongFlash ? ' wrong-flash' : ''}`}
      style={{ ['--cat' as string]: accent }}
      ref={stageRef}
    >
      {cheer && cheerTeam && (
        <div className="cheer" style={{ ['--team' as string]: teamColor(indexOf(cheer.teamId)) }}>
          <div className="cheer-rings" aria-hidden="true"><i /><i /><i /></div>
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
        <div className="stage-step">{stepLabel}</div>
        {isHost && <button className="stage-close" onClick={onDismiss}>Close</button>}
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
          </>
        )}

        {/* ---- step 2: the clock and the queue, and nothing else ---- */}
        {phase === 'buzzing' && (
          <div className="buzzstage">
            <div className={`bigclock${low ? ' low' : ''}`}>{left ?? TOTAL_SECONDS}</div>
            <div className="clockbar">
              <i style={{ transform: `scaleX(${(left ?? 0) / TOTAL_SECONDS})` }} />
            </div>
            {buzzes.length === 0 ? (
              <p className="buzzwait">Waiting for buzzes…</p>
            ) : (
              <ol className="buzzlist">
                {buzzes.map((b, i) => (
                  <li
                    key={b.playerId}
                    className="buzzrow"
                    style={{ ['--team' as string]: teamColor(indexOf(b.teamId)) }}
                  >
                    <span className="buzzrank">{i + 1}</span>
                    {playerStyles[b.name] && (
                      <span style={{ color: playerStyles[b.name].color }}>
                        <PlayerIcon icon={playerStyles[b.name].icon} size={15} />
                      </span>
                    )}
                    <span className="buzzname">{b.name}</span>
                    <span className="buzzteam">{teamOf(b.teamId)?.name}</span>
                    <span className="buzzms">{(b.reactionMs / 1000).toFixed(2)}s</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}

        {/* ---- step 3: exactly one team has the floor ---- */}
        {phase === 'verdict' && onTheSpot && spotTeam && (
          <div className="verdict" style={{ ['--team' as string]: teamColor(indexOf(onTheSpot.teamId)) }}>
            <div className="verdict-team">{spotTeam.name}</div>
            <div className="verdict-who">
              {playerStyles[onTheSpot.name] && (
                <PlayerIcon icon={playerStyles[onTheSpot.name].icon} size={17} />
              )}
              {onTheSpot.name} buzzed in {(onTheSpot.reactionMs / 1000).toFixed(2)}s
            </div>
            {lockedOut.length > 0 && (
              <div className="verdict-out">
                Out: {lockedOut.map((id) => teamOf(id)?.name).filter(Boolean).join(', ')}
              </div>
            )}
          </div>
        )}

        {/* ---- step 4: the answer, plainly ---- */}
        {phase === 'revealed' && clue.kind === 'standard' && (
          <div className="answer">
            <span className="label">Answer</span>
            <span className="answer-val">{clue.answer}</span>
          </div>
        )}
        {phase === 'revealed' && (
          <p className="outcome">
            {winner
              ? `${winner.name} takes ${clue.points}`
              : lockedOut.length > 0
                ? 'Nobody got it'
                : 'No takers'}
          </p>
        )}

        {/* The host's copy of the answer, before the room sees it. */}
        {isHost && phase !== 'revealed' && clue.kind === 'standard' && (
          <div className="answer host-only">
            <span className="label">Answer (host only)</span>
            <span className="answer-val">{clue.answer}</span>
          </div>
        )}
      </div>

      {/* One primary action per step. Mirrored on the shared screen, inert there. */}
      <div className="stage-foot">
        {phase === 'reading' && (
          <>
            <button className="step-btn go" disabled={!isHost} onClick={onOpenBuzzers}>
              Open buzzers
            </button>
            <button className="step-skip" disabled={!isHost} onClick={onSkipToAnswer}>
              Skip to answer
            </button>
          </>
        )}

        {phase === 'buzzing' && (
          <button className="step-btn stop" disabled={!isHost} onClick={onEndBuzzing}>
            Stop buzzers
          </button>
        )}

        {phase === 'verdict' && onTheSpot && (
          <>
            <button
              className="step-btn right"
              disabled={!isHost}
              onClick={() => onCorrect(onTheSpot.teamId)}
            >
              Correct
            </button>
            <button
              className="step-btn wrong"
              disabled={!isHost}
              onClick={() => onWrong(onTheSpot.teamId)}
            >
              Wrong
            </button>
          </>
        )}

        {phase === 'revealed' && (
          <>
            <button className="step-btn go" disabled={!isHost} onClick={onDone}>
              Next question
            </button>
            <button className="step-skip" disabled={!isHost} onClick={onReturnToBoard}>
              Put back on the board
            </button>
          </>
        )}
      </div>
    </div>
  )
}
