import { useEffect, useReducer } from 'react'
import type { GameState } from '../types'
import { reducer, initialState, STATE_VERSION, type Action } from './gameState'

const STORAGE_KEY = `julius-trivia:v${STATE_VERSION}`

/**
 * Deletes every save from an older build. Bumping the key alone left the old
 * values sitting in storage, and any code path that read them brought stale
 * team names back; this makes the discard total.
 */
function pruneOldSaves() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (key && key.startsWith('julius-trivia:v') && key !== STORAGE_KEY) {
        localStorage.removeItem(key)
      }
    }
  } catch {
    // Storage unavailable; nothing to prune.
  }
}

/**
 * Loads saved state, tolerating anything malformed or written by an older
 * build: a bad save must never stop the game from starting.
 */
export function load(): GameState {
  const fresh = initialState()
  pruneOldSaves()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fresh
    const saved = JSON.parse(raw) as Partial<GameState>
    // A save from a different shape is thrown away, never merged.
    if (saved.version !== STATE_VERSION) return fresh
    if (!Array.isArray(saved.roster) || !saved.roster.length) return fresh
    if (!Array.isArray(saved.teams)) return fresh
    if (!saved.teams.every((t) => Array.isArray(t?.members))) return fresh
    return {
      version: STATE_VERSION,
      roster: saved.roster,
      playerStyles: saved.playerStyles ?? {},
      displayNames: saved.displayNames ?? {},
      teamCount: saved.teamCount ?? fresh.teamCount,
      teams: saved.teams,
      awards: saved.awards ?? {},
      used: Array.isArray(saved.used) ? saved.used : [],
      adjustments: saved.adjustments ?? {},
      finalHits: saved.finalHits ?? {},
      teamSeq: saved.teamSeq ?? saved.teams.length + 1,
      phase: saved.phase ?? fresh.phase,
      drawSeq: saved.drawSeq ?? 0,
      open: saved.open ?? null,
      cluePhase: saved.cluePhase ?? 'reading',
      timerEndsAt: saved.timerEndsAt ?? null,
      buzzOpenedAt: saved.buzzOpenedAt ?? null,
      buzzes: saved.buzzes ?? [],
      lockedOut: saved.lockedOut ?? [],
      lastAward: saved.lastAward ?? null,
      lastWrong: saved.lastWrong ?? null,
      ceremony: saved.ceremony ?? 'off',
      ceremonyEndsAt: saved.ceremonyEndsAt ?? null,
    }
  } catch {
    return fresh
  }
}

/** Writes state to storage, tolerating a full or blocked store. */
export function save(state: GameState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage full or blocked (private browsing) — the game still plays, it
    // just will not survive a refresh.
  }
}

export function usePersistentGame(): [GameState, React.Dispatch<Action>] {
  const [state, dispatch] = useReducer(reducer, undefined, load)

  // Until the realtime backend lands, two windows on the SAME machine keep in
  // step through the storage event. Across machines they will not — that is
  // what the Worker is for.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          dispatch({ type: 'hydrate', state: JSON.parse(e.newValue) as GameState })
        } catch {
          // Ignore an unparseable write from another window.
        }
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // Storage full or blocked (private browsing) — the game still plays,
      // it just will not survive a refresh.
    }
  }, [state])

  return [state, dispatch]
}
