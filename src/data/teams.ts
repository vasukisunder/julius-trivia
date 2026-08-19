import { TEAMMATES } from './index'

/**
 * Neutral placeholders on purpose. Clever names drawn from the board's answers
 * meant nothing to anyone before the questions had been played. The room names
 * its own teams — every one of these is editable.
 */
export const TEAM_NAMES = ['Team 1', 'Team 2', 'Team 3', 'Team 4', 'Team 5', 'Team 6']

/** Default number of teams; the host can change it during setup. */
export const TEAM_COUNT = 3
export const MIN_TEAMS = 2
export const MAX_TEAMS = 6

/** Placeholder name for team n (0-indexed). */
export const teamNameFor = (i: number) => TEAM_NAMES[i] ?? `Team ${i + 1}`

/** Fisher–Yates. Returns a new array; does not touch the input. */
export function shuffle<T>(items: readonly T[]): T[] {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * Deals everyone into `count` teams as evenly as possible — 14 people across 3
 * teams becomes 5/5/4 — by dealing round-robin off a shuffled deck. This is why
 * the roster is edited first: the draw can only be even if it knows who is here.
 */
export function drawTeams(
  people: readonly string[] = TEAMMATES,
  count: number = TEAM_COUNT,
): string[][] {
  const deck = shuffle(people)
  const teams: string[][] = Array.from({ length: Math.max(1, count) }, () => [])
  deck.forEach((person, i) => teams[i % teams.length].push(person))
  return teams
}
