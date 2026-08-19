/** A normal trivia question with one answer. */
export type StandardClue = {
  kind: 'standard'
  points: number
  question: string
  answer: string
  /** Whose specialist subject this came from. Omitted where it would spoil the answer. */
  credit?: string
}

/** Three statements about a teammate, one of them false. */
export type LieClue = {
  kind: 'lie'
  points: number
  person: string
  statements: string[]
  /** Index of the false statement. */
  lieIndex: number
  credit?: string
}

export type Clue = StandardClue | LieClue

export type Category = {
  name: string
  clues: Clue[]
}

/** Identifies one clue on the board. */
export type ClueRef = { categoryIndex: number; clueIndex: number }

/** Stable key for a clue, used by the award ledger and the used set. */
export const clueKey = (ref: ClueRef) => `${ref.categoryIndex}-${ref.clueIndex}`

export type Team = {
  id: number
  name: string
  /** Teammates drafted onto this team. */
  members: string[]
}

/**
 * Which surface is being shown. Host sees answers; presentation never does;
 * buzz is the phone screen players hold.
 */
export type ViewMode = 'host' | 'present' | 'buzz'

/**
 * Setup runs in two steps before the board: confirm who actually turned up,
 * then shuffle those people into teams. Editing the roster first is what makes
 * the shuffle come out even.
 */
export type Phase = 'roster' | 'draft' | 'board'

/**
 * Persisted game state. Scores are deliberately NOT stored: they are derived
 * from the award ledger plus manual adjustments, so awarding is idempotent and
 * a clue can be reopened and re-scored without the totals drifting.
 */
export type GameState = {
  /**
   * Shape version. Anything loaded from disk or from the server with a
   * different version is discarded rather than merged — merging is how stale
   * team names kept surviving a rename.
   */
  version: number
  /** Everyone playing. The authoritative list; teams are drawn from it. */
  roster: string[]
  /** How many teams to draw. Three by default. */
  teamCount: number
  teams: Team[]
  /** clueKey -> ids of teams credited with that clue. */
  awards: Record<string, number[]>
  /** clueKeys of clues the host has finished with. */
  used: string[]
  /** teamId -> manual point delta applied via the scoreboard steppers. */
  adjustments: Record<number, number>
  /** Next team id to hand out. */
  teamSeq: number
  /** Whether the teams have been drawn yet. */
  phase: Phase
  /**
   * Increments on every fresh draw. The draft animation keys off this, so
   * editing a roster by hand does not re-trigger the whole scramble.
   */
  drawSeq: number

  /* ---- Shared presentation state -------------------------------------------
     These live in game state rather than in a component so the presentation
     screen mirrors the host exactly: the host picks a tile and it opens on the
     shared screen, the host reveals and the room sees the answer at that moment.
  -------------------------------------------------------------------------- */

  /** The clue currently on screen, or null for the board. */
  open: ClueRef | null
  /** Whether the answer has been shown to the room. The host always sees it. */
  revealed: boolean
  /** Epoch ms the countdown ends, or null when no timer is running. */
  timerEndsAt: number | null

  /* ---- Buzzers ------------------------------------------------------------- */

  /** Epoch ms the host opened the buzzers, or null while they are shut. */
  buzzOpenedAt: number | null
  /**
   * Buzzes for the open clue, sorted fastest first.
   *
   * Ranked by each player's own measured reaction time, NOT by when their
   * message reached the server: over the internet that would rank people by
   * their broadband, not their reflexes.
   */
  buzzes: Buzz[]
  /** Teams that have already answered this clue wrong and are locked out. */
  lockedOut: number[]
  /** The most recent award, used to fire the celebration on every screen. */
  lastAward: Award | null
}

export type Buzz = {
  /** Stable per-phone id, so one player cannot stack the queue. */
  playerId: string
  name: string
  teamId: number
  /** Milliseconds between the buzzer lighting up and the player hitting it. */
  reactionMs: number
}

export type Award = {
  teamId: number
  points: number
  /**
   * The clue this was won on. The celebration is scoped to it, so a stale award
   * cannot replay itself when the next clue opens.
   */
  key: string
  /** Bumps on each award so the animation replays even for a repeat score. */
  seq: number
}
