import type { Buzz, ClueRef, GameState, Team } from '../types'
import { clueKey, FINAL_REF } from '../types'
import { CATEGORIES, FINAL_CLUE } from '../data'
import { TEAMMATES } from '../data'
import { MAX_TEAMS, MIN_TEAMS, TEAM_COUNT, drawTeams, teamNameFor } from '../data/teams'


export type Action =
  | { type: 'toggleAward'; key: string; teamId: number }
  | { type: 'consumeClue'; key: string }
  | { type: 'adjustScore'; teamId: number; delta: number }
  | { type: 'renameTeam'; teamId: number; name: string }
  | { type: 'resetGame' }
  | { type: 'newGame' }
  | { type: 'setTeams'; rosters: string[][] }
  | { type: 'redraw' }
  | { type: 'resetRoster' }
  | { type: 'setPlayerStyle'; name: string; color: string; icon: string }
  | { type: 'addToRoster'; name: string }
  | { type: 'removeFromRoster'; name: string }
  | { type: 'setTeamCount'; count: number }
  | { type: 'shuffleTeams' }
  | { type: 'backToRoster' }
  | { type: 'addMember'; teamId: number; name: string }
  | { type: 'removeMember'; teamId: number; name: string }
  | { type: 'openClue'; ref: ClueRef }
  | { type: 'closeClue' }
  | { type: 'reveal' }
  | { type: 'endBuzzing' }
  | { type: 'startTimer'; seconds: number }
  | { type: 'openBuzzers'; seconds: number }
  | { type: 'closeBuzzers' }
  | { type: 'buzz'; buzz: Buzz }
  | { type: 'markWrong'; teamId: number }
  | { type: 'awardTo'; teamId: number; points: number }
  | { type: 'setFinalHits'; teamId: number; hits: number }
  | { type: 'startCeremony'; seconds: number }
  | { type: 'revealWinner' }
  | { type: 'endCeremony' }
  | { type: 'backToDraft' }
  | { type: 'hydrate'; state: GameState }
  | { type: 'clearClue'; key: string }

/** Bump on any change to the saved shape or to the seeded defaults. */
export const STATE_VERSION = 15

export function initialState(): GameState {
  return {
    version: STATE_VERSION,
    roster: TEAMMATES.slice(),
    playerStyles: {},
    teamCount: TEAM_COUNT,
    teams: [],
    awards: {},
    used: [],
    adjustments: {},
    finalHits: {},
    teamSeq: TEAM_COUNT + 1,
    phase: 'roster',
    drawSeq: 0,
    open: null,
    cluePhase: 'reading',
    timerEndsAt: null,
    buzzOpenedAt: null,
    buzzes: [],
    lockedOut: [],
    lastAward: null,
    lastWrong: null,
    ceremony: 'off',
    ceremonyEndsAt: null,
  }
}

export function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    // Adopts state written by another window on this machine.
    case 'hydrate':
      return action.state

    // Opening a clue is shared, so the presentation screen follows the host.
    // A clue already played reopens with its answer up, since the host is
    // re-scoring something the room has already seen.
    case 'openClue':
      return {
        ...state,
        open: action.ref,
        // Reopening something already played goes straight to the answer: the
        // host is correcting a score, not running the clue again.
        cluePhase: state.used.includes(clueKey(action.ref)) ? 'revealed' : 'reading',
        timerEndsAt: null,
        buzzOpenedAt: null,
        buzzes: [],
        lockedOut: [],
      }

    case 'closeClue':
      return {
        ...state,
        open: null, cluePhase: 'reading', timerEndsAt: null,
        buzzOpenedAt: null, buzzes: [], lockedOut: [],
      }

    // Step 2. Opening the buzzers and starting the clock are one moment.
    case 'openBuzzers':
      return {
        ...state,
        cluePhase: 'buzzing',
        buzzOpenedAt: Date.now(),
        timerEndsAt: Date.now() + action.seconds * 1000,
        buzzes: [],
        lockedOut: [],
      }

    /**
     * Step 3. The clock ran out or the host stopped it. Whoever buzzed fastest
     * gets the floor; with nobody on the buzzers there is nothing to rule on, so
     * it goes straight to the answer.
     */
    case 'endBuzzing':
    case 'closeBuzzers': {
      const next = state.buzzes.find((b) => !state.lockedOut.includes(b.teamId))
      return {
        ...state,
        buzzOpenedAt: null,
        timerEndsAt: null,
        cluePhase: next ? 'verdict' : 'revealed',
      }
    }

    case 'buzz': {
      // Buzzes only count while the buzzers are open, and one per phone.
      if (state.buzzOpenedAt === null) return state
      if (state.buzzes.some((b) => b.playerId === action.buzz.playerId)) return state
      const buzzes = [...state.buzzes, action.buzz].sort((a, b) => a.reactionMs - b.reactionMs)
      return { ...state, buzzes }
    }

    /**
     * A wrong answer locks that team out and promotes the next-fastest buzz from
     * a team still in play. Once everyone who buzzed is out there is nobody left
     * to ask, so the answer goes up.
     */
    case 'markWrong': {
      const key = state.open ? clueKey(state.open) : null
      const lockedOut = state.lockedOut.includes(action.teamId)
        ? state.lockedOut
        : [...state.lockedOut, action.teamId]
      const next = state.buzzes.find((b) => !lockedOut.includes(b.teamId))
      return {
        ...state,
        lockedOut,
        cluePhase: next ? 'verdict' : 'revealed',
        lastWrong: key
          ? { teamId: action.teamId, key, seq: (state.lastWrong?.seq ?? 0) + 1 }
          : state.lastWrong,
      }
    }

    // Award, and stamp it so every screen fires the same celebration.
    case 'awardTo': {
      const key = state.open ? clueKey(state.open) : null
      if (!key) return state
      // The closing question is scored from finalHits, where several teams can each
      // hold a partial. Letting it into the ledger as well would count it twice.
      if (key === FINAL_KEY) return state
      const current = state.awards[key] ?? []
      const awards = current.includes(action.teamId)
        ? state.awards
        : { ...state.awards, [key]: [...current, action.teamId] }
      return {
        ...state,
        awards,
        cluePhase: 'revealed',
        buzzOpenedAt: null,
        timerEndsAt: null,
        lastAward: {
          teamId: action.teamId,
          points: action.points,
          key,
          seq: (state.lastAward?.seq ?? 0) + 1,
        },
      }
    }

    /**
     * Partial credit on the closing question. Unlike a tile, every team can score
     * here, and each of the three matches is worth a third of the thousand.
     */
    case 'setFinalHits': {
      const hits = Math.max(0, Math.min(FINAL_ITEMS, Math.round(action.hits)))
      const finalHits = { ...state.finalHits }
      if (hits === 0) delete finalHits[action.teamId]
      else finalHits[action.teamId] = hits
      const points = finalPoints(hits)
      return {
        ...state,
        finalHits,
        // Only a change upward is worth a celebration; correcting a mistake down
        // should not set off the confetti again.
        lastAward: points > (finalPoints(state.finalHits[action.teamId] ?? 0))
          ? {
              teamId: action.teamId,
              points,
              key: FINAL_KEY,
              seq: (state.lastAward?.seq ?? 0) + 1,
            }
          : state.lastAward,
      }
    }

    // Skips ahead to the answer — for a clue nobody wants to buzz on.
    case 'reveal':
      return { ...state, cluePhase: 'revealed', buzzOpenedAt: null, timerEndsAt: null }

    case 'startTimer':
      return { ...state, timerEndsAt: Date.now() + action.seconds * 1000 }

    case 'toggleAward': {
      const current = state.awards[action.key] ?? []
      const next = current.includes(action.teamId)
        ? current.filter((id) => id !== action.teamId)
        : [...current, action.teamId]
      const awards = { ...state.awards }
      if (next.length) awards[action.key] = next
      else delete awards[action.key]
      return { ...state, awards }
    }

    case 'consumeClue': {
      if (state.used.includes(action.key)) return state
      return { ...state, used: [...state.used, action.key] }
    }

    // Puts a clue back on the board and strips any points it awarded.
    case 'clearClue': {
      const awards = { ...state.awards }
      delete awards[action.key]
      return {
        ...state,
        awards,
        // The closing question's points live in finalHits, so clearing the ledger
        // alone would leave them standing.
        finalHits: action.key === FINAL_KEY ? {} : state.finalHits,
        used: state.used.filter((k) => k !== action.key),
      }
    }

    case 'adjustScore': {
      const prev = state.adjustments[action.teamId] ?? 0
      return {
        ...state,
        adjustments: { ...state.adjustments, [action.teamId]: prev + action.delta },
      }
    }

    case 'renameTeam':
      return {
        ...state,
        teams: state.teams.map((t) =>
          t.id === action.teamId ? { ...t, name: action.name } : t,
        ),
      }

    // Locks in the drawn teams and starts the game.
    case 'setTeams': {
      const teams: Team[] = action.rosters.map((members, i) => ({
        id: i + 1,
        name: state.teams[i]?.name ?? teamNameFor(i),
        members,
      }))
      return { ...state, teams, teamSeq: teams.length + 1, phase: 'board' }
    }

    /**
     * Claims a colour and shape. Uniqueness is settled here rather than in the
     * UI: two phones can pick at the same moment, and the Durable Object is the
     * only place that can arbitrate. A clash falls back to the next free one, so
     * the second player still ends up with something of their own.
     */
    // Whatever they picked, including one someone else already has. Two people
    // wanting the same fox is their business.
    case 'setPlayerStyle':
      return {
        ...state,
        playerStyles: {
          ...state.playerStyles,
          [action.name]: { color: action.color, icon: action.icon },
        },
      }

    // Puts the sign-up list back, for when too many people got x-ed out.
    case 'resetRoster':
      return { ...state, roster: TEAMMATES.slice() }

    case 'addToRoster': {
      const name = action.name.trim()
      if (!name || state.roster.includes(name)) return state
      return { ...state, roster: [...state.roster, name] }
    }

    case 'removeFromRoster':
      return {
        ...state,
        roster: state.roster.filter((n) => n !== action.name),
        teams: state.teams.map((t) => ({
          ...t,
          members: t.members.filter((n) => n !== action.name),
        })),
      }

    case 'setTeamCount':
      return {
        ...state,
        teamCount: Math.min(MAX_TEAMS, Math.max(MIN_TEAMS, action.count)),
      }

    // Draws the confirmed roster into teams and moves to the shuffle screen.
    case 'shuffleTeams':
    case 'redraw': {
      const rosters = drawTeams(state.roster, state.teamCount)
      return {
        ...state,
        teams: rosters.map((members, i) => ({
          // Keep any name the room has already typed for this slot.
          id: i + 1,
          name: state.teams[i]?.name ?? teamNameFor(i),
          members,
        })),
        teamSeq: rosters.length + 1,
        phase: 'draft',
        drawSeq: state.drawSeq + 1,
      }
    }

    case 'backToRoster':
      return { ...state, phase: 'roster' }

    // Late edits after the shuffle keep the roster in step, so a reshuffle
    // deals the same set of people.
    case 'addMember': {
      const name = action.name.trim()
      if (!name) return state
      return {
        ...state,
        roster: state.roster.includes(name) ? state.roster : [...state.roster, name],
        teams: state.teams.map((t) =>
          t.id === action.teamId
            ? { ...t, members: t.members.includes(name) ? t.members : [...t.members, name] }
            : { ...t, members: t.members.filter((m) => m !== name) },
        ),
      }
    }

    case 'removeMember':
      return {
        ...state,
        roster: state.roster.filter((n) => n !== action.name),
        teams: state.teams.map((t) =>
          t.id === action.teamId
            ? { ...t, members: t.members.filter((m) => m !== action.name) }
            : t,
        ),
      }

    case 'backToDraft':
      return { ...state, phase: 'draft' }

    // The countdown, then the reveal. Split in two so the host's clock drives the
    // transition and both screens change together.
    case 'startCeremony':
      return {
        ...state,
        ceremony: 'countdown',
        ceremonyEndsAt: Date.now() + action.seconds * 1000,
        open: null,
      }

    case 'revealWinner':
      return { ...state, ceremony: 'winner', ceremonyEndsAt: null }

    case 'endCeremony':
      return { ...state, ceremony: 'off', ceremonyEndsAt: null }

    // Back to a blank slate, roster and all. Needed between a rehearsal and the
    // real night, since the Durable Object keeps state between sessions.
    case 'newGame':
      return initialState()

    // Keeps the teams and names, clears the board and every point.
    case 'resetGame':
      return {
        ...state,
        awards: {}, used: [], adjustments: {}, finalHits: {},
        open: null, cluePhase: 'reading', timerEndsAt: null,
        buzzOpenedAt: null, buzzes: [], lockedOut: [],
        lastAward: null, lastWrong: null,
        ceremony: 'off', ceremonyEndsAt: null,
      }

    default:
      return state
  }
}

/** The closing question's key, and how much one of its three matches is worth. */
export const FINAL_KEY = clueKey(FINAL_REF)
export const FINAL_ITEMS = FINAL_CLUE.kind === 'match' ? FINAL_CLUE.items.length : 1

/** Points for landing `hits` of the closing question's matches. */
export const finalPoints = (hits: number) =>
  Math.round((FINAL_CLUE.points * Math.max(0, Math.min(FINAL_ITEMS, hits))) / FINAL_ITEMS)

/** clueKey -> point value, built once from the board. */
const POINTS: Map<string, number> = (() => {
  const map = new Map<string, number>()
  CATEGORIES.forEach((category, c) => {
    category.clues.forEach((clue, r) => {
      map.set(`${c}-${r}`, clue.points)
    })
  })
  // The closing question is scored from finalHits, not from the ledger, so it is
  // deliberately absent here.
  return map
})()

/**
 * Scores derived from the award ledger, the closing question's partial credit, and
 * manual adjustments. Never stored, so awarding stays idempotent.
 */
export function computeScores(state: GameState): Map<number, number> {
  const scores = new Map<number, number>()
  for (const team of state.teams) scores.set(team.id, state.adjustments[team.id] ?? 0)
  for (const [key, ids] of Object.entries(state.awards)) {
    const points = POINTS.get(key) ?? 0
    for (const id of ids) {
      if (scores.has(id)) scores.set(id, (scores.get(id) ?? 0) + points)
    }
  }
  for (const [id, hits] of Object.entries(state.finalHits)) {
    const teamId = Number(id)
    if (scores.has(teamId)) {
      scores.set(teamId, (scores.get(teamId) ?? 0) + finalPoints(hits))
    }
  }
  return scores
}

/**
 * The buzz that currently has the floor: the fastest one from a team that has
 * not already answered this clue wrong. Null when the queue is exhausted.
 */
export function currentBuzz(state: GameState): Buzz | null {
  return state.buzzes.find((b) => !state.lockedOut.includes(b.teamId)) ?? null
}

/**
 * Final standings, highest first. Ties share a rank, so two teams level at the top
 * are both winners rather than one being silently ordered above the other.
 */
export function standings(state: GameState): { team: Team; score: number; rank: number }[] {
  const scores = computeScores(state)
  const rows = state.teams
    .map((team) => ({ team, score: scores.get(team.id) ?? 0, rank: 1 }))
    .sort((a, b) => b.score - a.score)
  rows.forEach((row, i) => {
    row.rank = i > 0 && row.score === rows[i - 1].score ? rows[i - 1].rank : i + 1
  })
  return rows
}
