import type { ViewMode } from './types'

/**
 * Every view has its own path, and nothing is served at the root:
 *
 *   /host      the host, marking answers
 *   /present   the window shared with the room
 *   /buzz      the phone screen
 *   /          deliberately empty
 *
 * The empty root matters. The host view prints the whole answer key, so if it
 * lived at `/` a player could delete "buzz" off their link and read every
 * answer. Nothing on the root page hints at the other paths.
 */
export const PRESENT_URL = '/present'
export const BUZZ_URL = '/buzz'

export type Route = ViewMode | 'none'

export function routeFromUrl(): Route {
  const last = window.location.pathname.split('/').filter(Boolean).pop()
  if (last === 'host') return 'host'
  if (last === 'present') return 'present'
  if (last === 'buzz') return 'buzz'
  return 'none'
}

/** The link players open on their phones. */
export function buzzUrl(): string {
  return `${window.location.origin}${BUZZ_URL}`
}
