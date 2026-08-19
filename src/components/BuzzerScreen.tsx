import { useEffect, useRef, useState } from 'react'
import type { GameState } from '../types'
import type { Connection } from '../net/useRoom'
import { playerId, savedName, saveName } from '../net/player'
import { teamColor } from '../theme'
import { Wordmark } from './Wordmark'

type Props = {
  state: GameState
  connection: Connection
  onBuzz: (name: string, teamId: number, reactionMs: number) => void
}

/**
 * The phone screen. Players pick their name once, then hold this open.
 *
 * Reaction time is measured on the phone itself: the clock starts when the
 * button actually paints, and stops when the player taps. That number is what
 * gets sent, so ranking reflects reflexes rather than whose wifi is fastest.
 */
export function BuzzerScreen({ state, connection, onBuzz }: Props) {
  const [name, setName] = useState<string | null>(savedName)
  const armedAt = useRef<number | null>(null)

  const me = state.teams.find((t) => t.members.includes(name ?? ''))
  const teamIndex = me ? state.teams.indexOf(me) : 0
  const open = state.buzzOpenedAt !== null
  const myBuzz = state.buzzes.find((b) => b.playerId === playerId())
  const place = myBuzz ? state.buzzes.indexOf(myBuzz) + 1 : null

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

  if (!name || !me) {
    return (
      <div className="phone">
        <div className="phone-head">
          <Wordmark />
        </div>
        <p className="phone-pick-label">Who are you?</p>
        <div className="phone-names">
          {state.teams.flatMap((team, t) =>
            team.members.map((member) => (
              <button
                key={member}
                className="phone-name"
                style={{ ['--team' as string]: teamColor(t) }}
                onClick={() => {
                  saveName(member)
                  setName(member)
                }}
              >
                {member}
              </button>
            )),
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="phone" style={{ ['--team' as string]: teamColor(teamIndex) }}>
      <div className="phone-head">
        <div className="phone-who">{name}</div>
        <div className="phone-team">{me.name}</div>
      </div>

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
