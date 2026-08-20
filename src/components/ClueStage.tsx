import { useEffect, useRef, useState } from 'react'
import type { Buzz, Clue, CluePhase, PlayerStyle, Team, ViewMode, Wrong } from '../types'
import { PlayerIcon, PlayerPill } from './PlayerPill'
import { WithNames } from './WithNames'
import { useAwardFlash } from '../state/useAwardFlash'
import { teamColor } from '../theme'

type Props = {
  clue: Clue
  categoryName: string
  accent: string
  mode: ViewMode
  teams: Team[]
  /** Teams credited with this clue, from the award ledger. */
  awardedIds: number[]
  /** Where this clue is in its sequence. Drives everything below. */
  phase: CluePhase
  timerEndsAt: number | null
  buzzes: Buzz[]
  playerStyles: Record<string, PlayerStyle>
  lockedOut: number[]
  /** The buzz with the floor — fastest from a team not already ruled wrong. */
  onTheSpot: Buzz | null
  lastWrong: Wrong | null
  /** This clue's key, so a previous clue's award cannot replay here. */
  clueKeyStr: string
  /** Which control the host has under the cursor, mirrored from their screen. */
  hoveredKey?: string | null
  /** Host only: report what is under the cursor so the room can follow along. */
  onHover?: (key: string | null) => void
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
  clue, categoryName, accent, mode, teams, awardedIds, phase, timerEndsAt, buzzes, playerStyles,
  lockedOut, onTheSpot, lastWrong, clueKeyStr, hoveredKey, onHover,
  onOpenBuzzers, onEndBuzzing, onCorrect, onWrong, onSkipToAnswer, onDone, onDismiss,
  onReturnToBoard,
}: Props) {
  const isHost = mode === 'host'
  const stageRef = useRef<HTMLDivElement>(null)

  // Only the host's clock advances the step; a mirror announcing it too would
  // fire the transition twice.
  const left = useCountdown(timerEndsAt, isHost ? onEndBuzzing : () => {})

  const wrongFlash = useAwardFlash(
    lastWrong ? { ...lastWrong, points: 0 } : null,
    1200,
    clueKeyStr,
  )

  const teamOf = (id: number) => teams.find((t) => t.id === id)
  const indexOf = (id: number) => Math.max(0, teams.findIndex((t) => t.id === id))

  const spotTeam = onTheSpot ? teamOf(onTheSpot.teamId) : null
  // From the ledger, not from lastAward: lastAward is the most recent award in
  // the whole game, so reopening an earlier clue reported nobody having won it.
  const winner = phase === 'revealed' && awardedIds.length > 0
    ? teamOf(awardedIds[0])
    : null

  useEffect(() => {
    if (!isHost) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onDismiss() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isHost, onDismiss])

  // Always the category. This used to swap in the person's name for spot-the-lie
  // clues, so Around the World's 600 announced itself as "Greg · 600 points".
  // Who the card is about belongs in the question, where it already is.
  const heading = categoryName
  const low = left !== null && left <= 5

  /**
   * Mirrors the host's cursor onto the shared screen. Without it the room sees two
   * buttons and no idea which one the host is about to press — the outcome arrives
   * with no warning.
   */
  const hoverClass = (id: string) => (hoveredKey === `btn:${id}` ? ' remote-hover' : '')
  const hoverProps = (id: string) => ({
    onMouseEnter: () => onHover?.(`btn:${id}`),
    onMouseLeave: () => onHover?.(null),
  })

  /** The step, named on screen so nobody has to infer where they are. */
  const stepLabel =
    phase === 'reading' ? 'Read the question' :
    phase === 'buzzing' ? 'Buzzers open' :
    phase === 'verdict' ? `${spotTeam?.name ?? 'Someone'} to answer` :
    'Answer'

  const showAnswer = isHost || phase === 'revealed'

  return (
    <div
      className={`stage-scrim phase-${phase}`}
      style={{ ['--cat' as string]: accent }}
      ref={stageRef}
    >
      <div className="stage-top">
        <div className="stage-cat">
          {heading} <span className="stage-pts">· {clue.points} points</span>
        </div>

        {/* Grouped with the clue info rather than floating between it and the
            Close button, which only exists in host mode and so pulled any
            centring off anyway. The dots say how far through the clue we are. */}
        <div className="stage-step">
          <span className="stage-dots" aria-hidden="true">
            {(['reading', 'buzzing', 'verdict', 'revealed'] as CluePhase[]).map((p) => (
              <i key={p} className={p === phase ? 'on' : ''} />
            ))}
          </span>
          {stepLabel}
        </div>

        {isHost && <button className="stage-close" onClick={onDismiss}>Close</button>}
      </div>

      <div className="stage-body">
        {clue.kind === 'standard' ? (
          <>
            <p className="clue"><WithNames text={clue.question} /></p>
            {clue.credit && (
              <p className="credit">
                <span className="credit-tag">Hint</span>
                <span className="credit-text"><WithNames text={clue.credit} /></span>
              </p>
            )}
          </>
        ) : clue.kind === 'match' ? (
          <>
            <p className="clue">{clue.prompt}</p>
            <ol className="matchlist">
              {clue.items.map((item, i) => (
                <li className="matchrow" key={i} style={{ animationDelay: `${i * 70}ms` }}>
                  <span className="matchnum">{i + 1}</span>
                  <span className="matchfact">{item.fact}</span>
                  {showAnswer && (
                    <span className="matchwho" style={{ animationDelay: `${i * 140}ms` }}>
                      <PlayerPill name={item.person} style={playerStyles[item.person]} />
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </>
        ) : (
          <>
            <p className="lie-kind">Two truths and a lie</p>
            <p className="clue">
              {clue.prompt ? (
                <WithNames text={clue.prompt} />
              ) : (
                <>Spot the lie about <span className="pname">{clue.person}</span></>
              )}
            </p>
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
            {phase === 'revealed' && clue.credit && (
              <p className="credit">
                <span className="credit-tag">Hint</span>
                <span className="credit-text"><WithNames text={clue.credit} /></span>
              </p>
            )}
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

        {wrongFlash && teamOf(wrongFlash.teamId) && (
          <div className="buzzedout">
            {teamOf(wrongFlash.teamId)?.name} is out
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
          winner ? (
            <div
              className="result"
              style={{ ['--team' as string]: teamColor(indexOf(winner.id)) }}
            >
              <div className="result-rings" aria-hidden="true"><i /><i /><i /></div>
              <div className="result-points">+{clue.points}</div>
              <div className="result-team">{winner.name}</div>
            </div>
          ) : (
            <p className="outcome">
              {lockedOut.length > 0 ? 'Nobody got it' : 'No takers'}
            </p>
          )
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
            <button
              className={`step-btn go${hoverClass('open')}`}
              disabled={!isHost}
              {...hoverProps('open')}
              onClick={onOpenBuzzers}
            >
              Open buzzers
            </button>
            <button
              className={`step-skip${hoverClass('skip')}`}
              disabled={!isHost}
              {...hoverProps('skip')}
              onClick={onSkipToAnswer}
            >
              Skip to answer
            </button>
          </>
        )}

        {phase === 'buzzing' && (
          <button
            className={`step-btn stop${hoverClass('stop')}`}
            disabled={!isHost}
            {...hoverProps('stop')}
            onClick={onEndBuzzing}
          >
            Stop buzzers
          </button>
        )}

        {phase === 'verdict' && onTheSpot && (
          <>
            <button
              className={`step-btn right${hoverClass('right')}`}
              disabled={!isHost}
              {...hoverProps('right')}
              onClick={() => onCorrect(onTheSpot.teamId)}
            >
              Correct
            </button>
            <button
              className={`step-btn wrong${hoverClass('wrong')}`}
              disabled={!isHost}
              {...hoverProps('wrong')}
              onClick={() => onWrong(onTheSpot.teamId)}
            >
              Wrong
            </button>
          </>
        )}

        {phase === 'revealed' && (
          <>
            <button
              className={`step-btn go${hoverClass('next')}`}
              disabled={!isHost}
              {...hoverProps('next')}
              onClick={onDone}
            >
              Next question
            </button>
            <button
              className={`step-skip${hoverClass('putback')}`}
              disabled={!isHost}
              {...hoverProps('putback')}
              onClick={onReturnToBoard}
            >
              Put back on the board
            </button>
          </>
        )}
      </div>
    </div>
  )
}
