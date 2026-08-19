/**
 * Serves the built app AND the realtime room from one Worker, so the whole thing
 * deploys to a single URL with no CORS and nothing to run locally.
 */
export { Room } from './room'

type Env = {
  ROOM: DurableObjectNamespace
  ASSETS: Fetcher
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // /api/room/<code>/ws  ->  the Durable Object for that room
    const match = url.pathname.match(/^\/api\/room\/([A-Za-z0-9_-]{1,32})\/ws$/)
    if (match) {
      const id = env.ROOM.idFromName(match[1])
      return env.ROOM.get(id).fetch(request)
    }

    // Everything else is the static app.
    return env.ASSETS.fetch(request)
  },
}
