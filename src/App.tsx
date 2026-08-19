import { useEffect, useMemo } from 'react'
import { Board } from './components/Board'
import { ClueStage } from './components/ClueStage'
import { Scoreboard } from './components/Scoreboard'
import { RosterStage } from './components/RosterStage'
import { TeamDraft } from './components/TeamDraft'
import { CATEGORIES, TEAMMATES } from './data'
import { computeScores, currentBuzz } from './state/gameState'
import { useGame } from './state/useGame'
import { useBuildCheck } from './net/useBuildCheck'
import { useGameSounds } from './audio/useGameSounds'
import { SoundToggle, useSoundPref } from './components/SoundToggle'
import { BuzzerScreen } from './components/BuzzerScreen'
import { playerId } from './net/player'
import { catColor } from './theme'
import { clueKey, type ViewMode } from './types'
import { PRESENT_URL, buzzUrl, routeFromUrl } from './routes'
import type { Connection } from './net/useRoom'
import { Wordmark } from './components/Wordmark'

/** Seconds on the clock when the host starts the timer. */
const COUNTDOWN = 25

/** The root: a wordmark and nothing else. No links, no hints. */
function Landing() {
  return (
    <div className="landing">
      <Wordmark />
    </div>
  )
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
  const stale = useBuildCheck()
  // Sound is the shared screen's job alone: the host's laptop and every phone
  // staying silent is the whole point.
  const [soundOn] = useSoundPref()
  const { state, dispatch, connection, hoveredKey, sendHover } = useGame()
  // Which clue is open lives in shared state, so the presentation screen opens
  // the same tile at the same moment the host picks it.
  const openRef = state.open

  const mode: ViewMode = route === 'none' ? 'present' : route

  // Drives the host-mode viewport frame, so a mis-shared window is obvious.
  useEffect(() => {
    document.body.dataset.mode = route
  }, [route])

  useGameSounds(state, route === 'present' && soundOn)

  const used = useMemo(() => new Set(state.used), [state.used])
  const scores = useMemo(() => computeScores(state), [state])

  const openKey = openRef ? clueKey(openRef) : null
  const openCategory = openRef ? CATEGORIES[openRef.categoryIndex] : null
  const openClue = openRef ? openCategory?.clues[openRef.clueIndex] : null

  // Unmissable, and on every surface: a window running an old bundle looks like a
  // bug rather than a stale page.
  const staleBar = stale ? (
    <button className="stalebar" onClick={() => window.location.reload()}>
      This window is out of date — click to reload
    </button>
  ) : null

  if (route === 'none') return <Landing />

  // Phones only ever show the buzzer.
  if (route === 'buzz') {
    return (
      <>
      {staleBar}
      <BuzzerScreen
        state={state}
        connection={connection}
        onBuzz={(name, teamId, reactionMs) =>
          dispatch({ type: 'buzz', buzz: { playerId: playerId(), name, teamId, reactionMs } })
        }
        onPickStyle={(name, color, icon) =>
          dispatch({ type: 'setPlayerStyle', name, color, icon })
        }
      />
      </>
    )
  }

  if (state.phase === 'roster') {
    return (
      <>
      {staleBar}
      <div className="floatbadge">
        {route === 'present' && <SoundToggle />}
        <SyncBadge connection={connection} mode={mode} />
      </div>
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
      {staleBar}
      <div className="floatbadge">
        {route === 'present' && <SoundToggle />}
        <SyncBadge connection={connection} mode={mode} />
      </div>
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

  return (
    <div className="shell">
      {staleBar}
      <header className="topbar">
        <Wordmark />

        <div className="topbar-meta">
          <span className={`chip ${mode}`}>
            {mode === 'host' ? 'Host view · answers shown' : 'On screen'}
          </span>
          <SyncBadge connection={connection} mode={mode} />
          {route === 'present' && <SoundToggle />}
          {mode === 'host' && (
            <button
              className="tbtn go"
              onClick={() => {
                // The changing param forces a fresh load. window.open reuses a
                // window with the same name and will happily leave it running
                // whatever JavaScript it already had — which is how the shared
                // screen ended up showing markup two builds old.
                const url = `${PRESENT_URL}?r=${Date.now()}`
                const w = window.open(url, 'trivia-present', 'width=1280,height=800')
                w?.focus()
              }}
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
        hoveredKey={mode === 'present' ? hoveredKey : null}
        onHover={mode === 'host' ? sendHover : undefined}
      />

      <Scoreboard
        teams={state.teams}
        scores={scores}
        playerStyles={state.playerStyles}
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
          phase={state.cluePhase}
          timerEndsAt={state.timerEndsAt}
          buzzes={state.buzzes}
          playerStyles={state.playerStyles}
          lockedOut={state.lockedOut}
          onTheSpot={currentBuzz(state)}
          lastWrong={state.lastWrong}
          clueKeyStr={openKey}
          hoveredKey={mode === 'present' ? hoveredKey : null}
          onHover={mode === 'host' ? sendHover : undefined}
          onOpenBuzzers={() => dispatch({ type: 'openBuzzers', seconds: COUNTDOWN })}
          onEndBuzzing={() => dispatch({ type: 'endBuzzing' })}
          onCorrect={(teamId: number) =>
            dispatch({ type: 'awardTo', teamId, points: openClue.points })
          }
          onWrong={(teamId: number) => dispatch({ type: 'markWrong', teamId })}
          onSkipToAnswer={() => dispatch({ type: 'reveal' })}
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
