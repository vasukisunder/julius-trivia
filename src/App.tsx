import { useCallback, useEffect, useMemo } from 'react'
import { Board } from './components/Board'
import { ClueStage } from './components/ClueStage'
import { Scoreboard } from './components/Scoreboard'
import { RosterStage } from './components/RosterStage'
import { TeamDraft } from './components/TeamDraft'
import { CATEGORIES, TEAMMATES, FINAL_CLUE, FINAL_CATEGORY, FINAL_ACCENT } from './data'
import { computeScores, currentBuzz, FINAL_ITEMS } from './state/gameState'
import { useGame } from './state/useGame'
import { useBuildCheck } from './net/useBuildCheck'
import { useGameSounds } from './audio/useGameSounds'
import { SoundToggle, useSoundPref } from './components/SoundToggle'
import { Confetti } from './components/Confetti'
import { Ceremony } from './components/Ceremony'
import { useAwardFlash } from './state/useAwardFlash'
import { BuzzerScreen } from './components/BuzzerScreen'
import { playerId } from './net/player'
import { catColor, CATEGORY_GRADIENT } from './theme'
import { styleFor } from './data/avatars'
import { STICKER_KEYS, stickerSrc } from './data/stickers'
import { clueKey, isFinal, FINAL_REF, type ViewMode } from './types'
import { PRESENT_URL, buzzUrl, routeFromUrl } from './routes'
import type { Connection } from './net/useRoom'
import { Wordmark } from './components/Wordmark'

/** Seconds on the clock when the host starts the timer. */
const COUNTDOWN = 25
/** Seconds of build-up before the winner is announced. Short on purpose — it is a
 *  drumroll, not an interval. Mirrored in Ceremony.tsx for the progress bar. */
const CEREMONY_COUNTDOWN = 3

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

  /**
   * Pull the sticker art in during setup, while people are still joining. The whole
   * set is under 600KB and the alternative is each clue's stickers popping in a beat
   * after the question appears, on conference-room wifi, in front of everyone.
   */
  useEffect(() => {
    if (route === 'buzz') return
    for (const key of STICKER_KEYS) {
      const img = new Image()
      img.src = stickerSrc(key)
    }
  }, [route])

  useGameSounds(state, route === 'present' && soundOn)

  // Confetti on the two screens the room can see. Phones are left out: fifteen
  // of them erupting at once is noise nobody watching the game would see.
  const award = useAwardFlash(state.lastAward, 3200)
  const showConfetti = award !== null && route !== 'buzz'

  /**
   * Everyone has a colour and emoji from the start, whether or not they have opened
   * the buzzer — `playerStyles` holds only the choices people have actually made.
   */
  const styleOf = useCallback(
    (name: string) =>
      styleFor(name, state.playerStyles, state.roster, state.displayNames),
    [state.playerStyles, state.roster, state.displayNames],
  )

  const used = useMemo(() => new Set(state.used), [state.used])
  const scores = useMemo(() => computeScores(state), [state])

  // The closing question has no tile, so it resolves outside the board.
  const openKey = openRef ? clueKey(openRef) : null
  const openIsFinal = openRef ? isFinal(openRef) : false
  const openClue = openRef
    ? openIsFinal ? FINAL_CLUE : CATEGORIES[openRef.categoryIndex]?.clues[openRef.clueIndex]
    : null
  const openCategoryName = openRef
    ? openIsFinal ? FINAL_CATEGORY : CATEGORIES[openRef.categoryIndex]?.name
    : null
  const openAccent = openRef
    ? openIsFinal ? FINAL_ACCENT : catColor(openRef.categoryIndex)
    : FINAL_ACCENT

  // Unmissable, and on every surface: a window running an old bundle looks like a
  // bug rather than a stale page.
  const staleBar = stale ? (
    <button className="stalebar" onClick={() => window.location.reload()}>
      This window is out of date — click to reload
    </button>
  ) : null

  if (route === 'none') return <Landing />

  const confetti = showConfetti && award ? <Confetti seed={award.seq} /> : null

  // Phones only ever show the buzzer.
  if (route === 'buzz') {
    return (
      <>
      {staleBar}
      <BuzzerScreen
        state={state}
        styleOf={styleOf}
        connection={connection}
        onBuzz={(name, teamId, reactionMs) =>
          dispatch({ type: 'buzz', buzz: { playerId: playerId(), name, teamId, reactionMs } })
        }
        onPickStyle={(name, color, icon) =>
          dispatch({ type: 'setPlayerStyle', name, color, icon })
        }
        onRenameTeam={(teamId, teamName) =>
          dispatch({ type: 'renameTeam', teamId, name: teamName })
        }
        onPickName={(name, label) => dispatch({ type: 'setPlayerName', name, label })}
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
        onRename={(teamId, name) => dispatch({ type: 'renameTeam', teamId, name })}
        onBack={() => dispatch({ type: 'backToRoster' })}
      />
      </>
    )
  }

  return (
    <div className="shell">
      {confetti}
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
              className="tbtn"
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
            className="tbtn end"
            disabled={mode !== 'host'}
            onClick={() =>
              dispatch({ type: 'startCeremony', seconds: CEREMONY_COUNTDOWN })
            }
          >
            Announce the winner
          </button>
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

      {/* Sits with the board rather than in the toolbar: it is the question after
          the last row, not a piece of chrome. */}
      <button
        className="finalbar"
        disabled={mode !== 'host'}
        onClick={() => dispatch({ type: 'openClue', ref: FINAL_REF })}
      >
        <span className="finalbar-label">Final question</span>
        <span className="finalbar-pts" style={{ background: CATEGORY_GRADIENT }}>
          {FINAL_CLUE.points} points
        </span>
      </button>

      <Scoreboard
        teams={state.teams}
        scores={scores}
        styleOf={styleOf}
        mode={mode}
        lastAward={state.lastAward}
        onRename={(teamId, name) => dispatch({ type: 'renameTeam', teamId, name })}
        onAdjust={(teamId, delta) => dispatch({ type: 'adjustScore', teamId, delta })}
      />

      {state.ceremony !== 'off' && (
        <Ceremony
          state={state}
          styleOf={styleOf}
          mode={mode}
          onReveal={() => dispatch({ type: 'revealWinner' })}
          onEnd={() => dispatch({ type: 'endCeremony' })}
        />
      )}

      {state.ceremony === 'off' && openClue && openKey && openCategoryName && openRef && (
        <ClueStage
          clue={openClue}
          categoryName={openCategoryName}
          accent={openAccent}
          mode={mode}
          teams={state.teams}
          awardedIds={state.awards[openKey] ?? []}
          phase={state.cluePhase}
          timerEndsAt={state.timerEndsAt}
          buzzes={state.buzzes}
          styleOf={styleOf}
          lockedOut={state.lockedOut}
          onTheSpot={currentBuzz(state)}
          lastWrong={state.lastWrong}
          clueKeyStr={openKey}
          hoveredKey={mode === 'present' ? hoveredKey : null}
          onHover={mode === 'host' ? sendHover : undefined}
          onOpenBuzzers={() => dispatch({ type: 'openBuzzers', seconds: COUNTDOWN })}
          onEndBuzzing={() => dispatch({ type: 'endBuzzing' })}
          onCorrect={(teamId: number) => {
            if (openIsFinal) {
              // The closing question is scored out of three, so a team that buzzed
              // in and got it has all three. Partials for everyone else are handed
              // out on the reveal.
              dispatch({ type: 'setFinalHits', teamId, hits: FINAL_ITEMS })
              dispatch({ type: 'reveal' })
            } else {
              dispatch({ type: 'awardTo', teamId, points: openClue.points })
            }
          }}
          onWrong={(teamId: number) => dispatch({ type: 'markWrong', teamId })}
          finalHits={state.finalHits}
          onSetFinalHits={(teamId: number, hits: number) =>
            dispatch({ type: 'setFinalHits', teamId, hits })}
          onSkipToAnswer={() => dispatch({ type: 'reveal' })}
          onDone={() => {
            dispatch({ type: 'consumeClue', key: openKey })
            // The closing question is the end of the game, so finishing it runs
            // straight into the ceremony rather than dropping back to the board.
            if (openIsFinal) dispatch({ type: 'startCeremony', seconds: CEREMONY_COUNTDOWN })
            else dispatch({ type: 'closeClue' })
          }}
          isFinal={openIsFinal}
          doneLabel={openIsFinal ? 'And the winner is…' : 'Next question'}
          canReturnToBoard={!openIsFinal}
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
