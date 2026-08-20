import { useEffect, useRef, useState } from 'react'
import type { GameState, PlayerLook } from '../types'
import type { Connection } from '../net/useRoom'
import { playerId, savedName, saveName, hasChosen, markChosen } from '../net/player'
import { MAX_NAME, PLAYER_COLORS, PLAYER_EMOJI } from '../data/avatars'
import { PlayerIcon, PlayerPill } from './PlayerPill'
import { Wordmark } from './Wordmark'
import { teamColor } from '../theme'

type Props = {
  state: GameState
  styleOf: (name: string) => PlayerLook
  connection: Connection
  onBuzz: (name: string, teamId: number, reactionMs: number) => void
  onPickStyle: (name: string, color: string, icon: string) => void
  /** Anyone on a team can rename it, and it changes everywhere at once. */
  onRenameTeam: (teamId: number, name: string) => void
  /** A player's own name, as it should appear on every screen. */
  onPickName: (name: string, label: string) => void
}

/**
 * The phone screen. Players pick their name once, get a colour and shape, then
 * hold this open.
 *
 * Reaction time is measured on the phone itself: the clock starts when the button
 * actually paints and stops when the player taps. That number is what gets sent,
 * so ranking reflects reflexes rather than whose wifi is fastest.
 */
/** Seconds left on the shared clock, or null when it is not running. */
function useSecondsLeft(endsAt: number | null): number | null {
  const [, tick] = useState(0)
  useEffect(() => {
    if (endsAt === null) return
    const id = window.setInterval(() => tick((n) => n + 1), 200)
    return () => clearInterval(id)
  }, [endsAt])
  return endsAt === null ? null : Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
}

const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th']

export function BuzzerScreen({
  state, styleOf, connection, onBuzz, onPickStyle, onRenameTeam, onPickName,
}: Props) {
  const [name, setName] = useState<string | null>(savedName)
  // Opens by default the first time, because a picker you have to discover is a
  // picker nobody uses.
  const [picking, setPicking] = useState(() => !hasChosen())
  const [renaming, setRenaming] = useState(false)
  const armedAt = useRef<number | null>(null)

  // The roster exists from the start; teams only after the host shuffles. People
  // scan the QR during setup, so identity has to work off the roster.
  const onRoster = !!name && state.roster.includes(name)
  const me = state.teams.find((t) => t.members.includes(name ?? ''))
  const open = state.buzzOpenedAt !== null
  const myBuzz = state.buzzes.find((b) => b.playerId === playerId())
  const place = myBuzz ? state.buzzes.indexOf(myBuzz) + 1 : null
  const left = useSecondsLeft(state.timerEndsAt)
  // Same threshold the shared screen uses, so the room and the phones agree on
  // when it has become urgent.
  const urgent = left !== null && left <= 5
  const style = name ? styleOf(name) : undefined

  // Start the local clock the moment the live button paints.
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        armedAt.current = performance.now()
      })
    } else {
      armedAt.current = null
    }
  }, [open, state.buzzOpenedAt])

  if (!name || !onRoster) {
    return (
      <div className="phone">
        <div className="phone-head"><Wordmark /></div>
        <p className="phone-pick-label">Who are you?</p>
        {/* No emoji in this list. Everyone has one by default, but showing it before
            anyone has picked reads as already claimed — and picking one is the very
            next thing that happens. The colour stays: it is what makes the list
            scannable at a glance. */}
        {state.roster.length === 0 ? (
          <p className="phone-note">Waiting for the host to open the game.</p>
        ) : (
          <div className="phone-names">
            {state.roster.map((member) => {
              const st = styleOf(member)
              return (
                <button
                  key={member}
                  className="phone-name"
                  style={{ ['--team' as string]: st.color }}
                  onClick={() => {
                    saveName(member)
                    setName(member)
                  }}
                >
                  {st.label}
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  /**
   * Two accents, because they mean different things. A player's own colour is theirs
   * — it goes on their name, styled the way a name is styled inside a clue. The team
   * colour is the team's, and it is the one the room sees on the board, so picking a
   * personal colour must not repaint it. Before the draw there is no team, so their
   * own colour stands in.
   */
  const mine = style?.color ?? '#8B90E5'
  const teamIndex = me ? state.teams.findIndex((t) => t.id === me.id) : -1
  const teamAccent = teamIndex >= 0 ? teamColor(teamIndex) : mine

  return (
    <div
      className="phone"
      style={{ ['--team' as string]: teamAccent, ['--me' as string]: mine }}
    >
      <div className="phone-id">
        <div className="phone-idrow">
          {style && <PlayerIcon icon={style.icon} size={30} />}
          <span className="phone-who">{style?.label ?? name}</span>
          {/* Sits with the thing it edits, rather than as a full-width button
              competing with the buzzer below. Gone while the panel is open: the
              panel has its own Done, and two ways to close one thing is one too
              many on a phone. */}
          {!picking && (
            <button
              className="phone-edit"
              aria-label="Change your name, colour and emoji"
              onClick={() => setPicking(true)}
            >
              Edit
            </button>
          )}
        </div>

        {me ? (
          <>
            <span className="phone-team">{me.name}</span>
            {me.members.length > 1 && (
              <div className="phone-mates">
                {me.members
                  .filter((m) => m !== name)
                  .map((m) => (
                    <PlayerPill key={m} name={m} style={styleOf(m)} size="sm" />
                  ))}
              </div>
            )}
          </>
        ) : (
          <span className="phone-team">Team to be drawn</span>
        )}
      </div>

      {/* An explicit control rather than an editable-looking field: anyone on the
          team can rename it, and the change lands on every screen at once. */}
      {me && (renaming ? (
        <div className="renamer">
          <input
            className="renamer-input"
            autoFocus
            value={me.name}
            aria-label="Your team's name"
            placeholder="Name your team"
            onChange={(e) => onRenameTeam(me.id, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') setRenaming(false)
            }}
          />
          <button className="picker-done" onClick={() => setRenaming(false)}>Done</button>
        </div>
      ) : (
        <button className="picker-open" onClick={() => setRenaming(true)}>
          Change team name
        </button>
      ))}

      {picking && (
        <div className="picker">
          <div className="picker-label">Your name</div>
          <input
            className="picker-name"
            value={style?.label ?? name}
            maxLength={MAX_NAME}
            aria-label="Your name, as everyone will see it"
            onChange={(e) => onPickName(name, e.target.value)}
          />

          <div className="picker-label">Your colour</div>
          <div className="picker-row">
            {PLAYER_COLORS.map((c) => (
              <button
                key={c}
                className={`swatch${style?.color === c ? ' on' : ''}`}
                style={{ background: c }}
                aria-label={`Colour ${c}`}
                onClick={() => onPickStyle(name, c, style?.icon ?? PLAYER_EMOJI[0])}
              />
            ))}
          </div>

          <div className="picker-label">Your emoji</div>
          <div className="picker-row">
            {PLAYER_EMOJI.map((e) => (
              <button
                key={e}
                className={`shape${style?.icon === e ? ' on' : ''}`}
                aria-label={`Emoji ${e}`}
                onClick={() => onPickStyle(name, style?.color ?? PLAYER_COLORS[0], e)}
              >
                <PlayerIcon icon={e} size={22} />
              </button>
            ))}
          </div>

          <button
            className="picker-done"
            onClick={() => {
              markChosen()
              setPicking(false)
            }}
          >
            Done
          </button>
        </div>
      )}

      {myBuzz ? (
        <div className={`phone-result${place === 1 ? ' first' : ''}`}>
          <div className="phone-rings" aria-hidden="true"><i /><i /><i /></div>
          <div className="phone-place">
            {place === 1 ? 'IN!' : ORDINALS[(place ?? 1) - 1] ?? `#${place}`}
          </div>
          <div className="phone-ms">{(myBuzz.reactionMs / 1000).toFixed(2)}s</div>
        </div>
      ) : connection === 'reconnecting' ? (
        <div className="phone-buzz waiting">Reconnecting…</div>
      ) : connection === 'unavailable' ? (
        <div className="phone-buzz waiting small">
          Can’t reach the game.<br />Check the link with the host.
        </div>
      ) : connection === 'connecting' ? (
        <div className="phone-buzz waiting">Connecting…</div>
      ) : !me ? (
        <div className="phone-buzz waiting small">Teams haven’t been drawn yet</div>
      ) : open ? (
        <button
          className={`phone-buzz live${urgent ? ' urgent' : ''}`}
          onClick={() => {
            const started = armedAt.current
            if (started === null) return
            // A kick in the hand at the moment of pressing. No-ops where the API
            // is unsupported, which includes iOS Safari.
            navigator.vibrate?.([18, 40, 28])
            onBuzz(name, me.id, Math.max(0, Math.round(performance.now() - started)))
          }}
        >
          <span className="phone-buzz-label">Buzz</span>
          {left !== null && <span className="phone-buzz-clock">{left}</span>}
          <span className="phone-buzz-bar" aria-hidden="true">
            <i style={{ transform: `scaleX(${(left ?? 0) / 25})` }} />
          </span>
        </button>
      ) : (
        <div className="phone-buzz waiting">Hold tight</div>
      )}

      <button className="phone-switch" onClick={() => setName(null)}>Not you?</button>
    </div>
  )
}
