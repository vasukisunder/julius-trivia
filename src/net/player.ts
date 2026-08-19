/** Stable per-phone identity, so one player cannot stack the buzz queue. */
const KEY = 'julius-trivia:player'

export function playerId(): string {
  let id = localStorage.getItem(KEY)
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36)
    localStorage.setItem(KEY, id)
  }
  return id
}

const NAME_KEY = 'julius-trivia:player-name'

export function savedName(): string | null {
  return localStorage.getItem(NAME_KEY)
}

export function saveName(name: string) {
  localStorage.setItem(NAME_KEY, name)
}

const CHOSE_KEY = 'julius-trivia:player-chose'

/** Whether this phone has been through the colour/emoji picker before. */
export function hasChosen(): boolean {
  return localStorage.getItem(CHOSE_KEY) === '1'
}

export function markChosen() {
  localStorage.setItem(CHOSE_KEY, '1')
}
