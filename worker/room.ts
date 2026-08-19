/**
 * One Durable Object per game room.
 *
 * A Durable Object is single-threaded, which is exactly what a buzzer needs:
 * every buzz is ordered by one authority with no races. It also holds the
 * game state, so the host screen, the presentation screen and every phone are
 * looking at the same object rather than at their own copies.
 */
import { reducer, initialState, STATE_VERSION, type Action } from '../src/state/gameState'
import type { GameState } from '../src/types'

type ClientMsg =
  | { type: 'action'; action: Action }
  | { type: 'hello' }

type ServerMsg =
  | { type: 'state'; state: GameState }
  | { type: 'error'; message: string }

export class Room {
  private state: DurableObjectState
  private game: GameState | null = null
  /**
   * Serialises message handling.
   *
   * `webSocketMessage` is async and the runtime may invoke it again before the
   * previous call finishes, so two actions arriving together both read the same
   * state and the second save clobbers the first. That is not theoretical: the
   * host opening a clue and opening the buzzers back-to-back lost the buzzers.
   * Chaining every message through one promise makes the object behave like the
   * single writer it is meant to be.
   */
  private tail: Promise<void> = Promise.resolve()

  constructor(state: DurableObjectState) {
    this.state = state
  }

  private async load(): Promise<GameState> {
    if (!this.game) {
      const stored = await this.state.storage.get<GameState>('game')
      // Discard anything from an older shape rather than merging it.
      this.game = stored && stored.version === STATE_VERSION ? stored : initialState()
    }
    return this.game
  }

  private async save(game: GameState) {
    this.game = game
    await this.state.storage.put('game', game)
  }

  private broadcast(msg: ServerMsg) {
    const payload = JSON.stringify(msg)
    for (const ws of this.state.getWebSockets()) {
      try {
        ws.send(payload)
      } catch {
        // A socket that has gone away is cleaned up by the runtime.
      }
    }
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected a WebSocket upgrade', { status: 426 })
    }

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket]

    // Hibernation: the object can be evicted between messages without dropping
    // connections, which keeps this comfortably inside the free plan.
    this.state.acceptWebSocket(server)

    const game = await this.load()
    server.send(JSON.stringify({ type: 'state', state: game } satisfies ServerMsg))

    return new Response(null, { status: 101, webSocket: client })
  }

  webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    this.tail = this.tail.then(() => this.handle(ws, raw)).catch(() => {
      // One bad message must not wedge the queue for everyone else.
    })
    return this.tail
  }

  private async handle(_ws: WebSocket, raw: string | ArrayBuffer) {
    if (typeof raw !== 'string') return

    let msg: ClientMsg
    try {
      msg = JSON.parse(raw) as ClientMsg
    } catch {
      return
    }

    const game = await this.load()

    if (msg.type === 'hello') {
      _ws.send(JSON.stringify({ type: 'state', state: game } satisfies ServerMsg))
      return
    }

    if (msg.type === 'action') {
      // The same reducer the client runs, so behaviour cannot drift between
      // the two — and the server's copy is the one that counts.
      const next = reducer(game, msg.action)
      if (next !== game) {
        await this.save(next)
        this.broadcast({ type: 'state', state: next })
      }
    }
  }

  async webSocketClose() {
    // Nothing to do: state lives in storage, not in the connection.
  }
}
