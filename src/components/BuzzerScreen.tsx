import { useEffect, useRef, useState } from 'react'
import type { GameState } from '../types'
import type { Connection } from '../net/useRoom'
import { playerId, savedName, saveName, hasChosen, markChosen } from '../net/player'
import { PLAYER_COLORS, PLAYER_EMOJI, freeStyle } from '../data/avatars'
import { PlayerIcon, PlayerPill } from './PlayerPill'
import { Wordmark } from './Wordmark'

type Props = {
  state: GameState
  connection: Connection
  onBuzz: (name: string, teamId: number, reactionMs: number) => void
  onPickStyle: (name: string, color: string, icon: string) => void
  /** Anyone on a team can rename it, and it changes everywhere at once. */
  onRenameTeam: (teamId: number, name: string) => void
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
  state, connection, onBuzz, onPickStyle, onRenameTeam,
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
  const style = name ? state.playerStyles[name] : undefined

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

  /** Hand out a colour and shape on arrival, so nobody has to choose. */
  useEffect(() => {
    if (!name || style) return
    const taken = Object.entries(state.playerStyles)
      .filter(([n]) => n !== name)
      .map(([, s]) => s)
    const suggested = freeStyle(taken)
    onPickStyle(name, suggested.color, suggested.icon)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, style])

  if (!name || !onRoster) {
    return (
      <div className="phone">
        <div className="phone-head"><Wordmark /></div>
        <p className="phone-pick-label">Who are you?</p>
        {state.roster.length === 0 ? (
          <p className="phone-note">Waiting for the host to open the game.</p>
        ) : (
          <div className="phone-names">
            {state.roster.map((member) => {
              const st = state.playerStyles[member]
              return (
                <button
                  key={member}
                  className="phone-name"
                  style={st ? { ['--team' as string]: st.color } : undefined}
                  onClick={() => {
                    saveName(member)
                    setName(member)
                  }}
                >
                  {st && <PlayerIcon icon={st.icon} size={15} />}
                  {member}
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  const accent = style?.color ?? '#8B90E5'

  return (
    <div className="phone" style={{ ['--team' as string]: accent }}>
      <div className="phone-id">
        {style && <PlayerIcon icon={style.icon} size={30} />}
        <span className="phone-who">{name}</span>

        {me ? (
          <>
            <span className="phone-team">{me.name}</span>
            {me.members.length > 1 && (
              <div className="phone-mates">
                {me.members
                  .filter((m) => m !== name)
                  .map((m) => (
                    <PlayerPill key={m} name={m} style={state.playerStyles[m]} size="sm" />
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

      {picking ? (
        <div className="picker">
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
      ) : (
        <button className="picker-open" onClick={() => setPicking(true)}>
          Change colour &amp; emoji
        </button>
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
