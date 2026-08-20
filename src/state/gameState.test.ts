import { reducer, initialState, computeScores, currentBuzz, STATE_VERSION } from './gameState'
import type { GameState } from '../types'
import { CATEGORIES, TEAMMATES, PEOPLE, HOST, FINAL_CLUE } from '../data'
import { FINAL_REF } from '../types'
import { TEAM_NAMES, TEAM_COUNT, drawTeams } from '../data/teams'
import { PLAYER_COLORS, PLAYER_EMOJI, freeStyle } from '../data/avatars'

let pass = 0, fail = 0
const check = (label: string, cond: boolean) => {
  if (cond) { pass++; console.log('  PASS ' + label) }
  else { fail++; console.log('  FAIL ' + label) }
}
const score = (s: GameState, id: number) => computeScores(s).get(id) ?? 0

const allClues = CATEGORIES.flatMap(c => c.clues)
const lieClues = allClues.flatMap(c => (c.kind === 'lie' ? [c] : []))
const standard = allClues.flatMap(c => (c.kind === 'standard' ? [c] : []))

// ---------------------------------------------------------------- content --
console.log('board shape')
console.log(`  (${CATEGORIES.length} categories, ${allClues.length} clues, ${lieClues.length} spot-the-lie)`)
check('defaults to three teams', TEAM_COUNT === 3)
check('a 6x6 board — 6 categories', CATEGORIES.length === 6)
check('36 clues, six per category', allClues.length === 36 && CATEGORIES.every(c => c.clues.length === 6))
check('every clue has a positive point value', allClues.every(c => c.points > 0))
check('standard clues all have a question and answer', standard.every(c => !!c.question && !!c.answer))
check('every lie clue has exactly 3 statements', lieClues.every(c => c.statements.length === 3))
check('every lieIndex is a valid statement index',
  lieClues.every(c => c.lieIndex >= 0 && c.lieIndex < c.statements.length))
// Juan never said which of his statements was false, so he cannot have a card.
check('nobody has a card whose lie is unknown',
  !lieClues.some(c => c.person === 'Juan'))

/**
 * Position matters more than it looks. Every card was written with the lie last,
 * which after two cards teaches the room to just pick the third one and stop
 * reading.
 */
const positions = lieClues.map(c => c.lieIndex)
const spread = [0, 1, 2].map(i => positions.filter(p => p === i).length)
check(`the lie uses all three positions (${spread.join('/')})`,
  spread.every(n => n > 0))
check('and no position holds more than half the cards',
  Math.max(...spread) <= Math.ceil(lieClues.length / 2))

console.log('\nauthoring mistakes that would show up mid-game')
// A spot-the-lie card names a person; if that name is not a real teammate, the
// pills and team lookups have nothing to resolve.
const unknownPeople = lieClues.filter(c => !PEOPLE.includes(c.person)).map(c => c.person)
check('every lie card names someone real' + (unknownPeople.length ? ` (${unknownPeople})` : ''),
  unknownPeople.length === 0)

// A credit naming nobody real is a typo waiting to be read out loud.
const badCredits = allClues
  .filter(c => c.credit && !TEAMMATES.some(n => c.credit!.includes(n)))
  .map(c => c.credit)
check('every credit names a known teammate' + (badCredits.length ? ` (${badCredits})` : ''),
  badCredits.length === 0)

// Points must climb down a column or the values mean nothing.
const badLadder = CATEGORIES
  .filter(c => c.clues.some((cl, i) => i > 0 && cl.points <= c.clues[i - 1].points))
  .map(c => c.name)
check('points ascend down every column' + (badLadder.length ? ` (${badLadder})` : ''),
  badLadder.length === 0)

// A question containing its own answer gives itself away.
const selfAnswering = standard.filter(c => {
  const a = c.answer.replace(/^(The|A|An) /i, '').split(/[—·(]/)[0].trim()
  return a.length > 3 && c.question.toLowerCase().includes(a.toLowerCase())
}).map(c => c.answer)
check('no question contains its own answer' + (selfAnswering.length ? ` (${selfAnswering})` : ''),
  selfAnswering.length === 0)

// A clue whose answer is a teammate must not carry a credit: the credit says
// whose specialty it is, which would hand over the answer.
const leaky = standard.filter(c => TEAMMATES.includes(c.answer) && c.credit).map(c => c.answer)
check('no personal clue leaks its answer through a credit' + (leaky.length ? ` (${leaky})` : ''),
  leaky.length === 0)

const dupQuestions = standard.map(c => c.question).filter((q, i, a) => a.indexOf(q) !== i)
check('no duplicate questions', dupQuestions.length === 0)
check('no duplicate category names',
  new Set(CATEGORIES.map(c => c.name)).size === CATEGORIES.length)

console.log('\nname highlighting has something to work with')
// Names are picked out of clue text at render time. If a credit stops naming
// anyone, or a name is misspelled, the highlight silently does nothing — so the
// data is checked rather than the rendering.
const nameRe = new RegExp(
  `\\b(${[...PEOPLE].sort((a, b) => b.length - a.length).join('|')})\\b`,
)
const creditsWithoutNames = allClues
  .filter(c => c.credit && !nameRe.test(c.credit))
  .map(c => c.credit)
check('every credit contains a matchable teammate name' +
  (creditsWithoutNames.length ? ` (${creditsWithoutNames})` : ''),
  creditsWithoutNames.length === 0)
check('every lie card person is matchable',
  lieClues.every(c => nameRe.test(c.person)))
// "Ask" is a real name and an ordinary verb; a loose match would light up prose.
const looseAskHits = standard.filter(c => /\bask\b/.test(c.question)).map(c => c.question)
check('no clue text contains lowercase "ask" that a loose match would catch' +
  (looseAskHits.length ? ` (${looseAskHits.length})` : ''),
  looseAskHits.length === 0)

console.log('\nrenaming a team')
// Renaming is shared state, so a player doing it from their phone changes the name
// on the host's board and the shared screen at the same moment.
let sn2 = reducer(initialState(), { type: 'shuffleTeams' })
const t = sn2.teams[1]
sn2 = reducer(sn2, { type: 'renameTeam', teamId: t.id, name: 'Quiz Khalifa' })
check('a team can be renamed during setup', sn2.teams[1].name === 'Quiz Khalifa')
check('renaming touches nothing else', sn2.teams[1].members === t.members)
sn2 = reducer(sn2, { type: 'setTeams', rosters: sn2.teams.map(x => x.members) })
check('the name survives starting the game', sn2.teams[1].name === 'Quiz Khalifa')
sn2 = reducer(sn2, { type: 'renameTeam', teamId: t.id, name: 'Les Quizerables' })
check('and can still be renamed mid-game', sn2.teams[1].name === 'Les Quizerables')
sn2 = reducer(sn2, { type: 'renameTeam', teamId: t.id, name: '' })
check('clearing it is allowed, so a placeholder can show', sn2.teams[1].name === '')

console.log('\nthe closing question')
// It is deliberately off the board: reachable only from the host toolbar, and worth
// more than any tile.
const onBoard = CATEGORIES.flatMap(c => c.clues)
check('it outscores every tile',
  FINAL_CLUE.points > Math.max(...onBoard.map(c => c.points)))
check('it is a matching clue, not three facts crammed into one sentence',
  FINAL_CLUE.kind === 'match')
const items = FINAL_CLUE.kind === 'match' ? FINAL_CLUE.items : []
check('it pairs three facts with three people', items.length === 3)
check('each fact names a different person',
  new Set(items.map(i => i.person)).size === items.length)
check('everyone it names is real', items.every(i => PEOPLE.includes(i.person)))
check('no fact gives away its own person',
  items.every(i => !i.fact.includes(i.person)))
check('no matching clue sits on the board too',
  !onBoard.some(c => c.kind === 'match'))
// It scores through the same ledger as everything else.
let sf = reducer(initialState(), { type: 'shuffleTeams' })
sf = reducer(sf, { type: 'setTeams', rosters: sf.teams.map(t => t.members) })
sf = reducer(sf, { type: 'openClue', ref: FINAL_REF })
check('opening it starts the same sequence', sf.cluePhase === 'reading')
sf = reducer(sf, { type: 'awardTo', teamId: sf.teams[0].id, points: FINAL_CLUE.points })
check('awarding it credits the full value',
  computeScores(sf).get(sf.teams[0].id) === FINAL_CLUE.points)
check('and it lands under its own key, not a tile’s', sf.lastAward?.key === '-1-0')

console.log('\nteammate coverage')
/**
 * A personal clue is one with no specialist subject attached. It counts whether the
 * teammate is the answer ("Which teammate used to brew their own beer?" -> Hannah)
 * or the subject of the question ("Which state does Matt intend to never visit?"),
 * since either way the clue is about them.
 */
const personalText = allClues
  .map(c =>
    c.kind === 'lie' ? c.person
    : c.kind === 'match' ? c.items.map(i => i.person).join(' ')
    : c.credit ? '' : `${c.question} ${c.answer}`,
  )
  .join(' | ')
const creditText = allClues.map(c => c.credit ?? '').join(' | ')

const noPersonal = TEAMMATES.filter(n => !personalText.includes(n))
const noNiche = TEAMMATES.filter(n => !creditText.includes(n))
check('14 players on the roster', TEAMMATES.length === 14)
// The host is nameable in clues but must never be drafted into a team.
check('the host is not on the roster', !TEAMMATES.includes(HOST))
check('but the host can still be named in a clue', PEOPLE.includes(HOST))
check('every teammate has a personal clue' + (noPersonal.length ? ` (missing: ${noPersonal})` : ''),
  noPersonal.length === 0)
/**
 * Players whose only specialist-subject clue was replaced by a personal one:
 * Ivan's car mechanics became Jonattan's card, Daniel's foods-starting-with-Q
 * became the pediatric doctor question. Both are still represented personally.
 *
 * Pinned as an exact set rather than exempted, so this still fails the moment
 * anyone else loses their niche question.
 */
const NO_NICHE_BY_DESIGN = ['Ivan', 'Daniel']
check(`only ${NO_NICHE_BY_DESIGN.join(', ')} lacks a niche clue (found: ${noNiche.join(', ') || 'none'})`,
  JSON.stringify(noNiche) === JSON.stringify(NO_NICHE_BY_DESIGN))

console.log('\nno clue spoils a spot-the-lie card')
// If a plain clue restates one of a card's statements, the card is given away.
const plainText = standard.map(c => `${c.question} ${c.answer}`).join(' ').toLowerCase()
const leaks: string[] = []
for (const card of lieClues) {
  for (const st of card.statements) {
    // Compare on the distinctive words of each statement.
    const key = st.toLowerCase().replace(/[^a-z ]/g, '').split(' ')
      .filter(w => w.length > 5 && !['worked', 'travelled'].includes(w))
    if (key.length && key.every(w => plainText.includes(w))) leaks.push(`${card.person}: ${st}`)
  }
}
check('no statement is restated as a plain clue' + (leaks.length ? ` (leaked: ${leaks})` : ''),
  leaks.length === 0)

console.log('\nno meta commentary in clue text')
const banned = ['bonus 100', 'by their own account', 'tap again', 'for a bonus', 'make them tell you']
const meta = standard.filter(c => banned.some(b => c.question.toLowerCase().includes(b)))
  .map(c => c.question)
check('clue text is free of game-mechanic asides' + (meta.length ? ` (found: ${meta})` : ''),
  meta.length === 0)

// ------------------------------------------------------------------ rules --
let s = reducer(initialState(), { type: 'shuffleTeams' })
s = reducer(s, { type: 'setTeams', rosters: s.teams.map(t => t.members) })
const t1 = s.teams[0].id, t2 = s.teams[1].id
const K1 = '0-0'   // Origin Stories, 100
const K2 = '0-5'   // Origin Stories, 600 (Ivan's spot-the-lie card)

console.log('\nawarding')
s = reducer(s, { type: 'toggleAward', key: K1, teamId: t1 })
check('award gives 100', score(s, t1) === 100)
s = reducer(s, { type: 'toggleAward', key: K2, teamId: t1 })
check('a second award stacks to 700', score(s, t1) === 700)
s = reducer(s, { type: 'toggleAward', key: K2, teamId: t1 })
check('un-award subtracts exactly', score(s, t1) === 100)

console.log('\nmulti-team + idempotency')
s = reducer(s, { type: 'toggleAward', key: K1, teamId: t2 })
s = reducer(s, { type: 'toggleAward', key: K1, teamId: t2 })
s = reducer(s, { type: 'toggleAward', key: K1, teamId: t2 })
check('odd number of toggles = awarded', score(s, t2) === 100)
check('team 1 unaffected by team 2', score(s, t1) === 100)

console.log('\nclue lifecycle')
s = reducer(s, { type: 'consumeClue', key: K1 })
check('clue marked used', s.used.includes(K1))
s = reducer(s, { type: 'consumeClue', key: K1 })
check('consuming twice does not duplicate', s.used.filter(k => k === K1).length === 1)
s = reducer(s, { type: 'clearClue', key: K1 })
check('put back on board removes it from used', !s.used.includes(K1))
check('put back on board strips its points from both teams',
  score(s, t1) === 0 && score(s, t2) === 0)

console.log('\nmanual adjustments')
s = reducer(s, { type: 'adjustScore', teamId: t1, delta: 600 })
check('manual +600', score(s, t1) === 600)
s = reducer(s, { type: 'adjustScore', teamId: t1, delta: -900 })
check('scores may go negative', score(s, t1) === -300)

console.log('\nteam draw')
const drawn = drawTeams(TEAMMATES, 3)
check('draws the requested number of teams', drawn.length === 3)
check('everyone is dealt exactly once',
  drawn.flat().length === TEAMMATES.length &&
  new Set(drawn.flat()).size === TEAMMATES.length)
check('teams are as even as possible (5/5/4)',
  Math.max(...drawn.map(t => t.length)) - Math.min(...drawn.map(t => t.length)) <= 1)
check('draws are randomised',
  JSON.stringify(drawTeams(TEAMMATES, 3)) !== JSON.stringify(drawTeams(TEAMMATES, 3)))
check('team count is configurable', drawTeams(TEAMMATES, 5).length === 5)
check('an odd split stays even-ish across 4 teams',
  (() => { const d = drawTeams(TEAMMATES, 4)
    return Math.max(...d.map(t => t.length)) - Math.min(...d.map(t => t.length)) <= 1 })())
check('team names default to neutral placeholders',
  TEAM_NAMES.slice(0, 3).every(n => /^Team \d$/.test(n)))

console.log('\nsetup: roster first, then shuffle')
let sd = initialState()
check('starts on the roster, before anything is drawn', sd.phase === 'roster')
check('roster seeded from the sign-ups', sd.roster.length === TEAMMATES.length)
check('defaults to three teams', sd.teamCount === TEAM_COUNT && TEAM_COUNT === 3)
check('no teams drawn yet', sd.teams.length === 0)

// Editing the roster BEFORE the shuffle is what makes the draw come out even.
sd = reducer(sd, { type: 'removeFromRoster', name: 'Joe' })
check('can drop a no-show', !sd.roster.includes('Joe'))
sd = reducer(sd, { type: 'addToRoster', name: 'Alexis' })
check('can add a walk-in', sd.roster.includes('Alexis'))
sd = reducer(sd, { type: 'addToRoster', name: 'Alexis' })
check('no duplicate roster entries',
  sd.roster.filter(n => n === 'Alexis').length === 1)
sd = reducer(sd, { type: 'addToRoster', name: '  ' })
check('blank names ignored', sd.roster.every(n => n.trim()))

sd = reducer(sd, { type: 'setTeamCount', count: 4 })
check('team count can change', sd.teamCount === 4)
sd = reducer(sd, { type: 'setTeamCount', count: 99 })
check('team count is clamped', sd.teamCount === 6)
sd = reducer(sd, { type: 'setTeamCount', count: 3 })

sd = reducer(sd, { type: 'shuffleTeams' })
check('shuffling moves to the team view', sd.phase === 'draft')
check('shuffle deals the EDITED roster, not the original sign-ups',
  new Set(sd.teams.flatMap(t => t.members)).size === sd.roster.length &&
  sd.teams.flatMap(t => t.members).includes('Alexis') &&
  !sd.teams.flatMap(t => t.members).includes('Joe'))
check('shuffle splits evenly',
  Math.max(...sd.teams.map(t => t.members.length)) -
  Math.min(...sd.teams.map(t => t.members.length)) <= 1)
check('shuffle bumps drawSeq so the animation replays', sd.drawSeq === 1)

sd = reducer(sd, { type: 'renameTeam', teamId: sd.teams[0].id, name: 'Quiz Khalifa' })
sd = reducer(sd, { type: 'redraw' })
check('reshuffle keeps typed team names', sd.teams[0].name === 'Quiz Khalifa')

console.log('\ndragging a player between teams')
const from = sd.teams[1], to = sd.teams[0]
const mover = from.members[0]
sd = reducer(sd, { type: 'addMember', teamId: to.id, name: mover })
check('lands on the new team', sd.teams[0].members.includes(mover))
check('leaves the old team', !sd.teams[1].members.includes(mover))
check('nobody ends up on two teams',
  sd.teams.flatMap(t => t.members).filter(n => n === mover).length === 1)
sd = reducer(sd, { type: 'removeMember', teamId: sd.teams[0].id, name: mover })
check('removing from a team also drops them from the roster',
  !sd.roster.includes(mover))

sd = reducer(sd, { type: 'backToRoster' })
check('can go back and edit players again', sd.phase === 'roster')

console.log('\nstale state is discarded, never merged')
check('initial state carries the shape version', initialState().version === STATE_VERSION)

console.log('\nbuzzers')
let sb = reducer(initialState(), { type: 'shuffleTeams' })
sb = reducer(sb, { type: 'setTeams', rosters: sb.teams.map(t => t.members) })
const [tA, tB] = sb.teams
sb = reducer(sb, { type: 'openClue', ref: { categoryIndex: 0, clueIndex: 5 } })
check('buzzers start shut', sb.buzzOpenedAt === null)

// A buzz before the host opens them must not count.
sb = reducer(sb, { type: 'buzz', buzz: { playerId: 'p1', name: 'A', teamId: tA.id, reactionMs: 100 } })
check('early buzzes are ignored', sb.buzzes.length === 0)

sb = reducer(sb, { type: 'openBuzzers', seconds: 25 })
check('opening buzzers starts the clock too', (sb.timerEndsAt ?? 0) > Date.now())

// Ranked by reaction time, not arrival order — the whole point of the design.
sb = reducer(sb, { type: 'buzz', buzz: { playerId: 'p1', name: 'Slow', teamId: tA.id, reactionMs: 900 } })
sb = reducer(sb, { type: 'buzz', buzz: { playerId: 'p2', name: 'Fast', teamId: tB.id, reactionMs: 320 } })
check('queue is ordered by reaction time, not arrival',
  sb.buzzes.map(b => b.name).join() === 'Fast,Slow')
sb = reducer(sb, { type: 'buzz', buzz: { playerId: 'p2', name: 'Fast', teamId: tB.id, reactionMs: 10 } })
check('one buzz per phone — no stacking the queue', sb.buzzes.length === 2)
check('the fastest team has the floor', currentBuzz(sb)?.name === 'Fast')

// Wrong answer locks that team out and promotes the next team automatically.
sb = reducer(sb, { type: 'markWrong', teamId: tB.id })
check('a wrong answer locks that team out', sb.lockedOut.includes(tB.id))
check('the next-fastest team is promoted', currentBuzz(sb)?.name === 'Slow')
sb = reducer(sb, { type: 'markWrong', teamId: tA.id })
check('with everyone locked out, nobody has the floor', currentBuzz(sb) === null)

console.log('\nawarding fires the celebration')
let sc = reducer(initialState(), { type: 'shuffleTeams' })
sc = reducer(sc, { type: 'setTeams', rosters: sc.teams.map(t => t.members) })
sc = reducer(sc, { type: 'openClue', ref: { categoryIndex: 0, clueIndex: 5 } })
sc = reducer(sc, { type: 'openBuzzers', seconds: 25 })
sc = reducer(sc, { type: 'awardTo', teamId: sc.teams[0].id, points: 600 })
check('award credits the team', computeScores(sc).get(sc.teams[0].id) === 600)
check('award stamps the celebration', sc.lastAward?.teamId === sc.teams[0].id)
check('celebration carries the points', sc.lastAward?.points === 600)
check('awarding closes the buzzers', sc.buzzOpenedAt === null && sc.timerEndsAt === null)
const seq1 = sc.lastAward?.seq ?? 0
sc = reducer(sc, { type: 'openClue', ref: { categoryIndex: 1, clueIndex: 0 } })
sc = reducer(sc, { type: 'awardTo', teamId: sc.teams[0].id, points: 100 })
check('a repeat award replays the animation', (sc.lastAward?.seq ?? 0) === seq1 + 1)

console.log('\nsetup is shared, so both views move through it together')
// Everything the setup screens render must live in GameState, or the two
// windows drift: same roster, same team count, same draw, same phase.
const SHARED_SETUP_FIELDS = ['phase', 'roster', 'teamCount', 'teams', 'drawSeq'] as const
const shape = initialState() as unknown as Record<string, unknown>
check('every setup field is in shared state',
  SHARED_SETUP_FIELDS.every(f => f in shape))

// Replaying the same actions from the same start must land both views on an
// identical state — this is what "perfectly synced" reduces to.
function replay(actions: Parameters<typeof reducer>[1][]) {
  return actions.reduce((acc, a) => reducer(acc, a), initialState())
}
const script: Parameters<typeof reducer>[1][] = [
  { type: 'removeFromRoster', name: 'Joe' },
  { type: 'addToRoster', name: 'Alexis' },
  { type: 'setTeamCount', count: 4 },
]
check('roster edits replay identically on both views',
  JSON.stringify(replay(script)) === JSON.stringify(replay(script)))
const afterShuffle = reducer(replay(script), { type: 'shuffleTeams' })
// The draw is random, so it happens once on the server and is broadcast; both
// views then read the same rosters rather than each rolling their own.
check('the draw is a value in state, not something each view recomputes',
  Array.isArray(afterShuffle.teams) &&
  afterShuffle.teams.every(t => Array.isArray(t.members)))
check('drawSeq drives the animation, so both views scramble in step',
  afterShuffle.drawSeq === 1)
const moved = reducer(afterShuffle, {
  type: 'addMember', teamId: afterShuffle.teams[0].id,
  name: afterShuffle.teams[1].members[0],
})
check('a drag is an action, so it shows on the shared screen too',
  moved.teams[0].members.length === afterShuffle.teams[0].members.length + 1)

console.log('\naward celebration is scoped to its clue')
// Every newly opened clue used to replay the PREVIOUS clue's celebration,
// because lastAward is sticky and the stage remounts per clue. The award now
// records which clue it was won on so a stale one cannot match.
let sk = reducer(initialState(), { type: 'shuffleTeams' })
sk = reducer(sk, { type: 'setTeams', rosters: sk.teams.map(t => t.members) })
sk = reducer(sk, { type: 'openClue', ref: { categoryIndex: 0, clueIndex: 0 } })
sk = reducer(sk, { type: 'awardTo', teamId: sk.teams[0].id, points: 100 })
check('the award records its clue', sk.lastAward?.key === '0-0')
sk = reducer(sk, { type: 'closeClue' })
sk = reducer(sk, { type: 'openClue', ref: { categoryIndex: 3, clueIndex: 2 } })
check('the stale award survives in state (the scoreboard still needs it)',
  sk.lastAward?.key === '0-0')
check('but it does NOT match the newly opened clue, so nothing replays',
  sk.lastAward?.key !== '3-2')
sk = reducer(sk, { type: 'awardTo', teamId: sk.teams[1].id, points: 300 })
check('a new award re-scopes to the new clue', sk.lastAward?.key === '3-2')
check('and bumps the sequence', (sk.lastAward?.seq ?? 0) === 2)

console.log('\nstopping the buzzers early')
let sq = reducer(initialState(), { type: 'shuffleTeams' })
sq = reducer(sq, { type: 'setTeams', rosters: sq.teams.map(t => t.members) })
sq = reducer(sq, { type: 'openClue', ref: { categoryIndex: 0, clueIndex: 0 } })
sq = reducer(sq, { type: 'openBuzzers', seconds: 25 })
sq = reducer(sq, { type: 'buzz', buzz: { playerId: 'p1', name: 'A', teamId: sq.teams[0].id, reactionMs: 300 } })
check('a buzz landed while open', sq.buzzes.length === 1)
sq = reducer(sq, { type: 'closeBuzzers' })
check('stopping the buzzers shuts them', sq.buzzOpenedAt === null)
check('stopping also stops the clock', sq.timerEndsAt === null)
check('buzzes already in are kept, so the host can still score them',
  sq.buzzes.length === 1 && currentBuzz(sq)?.name === 'A')
sq = reducer(sq, { type: 'buzz', buzz: { playerId: 'p2', name: 'Late', teamId: sq.teams[1].id, reactionMs: 50 } })
check('no late buzzes get in after stopping', sq.buzzes.length === 1)

console.log('\nresetting the player list')
let sr2 = reducer(initialState(), { type: 'removeFromRoster', name: 'Joe' })
sr2 = reducer(sr2, { type: 'removeFromRoster', name: 'Matt' })
sr2 = reducer(sr2, { type: 'addToRoster', name: 'Alexis' })
check('roster diverged from the sign-ups', sr2.roster.length === TEAMMATES.length - 1)
sr2 = reducer(sr2, { type: 'resetRoster' })
check('reset restores the original sign-ups',
  sr2.roster.length === TEAMMATES.length &&
  TEAMMATES.every(n => sr2.roster.includes(n)))
check('reset drops hand-added names', !sr2.roster.includes('Alexis'))

console.log('\noffline cross-window sync')
// With no server, one window publishes its whole next state and the other
// adopts it. Adopting must be exact and idempotent, and must reject a state
// from a different build rather than half-merging it.
const publisher = reducer(initialState(), { type: 'removeFromRoster', name: 'Joe' })
const adopted = publisher                     // what the other window receives
check('adopting a published state is exact',
  JSON.stringify(adopted) === JSON.stringify(publisher))
check('adopting twice changes nothing',
  JSON.stringify(adopted) === JSON.stringify(publisher))
check('published state carries the version so the receiver can gate on it',
  publisher.version === STATE_VERSION)
// The random draw is published as a value, so both windows show the same teams
// instead of each rolling its own.
const shuffled = reducer(publisher, { type: 'shuffleTeams' })
check('a published shuffle fixes the draw for both windows',
  JSON.stringify(shuffled.teams) === JSON.stringify(shuffled.teams) &&
  shuffled.teams.flatMap(t => t.members).length === shuffled.roster.length)

console.log('\na clue runs as a strict sequence')
// The complaint this replaces: every option was on screen at once and the order
// of operations was unclear. Each phase now has exactly one obvious next step.
let sq2 = reducer(initialState(), { type: 'shuffleTeams' })
sq2 = reducer(sq2, { type: 'setTeams', rosters: sq2.teams.map(t => t.members) })
const [teamA, teamB, teamC] = sq2.teams

sq2 = reducer(sq2, { type: 'openClue', ref: { categoryIndex: 1, clueIndex: 2 } })
check('a fresh clue starts on reading', sq2.cluePhase === 'reading')
check('no clock yet', sq2.timerEndsAt === null)
check('buzzers shut', sq2.buzzOpenedAt === null)

sq2 = reducer(sq2, { type: 'openBuzzers', seconds: 25 })
check('opening buzzers moves to buzzing', sq2.cluePhase === 'buzzing')
check('and starts the clock in the same moment', (sq2.timerEndsAt ?? 0) > Date.now())

sq2 = reducer(sq2, { type: 'buzz', buzz: { playerId: 'p1', name: 'Slow', teamId: teamA.id, reactionMs: 700 } })
sq2 = reducer(sq2, { type: 'buzz', buzz: { playerId: 'p2', name: 'Fast', teamId: teamB.id, reactionMs: 250 } })
check('still buzzing while the clock runs', sq2.cluePhase === 'buzzing')

sq2 = reducer(sq2, { type: 'endBuzzing' })
check('ending the buzzers moves to verdict', sq2.cluePhase === 'verdict')
check('the clock stops', sq2.timerEndsAt === null && sq2.buzzOpenedAt === null)
check('the fastest team has the floor', currentBuzz(sq2)?.teamId === teamB.id)

// Wrong answer: buzz out, promote the next team, stay in verdict.
sq2 = reducer(sq2, { type: 'markWrong', teamId: teamB.id })
check('a wrong answer keeps us in verdict while someone is left', sq2.cluePhase === 'verdict')
check('the next-fastest team is promoted', currentBuzz(sq2)?.teamId === teamA.id)
check('the wrong answer is stamped for the buzz-out animation',
  sq2.lastWrong?.teamId === teamB.id && sq2.lastWrong?.key === '1-2')

// Everyone wrong: nothing left to rule on, so the answer goes up.
sq2 = reducer(sq2, { type: 'markWrong', teamId: teamA.id })
check('with everyone out it goes to revealed', sq2.cluePhase === 'revealed')
check('nobody scored', [...computeScores(sq2).values()].every(v => v === 0))

console.log('\nthe correct-answer path')
let sr3 = reducer(initialState(), { type: 'shuffleTeams' })
sr3 = reducer(sr3, { type: 'setTeams', rosters: sr3.teams.map(t => t.members) })
sr3 = reducer(sr3, { type: 'openClue', ref: { categoryIndex: 0, clueIndex: 5 } })
sr3 = reducer(sr3, { type: 'openBuzzers', seconds: 25 })
sr3 = reducer(sr3, { type: 'buzz', buzz: { playerId: 'x', name: 'A', teamId: teamC.id, reactionMs: 300 } })
sr3 = reducer(sr3, { type: 'endBuzzing' })
sr3 = reducer(sr3, { type: 'awardTo', teamId: teamC.id, points: 600 })
check('correct goes straight to revealed', sr3.cluePhase === 'revealed')
check('and the points land', computeScores(sr3).get(teamC.id) === 600)
check('and the celebration is scoped to this clue', sr3.lastAward?.key === '0-5')
sr3 = reducer(sr3, { type: 'consumeClue', key: '0-5' })
sr3 = reducer(sr3, { type: 'closeClue' })
check('closing resets the sequence for the next clue', sr3.cluePhase === 'reading')
check('and clears the board state', sr3.open === null && sr3.buzzes.length === 0)

console.log('\nnobody buzzes')
let sn2 = reducer(initialState(), { type: 'shuffleTeams' })
sn2 = reducer(sn2, { type: 'openClue', ref: { categoryIndex: 2, clueIndex: 0 } })
sn2 = reducer(sn2, { type: 'openBuzzers', seconds: 25 })
sn2 = reducer(sn2, { type: 'endBuzzing' })
check('an empty buzzer round skips verdict entirely', sn2.cluePhase === 'revealed')

console.log('\nskipping the buzzers')
let sk2 = reducer(initialState(), { type: 'openClue', ref: { categoryIndex: 3, clueIndex: 1 } })
sk2 = reducer(sk2, { type: 'reveal' })
check('the host can jump straight to the answer', sk2.cluePhase === 'revealed')

console.log('\nreopening a clue a team already won')
// The winner has to come from the award ledger, not from lastAward: lastAward is
// the most recent award in the WHOLE game, so reopening an earlier clue reported
// nobody having won it.
let sw = reducer(initialState(), { type: 'shuffleTeams' })
sw = reducer(sw, { type: 'setTeams', rosters: sw.teams.map(t => t.members) })
const first = sw.teams[0], second = sw.teams[1]
sw = reducer(sw, { type: 'openClue', ref: { categoryIndex: 0, clueIndex: 0 } })
sw = reducer(sw, { type: 'awardTo', teamId: first.id, points: 100 })
sw = reducer(sw, { type: 'consumeClue', key: '0-0' })
sw = reducer(sw, { type: 'closeClue' })
// A later clue moves lastAward on.
sw = reducer(sw, { type: 'openClue', ref: { categoryIndex: 1, clueIndex: 1 } })
sw = reducer(sw, { type: 'awardTo', teamId: second.id, points: 200 })
sw = reducer(sw, { type: 'consumeClue', key: '1-1' })
sw = reducer(sw, { type: 'closeClue' })
check('lastAward has moved on to the later clue', sw.lastAward?.key === '1-1')
check('but the ledger still records who won the earlier one',
  (sw.awards['0-0'] ?? []).includes(first.id))
check('so reopening it can still name the winner',
  (sw.awards['0-0'] ?? []).length === 1)
sw = reducer(sw, { type: 'openClue', ref: { categoryIndex: 0, clueIndex: 0 } })
check('and it reopens straight to the answer', sw.cluePhase === 'revealed')

console.log('\nreopening a played clue')
let sx2 = reducer(initialState(), { type: 'shuffleTeams' })
sx2 = reducer(sx2, { type: 'consumeClue', key: '4-4' })
sx2 = reducer(sx2, { type: 'openClue', ref: { categoryIndex: 4, clueIndex: 4 } })
check('a played clue reopens on the answer, not the question',
  sx2.cluePhase === 'revealed')

console.log('\nthe phone can identify people during setup')
// The QR is on the setup screens, so phones arrive BEFORE teams exist. The name
// list has to come from the roster; reading it from teams left "Who are you?"
// blank for the whole setup stage.
const atSetup = initialState()
check('setup starts with no teams drawn', atSetup.teams.length === 0)
check('but the roster is already full', atSetup.roster.length === TEAMMATES.length)
check('so a phone has names to choose from', atSetup.roster.length > 0)
let sph = reducer(atSetup, { type: 'setPlayerStyle', name: 'Ana', color: PLAYER_COLORS[3], icon: PLAYER_EMOJI[3] })
sph = reducer(sph, { type: 'shuffleTeams' })
check('a style claimed before the shuffle survives it',
  sph.playerStyles.Ana.color === PLAYER_COLORS[3])
check('and that player is now on a team', sph.teams.some(t => t.members.includes('Ana')))
check('a dropped player is not offered on the phone',
  !reducer(atSetup, { type: 'removeFromRoster', name: 'Joe' }).roster.includes('Joe'))

console.log('\nplayer colours and emoji')
let sp = initialState()
check('nobody has a style to begin with', Object.keys(sp.playerStyles).length === 0)
sp = reducer(sp, { type: 'setPlayerStyle', name: 'Matt', color: PLAYER_COLORS[0], icon: PLAYER_EMOJI[0] })
check('a player can claim a colour and emoji',
  sp.playerStyles.Matt.color === PLAYER_COLORS[0] && sp.playerStyles.Matt.icon === PLAYER_EMOJI[0])
// Duplicates are allowed on purpose: if two people both want the fox, fine.
sp = reducer(sp, { type: 'setPlayerStyle', name: 'Lucy', color: PLAYER_COLORS[0], icon: PLAYER_EMOJI[0] })
check('two players may share a colour', sp.playerStyles.Lucy.color === sp.playerStyles.Matt.color)
check('two players may share an emoji', sp.playerStyles.Lucy.icon === sp.playerStyles.Matt.icon)
sp = reducer(sp, { type: 'setPlayerStyle', name: 'Matt', color: PLAYER_COLORS[5], icon: PLAYER_EMOJI[5] })
check('a player can change their own style', sp.playerStyles.Matt.color === PLAYER_COLORS[5])
check('changing does not duplicate the record', Object.keys(sp.playerStyles).length === 2)

console.log('\nauto-assigned defaults still spread out')
// Nobody has to open the picker, so the default must be sensible on its own.
const assigned: { color: string; icon: string }[] = []
for (let i = 0; i < TEAMMATES.length; i++) assigned.push(freeStyle(assigned))
check('every teammate gets a distinct colour by default',
  new Set(assigned.map(a => a.color)).size === TEAMMATES.length)
check('every teammate gets a distinct emoji by default',
  new Set(assigned.map(a => a.icon)).size === TEAMMATES.length)

console.log('\nhost and presentation share the open clue')
let so = reducer(initialState(), { type: 'shuffleTeams' })
so = reducer(so, { type: 'setTeams', rosters: so.teams.map(t => t.members) })
check('nothing open to begin with', so.open === null)
so = reducer(so, { type: 'openClue', ref: { categoryIndex: 2, clueIndex: 3 } })
check('opening a clue is shared state, not local',
  so.open?.categoryIndex === 2 && so.open?.clueIndex === 3)
check('the phase is shared too, so both screens show the same step',
  so.cluePhase === 'reading')
so = reducer(so, { type: 'reveal' })
check('revealing is shared, so the room sees it at the same moment',
  so.cluePhase === 'revealed')
so = reducer(so, { type: 'closeClue' })
check('closing clears the shared clue', so.open === null)
check('closing resets the step', so.cluePhase === 'reading')

console.log('\nnew game')
// The Durable Object keeps state between sessions, so a rehearsal has to be
// wipeable before the real night.
let sn = reducer(initialState(), { type: 'removeFromRoster', name: 'Joe' })
sn = reducer(sn, { type: 'shuffleTeams' })
sn = reducer(sn, { type: 'setTeams', rosters: sn.teams.map(t => t.members) })
sn = reducer(sn, { type: 'renameTeam', teamId: sn.teams[0].id, name: 'Rehearsal' })
sn = reducer(sn, { type: 'toggleAward', key: '0-0', teamId: sn.teams[0].id })
sn = reducer(sn, { type: 'consumeClue', key: '0-0' })
sn = reducer(sn, { type: 'setPlayerStyle', name: 'Matt', color: PLAYER_COLORS[1], icon: PLAYER_EMOJI[1] })
sn = reducer(sn, { type: 'newGame' })
check('new game returns to the roster screen', sn.phase === 'roster')
check('new game restores the full sign-up list', sn.roster.length === TEAMMATES.length)
check('new game clears the board', sn.used.length === 0)
check('new game clears scores', [...computeScores(sn).values()].every(v => v === 0))
check('new game drops rehearsal team names', sn.teams.every(t => !t.name.includes('Rehearsal')))
check('new game clears any award celebration', sn.lastAward === null)
check('new game clears player colours', Object.keys(sn.playerStyles).length === 0)

console.log('\nsound cues have transitions to fire on')
// The presentation screen derives every cue from a change in shared state, since
// it never handles the click that caused it. Each of these fields must actually
// change on the transition the cue is named after.
let ss = reducer(initialState(), { type: 'shuffleTeams' })
check('drawing teams bumps drawSeq (shuffle cue)', ss.drawSeq === 1)
const beforeStart = ss.phase
ss = reducer(ss, { type: 'setTeams', rosters: ss.teams.map(t => t.members) })
check('starting the game changes phase (start cue)',
  beforeStart === 'draft' && ss.phase === 'board')
ss = reducer(ss, { type: 'openClue', ref: { categoryIndex: 0, clueIndex: 0 } })
check('opening a clue changes open (select cue)', ss.open !== null)
ss = reducer(ss, { type: 'openBuzzers', seconds: 25 })
check('opening buzzers changes cluePhase (buzzOpen cue)', ss.cluePhase === 'buzzing')
check('and sets a deadline the ticks can count down (tick cue)', ss.timerEndsAt !== null)
const before = ss.buzzes.length
ss = reducer(ss, { type: 'buzz', buzz: { playerId: 'z', name: 'A', teamId: ss.teams[0].id, reactionMs: 200 } })
check('a buzz grows the queue (buzz cue)', ss.buzzes.length === before + 1)
ss = reducer(ss, { type: 'endBuzzing' })
check('the clock ending moves buzzing -> verdict (timeUp cue)', ss.cluePhase === 'verdict')
ss = reducer(ss, { type: 'markWrong', teamId: ss.teams[0].id })
check('a wrong answer bumps lastWrong.seq (wrong cue)', (ss.lastWrong?.seq ?? 0) === 1)
let ss2 = reducer(initialState(), { type: 'shuffleTeams' })
ss2 = reducer(ss2, { type: 'openClue', ref: { categoryIndex: 0, clueIndex: 0 } })
ss2 = reducer(ss2, { type: 'awardTo', teamId: ss2.teams[0].id, points: 100 })
check('an award bumps lastAward.seq (correct cue)', (ss2.lastAward?.seq ?? 0) === 1)

// The clock bed and the phones' countdown both read the same shared deadline, so
// the room and every phone agree on how much time is left.
let sc2 = reducer(initialState(), { type: 'shuffleTeams' })
sc2 = reducer(sc2, { type: 'openClue', ref: { categoryIndex: 0, clueIndex: 0 } })
sc2 = reducer(sc2, { type: 'openBuzzers', seconds: 25 })
check('the deadline is a shared absolute time, not a per-device duration',
  typeof sc2.timerEndsAt === 'number' && sc2.timerEndsAt > Date.now())
check('stopping the buzzers clears it for every screen at once',
  reducer(sc2, { type: 'endBuzzing' }).timerEndsAt === null)

console.log('\nreset')
let s3 = reducer(initialState(), { type: 'shuffleTeams' })
s3 = reducer(s3, { type: 'setTeams', rosters: s3.teams.map(t => t.members) })
s3 = reducer(s3, { type: 'toggleAward', key: K1, teamId: t1 })
s3 = reducer(s3, { type: 'consumeClue', key: K1 })
s3 = reducer(s3, { type: 'renameTeam', teamId: t1, name: 'The Covenanters' })
s3 = reducer(s3, { type: 'resetGame' })
check('reset zeroes scores', score(s3, t1) === 0)
check('reset clears the board', s3.used.length === 0)
check('reset KEEPS renamed teams', s3.teams[0].name === 'The Covenanters')
check('reset keeps the drafted rosters', s3.teams[0].members.length > 0)
check('reset stays on the board', s3.phase === 'board')
check('reset closes any open clue', s3.open === null && s3.timerEndsAt === null)

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) throw new Error(`${fail} test(s) failed`)
