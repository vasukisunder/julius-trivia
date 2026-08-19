import { useCallback, useEffect, useRef, useState } from 'react'
import type { GameState } from '../types'
import { reducer, initialState, type Action } from '../state/gameState'
import { routeFromUrl } from '../routes'

/**
 * Connects to the room's Durable Object over a WebSocket. Every screen sends
 * actions and receives whole states, so the host screen, the presentation
 * screen and the phones cannot drift apart.
 */
/**
 * 'connecting'   trying, and has never succeeded
 * 'online'       connected
 * 'reconnecting' was connected, lost it, coming back
 * 'unavailable'  never reached a server — usually the wrong URL
 */
export type Connection = 'connecting' | 'online' | 'reconnecting' | 'unavailable'

/**
 * Actions the server must own outright, because applying them locally would
 * produce a DIFFERENT result than the server's:
 *
 *  - the draws are random, so an optimistic guess shows one set of teams and
 *    then snaps to another when the broadcast lands (and restarts the scramble);
 *  - the timers read the clock, and two laptops never agree to the millisecond.
 *
 * Everything else is deterministic, so the local guess always matches and the
 * host's clicks stay instant.
 */
const SERVER_OWNED = new Set<Action['type']>([
  'shuffleTeams',
  'redraw',
  'openBuzzers',
  'startTimer',
])

const ROOM = new URLSearchParams(window.location.search).get('room') ?? 'main'

/** How often to poke the server, and how long silence means a dead socket. */
const PING_MS = 20_000
const STALE_MS = 45_000

function socketUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}/api/room/${ROOM}/ws`
}

export function useRoom(): {
  state: GameState
  dispatch: (action: Action) => void
  connection: Connection
  /** Tile the host has under the cursor, mirrored from the host's screen. */
  hoveredKey: string | null
  sendHover: (key: string | null) => void
} {
  const [state, setState] = useState<GameState>(initialState)
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)
  const [connection, setConnection] = useState<Connection>('connecting')
  const ws = useRef<WebSocket | null>(null)
  const retry = useRef(0)
  const lastSeen = useRef(Date.now())
  // Distinguishes "temporarily dropped" from "there is no server here". Saying
  // "Reconnecting" forever when nothing was ever reachable is just misleading.
  const everConnected = useRef(false)

  useEffect(() => {
    let closed = false
    let reconnectTimer: number | undefined

    function connect() {
      if (closed) return
      let socket: WebSocket
      try {
        socket = new WebSocket(socketUrl())
      } catch {
        setConnection(everConnected.current ? 'reconnecting' : 'unavailable')
        return
      }
      ws.current = socket
      setConnection('connecting')

      socket.onopen = () => {
        retry.current = 0
        lastSeen.current = Date.now()
        everConnected.current = true
        setConnection('online')
        // Identify the surface so the server can target hover at the shared
        // screen instead of spending a message on every phone.
        socket.send(JSON.stringify({ type: 'hello', role: routeFromUrl() }))
      }

      socket.onmessage = (e) => {
        lastSeen.current = Date.now()
        try {
          const msg = JSON.parse(e.data as string)
          if (msg.type === 'state') setState(msg.state as GameState)
          else if (msg.type === 'hover') setHoveredKey(msg.key as string | null)
        } catch {
          // Ignore anything unparseable.
        }
      }

      socket.onclose = () => {
        if (closed) return
        setConnection(everConnected.current ? 'reconnecting' : 'unavailable')
        retry.current = Math.min(retry.current + 1, 5)
        reconnectTimer = window.setTimeout(connect, 400 * 2 ** retry.current)
      }

      socket.onerror = () => socket.close()
    }

    /** Reconnect now rather than waiting out the backoff. */
    function reconnectNow() {
      if (closed) return
      const socket = ws.current
      if (socket && socket.readyState === WebSocket.OPEN) return
      if (reconnectTimer) clearTimeout(reconnectTimer)
      retry.current = 0
      connect()
    }

    connect()

    /**
     * A phone that has been locked or backgrounded comes back with a socket that
     * looks open but is dead, so a player would sit there never seeing the
     * buzzer go live. Poke the server on a timer, treat silence as a dead
     * socket, and reconnect the moment the screen comes back.
     */
    const heartbeat = window.setInterval(() => {
      const socket = ws.current
      if (!socket || socket.readyState !== WebSocket.OPEN) return
      if (Date.now() - lastSeen.current > STALE_MS) {
        socket.close() // triggers onclose -> reconnect
        return
      }
      try {
        // Identify the surface so the server can target hover at the shared
        // screen instead of spending a message on every phone.
        socket.send(JSON.stringify({ type: 'hello', role: routeFromUrl() }))
      } catch {
        socket.close()
      }
    }, PING_MS)

    const onVisible = () => {
      if (document.visibilityState === 'visible') reconnectNow()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', reconnectNow)
    window.addEventListener('pageshow', onVisible)

    return () => {
      closed = true
      clearInterval(heartbeat)
      if (reconnectTimer) clearTimeout(reconnectTimer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', reconnectNow)
      window.removeEventListener('pageshow', onVisible)
      ws.current?.close()
    }
  }, [])

  const dispatch = useCallback((action: Action) => {
    const socket = ws.current
    const connected = socket && socket.readyState === WebSocket.OPEN

    // Guess locally only when the guess is guaranteed to match the server.
    if (!connected || !SERVER_OWNED.has(action.type)) {
      setState((prev) => reducer(prev, action))
    }
    if (connected) {
      socket.send(JSON.stringify({ type: 'action', action }))
    }
  }, [])

  /** Ephemeral, so it goes straight out rather than through the reducer. */
  const lastHover = useRef<string | null>(null)
  const sendHover = useCallback((key: string | null) => {
    if (lastHover.current === key) return
    lastHover.current = key
    const socket = ws.current
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'hover', key }))
    }
  }, [])

  return { state, dispatch, connection, hoveredKey, sendHover }
}
