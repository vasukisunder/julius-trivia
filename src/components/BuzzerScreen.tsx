import { useEffect, useRef, useState } from 'react'
import type { GameState } from '../types'
import type { Connection } from '../net/useRoom'
import { playerId, savedName, saveName, hasChosen, markChosen } from '../net/player'
import { PLAYER_COLORS, PLAYER_EMOJI, freeStyle } from '../data/avatars'
import { PlayerIcon } from './PlayerPill'
import { Wordmark } from './Wordmark'

type Props = {
  state: GameState
  connection: Connection
  onBuzz: (name: string, teamId: number, reactionMs: number) => void
  onPickStyle: (name: string, color: string, icon: string) => void
}

/**
 * The phone screen. Players pick their name once, get a colour and shape, then
 * hold this open.
 *
 * Reaction time is measured on the phone itself: the clock starts when the button
 * actually paints and stops when the player taps. That number is what gets sent,
 * so ranking reflects reflexes rather than whose wifi is fastest.
 */
export function BuzzerScreen({ state, connection, onBuzz, onPickStyle }: Props) {
  const [name, setName] = useState<string | null>(savedName)
  // Opens by default the first time, because a picker you have to discover is a
  // picker nobody uses.
  const [picking, setPicking] = useState(() => !hasChosen())
  const armedAt = useRef<number | null>(null)

  const me = state.teams.find((t) => t.members.includes(name ?? ''))
  const open = state.buzzOpenedAt !== null
  const myBuzz = state.buzzes.find((b) => b.playerId === playerId())
  const place = myBuzz ? state.buzzes.indexOf(myBuzz) + 1 : null
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

  if (!name || !me) {
    return (
      <div className="phone">
        <div className="phone-head"><Wordmark /></div>
        <p className="phone-pick-label">Who are you?</p>
        <div className="phone-names">
          {state.teams.flatMap((team) =>
            team.members.map((member) => {
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
            }),
          )}
        </div>
      </div>
    )
  }

  const accent = style?.color ?? '#8B90E5'

  return (
    <div className="phone" style={{ ['--team' as string]: accent }}>
      <div className="phone-id">
        {style && <PlayerIcon icon={style.icon} size={30} />}
        <span className="phone-who">{name}</span>
        <span className="phone-team">{me.name}</span>
      </div>

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
        <div className="phone-result">
          <div className="phone-place">{place === 1 ? 'First!' : `#${place}`}</div>
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
      ) : open ? (
        <button
          className="phone-buzz live"
          onClick={() => {
            const started = armedAt.current
            if (started === null) return
            onBuzz(name, me.id, Math.max(0, Math.round(performance.now() - started)))
          }}
        >
          Buzz
        </button>
      ) : (
        <div className="phone-buzz waiting">Hold tight</div>
      )}

      <button className="phone-switch" onClick={() => setName(null)}>Not you?</button>
    </div>
  )
}
