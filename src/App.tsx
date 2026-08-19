import { useEffect, useMemo } from 'react'
import { Board } from './components/Board'
import { ClueStage } from './components/ClueStage'
import { Scoreboard } from './components/Scoreboard'
import { RosterStage } from './components/RosterStage'
import { TeamDraft } from './components/TeamDraft'
import { CATEGORIES, TEAMMATES } from './data'
import { computeScores, currentBuzz } from './state/gameState'
import { useGame } from './state/useGame'
import { BuzzerScreen } from './components/BuzzerScreen'
import { playerId } from './net/player'
import { catColor } from './theme'
import { clueKey, type ViewMode } from './types'
import type { Connection } from './net/useRoom'
import { Wordmark } from './components/Wordmark'

/** Seconds on the clock when the host starts the timer. */
const COUNTDOWN = 25

/**
 * Every view has its own path, and nothing is served at the root:
 *
 *   /host      the host, marking answers
 *   /present   the window shared with the room
 *   /buzz      the phone screen
 *   /          deliberately empty
 *
 * The empty root matters. The host view prints the whole answer key, so if it
 * lived at `/` a player could delete "buzz" off their link and read every
 * answer. Now that lands on nothing, and nothing on the page hints at the other
 * paths.
 *
 * Mode is never toggled in-session either — a toggle was too easy to hit
 * mid-game and would flash the answers to the room. Both the dev server and the
 * Worker fall back to index.html, so these are real paths.
 */
const PRESENT_URL = '/present'
const BUZZ_URL = '/buzz'

type Route = ViewMode | 'none'

function routeFromUrl(): Route {
  const last = window.location.pathname.split('/').filter(Boolean).pop()
  if (last === 'host') return 'host'
  if (last === 'present') return 'present'
  if (last === 'buzz') return 'buzz'
  return 'none'
}

/** The root: a wordmark and nothing else. No links, no hints. */
function Landing() {
  return (
    <div className="landing">
      <Wordmark />
    </div>
  )
}

/** The link players open on their phones. */
function buzzUrl(): string {
  return `${window.location.origin}${BUZZ_URL}`
}

/**
 * Sync status, always on screen. When this says "This window only", the two
 * views are not talking to a server — changes still cross windows on one
 * machine, but not between two laptops. Run `npm run dev:full` (or deploy) for
 * the real thing.
 */
function SyncBadge({ connection, mode }: { connection: Connection; mode: ViewMode }) {
  if (mode === 'buzz') return null
  const label =
    connection === 'online' ? 'Synced' :
    connection === 'connecting' ? 'Connecting' :
    connection === 'reconnecting' ? 'Reconnecting' : 'No server — this window only'
  return <span className={`conn ${connection}`} title={`Sync: ${label}`}>{label}</span>
}

export default function App() {
  const route = routeFromUrl()
  const { state, dispatch, connection } = useGame()
  // Which clue is open lives in shared state, so the presentation screen opens
  // the same tile at the same moment the host picks it.
  const openRef = state.open

  const mode: ViewMode = route === 'none' ? 'present' : route

  // Drives the host-mode viewport frame, so a mis-shared window is obvious.
  useEffect(() => {
    document.body.dataset.mode = route
  }, [route])

  const used = useMemo(() => new Set(state.used), [state.used])
  const scores = useMemo(() => computeScores(state), [state])

  const openKey = openRef ? clueKey(openRef) : null
  const openCategory = openRef ? CATEGORIES[openRef.categoryIndex] : null
  const openClue = openRef ? openCategory?.clues[openRef.clueIndex] : null

  if (route === 'none') return <Landing />

  // Phones only ever show the buzzer.
  if (route === 'buzz') {
    return (
      <BuzzerScreen
        state={state}
        connection={connection}
        onBuzz={(name, teamId, reactionMs) =>
          dispatch({ type: 'buzz', buzz: { playerId: playerId(), name, teamId, reactionMs } })
        }
      />
    )
  }

  if (state.phase === 'roster') {
    return (
      <>
      <div className="floatbadge"><SyncBadge connection={connection} mode={mode} /></div>
      <RosterStage
        roster={state.roster}
        teamCount={state.teamCount}
        mode={mode}
        onAdd={(name) => dispatch({ type: 'addToRoster', name })}
        onRemove={(name) => dispatch({ type: 'removeFromRoster', name })}
        onSetTeamCount={(count) => dispatch({ type: 'setTeamCount', count })}
        onShuffle={() => dispatch({ type: 'shuffleTeams' })}
        onResetRoster={() => dispatch({ type: 'resetRoster' })}
        isOriginal={
          state.roster.length === TEAMMATES.length &&
          state.roster.every((n) => TEAMMATES.includes(n))
        }
      />
      </>
    )
  }

  if (state.phase === 'draft') {
    return (
      <>
      <div className="floatbadge"><SyncBadge connection={connection} mode={mode} /></div>
      <TeamDraft
        teams={state.teams}
        drawSeq={state.drawSeq}
        mode={mode}
        onRedraw={() => dispatch({ type: 'redraw' })}
        onConfirm={() => dispatch({ type: 'setTeams', rosters: state.teams.map((t) => t.members) })}
        onAddMember={(teamId, name) => dispatch({ type: 'addMember', teamId, name })}
        onRemoveMember={(teamId, name) => dispatch({ type: 'removeMember', teamId, name })}
        onBack={() => dispatch({ type: 'backToRoster' })}
      />
      </>
    )
  }

  const played = state.used.length
  const total = CATEGORIES.reduce((n, c) => n + c.clues.length, 0)

  return (
    <div className="shell">
      <header className="topbar">
        <div>
          <div className="label">
            {played} of {total} played
          </div>
          <Wordmark />
        </div>

        <div className="topbar-meta">
          <span className={`chip ${mode}`}>
            {mode === 'host' ? 'Host view · answers shown' : 'On screen'}
          </span>
          <SyncBadge connection={connection} mode={mode} />
          {mode === 'host' && (
            <button
              className="tbtn go"
              onClick={() =>
                window.open(PRESENT_URL, 'trivia-present', 'width=1280,height=800')
              }
            >
              Open presentation window
            </button>
          )}
          <button
            className="tbtn"
            disabled={mode !== 'host'}
            onClick={() => dispatch({ type: 'backToDraft' })}
          >
            Teams
          </button>
          <button
            className="tbtn"
            disabled={mode !== 'host'}
            onClick={() => {
              if (confirm('Set all scores back to zero and put every clue back on the board?')) {
                dispatch({ type: 'resetGame' })
              }
            }}
          >
            Reset scores
          </button>
          <button
            className="tbtn"
            disabled={mode !== 'host'}
            onClick={() => {
              // Wipes everything, including the roster — what you want between
              // a rehearsal and the real game.
              if (confirm('Start a completely new game? This clears scores, teams and the player list.')) {
                dispatch({ type: 'newGame' })
              }
            }}
          >
            New game
          </button>
        </div>
      </header>

      {mode === 'present' && (
        <p className="joinline">
          Join the buzzers at <strong>{buzzUrl()}</strong>
        </p>
      )}

      <Board
        categories={CATEGORIES}
        used={used}
        mode={mode}
        // Only the host drives the board; the shared screen is a mirror.
        onOpen={mode === 'host' ? (ref) => dispatch({ type: 'openClue', ref }) : undefined}
      />

      <Scoreboard
        teams={state.teams}
        scores={scores}
        mode={mode}
        lastAward={state.lastAward}
        onRename={(teamId, name) => dispatch({ type: 'renameTeam', teamId, name })}
        onAdjust={(teamId, delta) => dispatch({ type: 'adjustScore', teamId, delta })}
      />

      {openClue && openKey && openCategory && openRef && (
        <ClueStage
          clue={openClue}
          categoryName={openCategory.name}
          accent={catColor(openRef.categoryIndex)}
          mode={mode}
          teams={state.teams}
          awardedIds={state.awards[openKey] ?? []}
          wasPlayed={used.has(openKey)}
          revealed={state.revealed}
          timerEndsAt={state.timerEndsAt}
          lastAward={state.lastAward}
          clueKeyStr={openKey}
          buzzOpen={state.buzzOpenedAt !== null}
          buzzes={state.buzzes}
          lockedOut={state.lockedOut}
          onTheSpot={currentBuzz(state)}
          onReveal={() => dispatch({ type: 'reveal' })}
          onOpenBuzzers={() => dispatch({ type: 'openBuzzers', seconds: COUNTDOWN })}
          onCloseBuzzers={() => dispatch({ type: 'closeBuzzers' })}
          onMarkWrong={(teamId: number) => dispatch({ type: 'markWrong', teamId })}
          onAwardTo={(teamId: number) =>
            dispatch({ type: 'awardTo', teamId, points: openClue.points })
          }
          onDone={() => {
            dispatch({ type: 'consumeClue', key: openKey })
            dispatch({ type: 'closeClue' })
          }}
          onDismiss={() => dispatch({ type: 'closeClue' })}
          onReturnToBoard={() => {
            dispatch({ type: 'clearClue', key: openKey })
            dispatch({ type: 'closeClue' })
          }}
        />
      )}
    </div>
  )
}
