import { useCallback, useEffect, useRef, useState } from 'react'
import type { GameState } from '../types'
import { reducer, STATE_VERSION, type Action } from './gameState'
import { load, save } from './usePersistentGame'
import { useRoom, type Connection } from '../net/useRoom'

/**
 * The single source of game state for every screen.
 *
 * Online — the room's WebSocket is up — the Durable Object is authoritative, so
 * the host laptop, the presentation laptop and every phone agree.
 *
 * Offline — running under plain `vite dev`, or the network dropped mid-game —
 * the same reducer runs locally, AND every change is pushed over a
 * BroadcastChannel so two windows on this machine still stay in step. Without
 * that channel the presentation window only picked up changes on refresh.
 */
const CHANNEL = 'julius-trivia'

export function useGame(): {
  state: GameState
  dispatch: (action: Action) => void
  connection: Connection
} {
  const room = useRoom()
  const [local, setLocal] = useState<GameState>(load)
  // Mirror of `local`, so a dispatch can compute the next state synchronously
  // and publish it in the same tick.
  const localRef = useRef(local)
  const channel = useRef<BroadcastChannel | null>(null)

  const online = room.connection === 'online'

  const adopt = useCallback((next: GameState) => {
    localRef.current = next
    setLocal(next)
  }, [])

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return
    const ch = new BroadcastChannel(CHANNEL)
    channel.current = ch
    ch.onmessage = (e) => {
      const next = e.data as GameState
      // Adopt only current-shape state, and never echo it back.
      if (next && next.version === STATE_VERSION) adopt(next)
    }
    return () => {
      ch.close()
      channel.current = null
    }
  }, [adopt])

  // Mirror whatever is authoritative into storage, so a refresh recovers.
  useEffect(() => {
    save(online ? room.state : local)
  }, [online, room.state, local])

  const dispatch = useCallback(
    (action: Action) => {
      if (online) {
        room.dispatch(action)
        return
      }
      const next = reducer(localRef.current, action)
      adopt(next)
      channel.current?.postMessage(next)
    },
    [online, room, adopt],
  )

  // Only trust server state once it is actually the current shape.
  const state = online && room.state.version === STATE_VERSION ? room.state : local

  return { state, dispatch, connection: room.connection }
}
