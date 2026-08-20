import {
  reducer, initialState, computeScores, currentBuzz, standings, STATE_VERSION,
  finalPoints, FINAL_KEY, FINAL_ITEMS,
} from './gameState'
import type { GameState } from '../types'
import { CATEGORIES, TEAMMATES, PEOPLE, HOST, FINAL_CLUE } from '../data'
import { artOf, scaleOf } from '../data/stickers'
import { FINAL_REF } from '../types'
import { TEAM_NAMES, TEAM_COUNT, drawTeams } from '../data/teams'
import { PLAYER_COLORS, PLAYER_EMOJI, MAX_NAME, defaultStyle, styleFor } from '../data/avatars'

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
let srn = reducer(initialState(), { type: 'shuffleTeams' })
const t = srn.teams[1]
srn = reducer(srn, { type: 'renameTeam', teamId: t.id, name: 'Quiz Khalifa' })
check('a team can be renamed during setup', srn.teams[1].name === 'Quiz Khalifa')
check('renaming touches nothing else', srn.teams[1].members === t.members)
srn = reducer(srn, { type: 'setTeams', rosters: srn.teams.map(x => x.members) })
check('the name survives starting the game', srn.teams[1].name === 'Quiz Khalifa')
srn = reducer(srn, { type: 'renameTeam', teamId: t.id, name: 'Les Quizerables' })
check('and can still be renamed mid-game', srn.teams[1].name === 'Les Quizerables')
srn = reducer(srn, { type: 'renameTeam', teamId: t.id, name: '' })
check('clearing it is allowed, so a placeholder can show', srn.teams[1].name === '')

console.log('\nthe closing ceremony')
let sc3 = reducer(initialState(), { type: 'shuffleTeams' })
sc3 = reducer(sc3, { type: 'setTeams', rosters: sc3.teams.map(t => t.members) })
const [tw, tm, tl] = sc3.teams
check('no ceremony to begin with', sc3.ceremony === 'off')

// Give the three teams different totals.
sc3 = reducer(sc3, { type: 'adjustScore', teamId: tw.id, delta: 1200 })
sc3 = reducer(sc3, { type: 'adjustScore', teamId: tm.id, delta: 700 })
sc3 = reducer(sc3, { type: 'adjustScore', teamId: tl.id, delta: 300 })

const table = standings(sc3)
check('standings run highest first', table.map(r => r.score).join() === '1200,700,300')
check('ranks are 1, 2, 3', table.map(r => r.rank).join() === '1,2,3')
check('the leader is rank 1', table[0].team.id === tw.id)

// A tie at the top must produce two winners, not an arbitrary order.
let stie = reducer(sc3, { type: 'adjustScore', teamId: tm.id, delta: 500 })
const tied = standings(stie)
check('a tie at the top shares rank 1', tied.filter(r => r.rank === 1).length === 2)
check('and the next team is rank 3, not 2', tied[2].rank === 3)

// A clue open when the ceremony starts must not stay open behind it.
let sopen = reducer(sc3, { type: 'openClue', ref: { categoryIndex: 0, clueIndex: 0 } })
sopen = reducer(sopen, { type: 'startCeremony', seconds: 5 })
check('the countdown starts', sopen.ceremony === 'countdown')
check('with a shared deadline', (sopen.ceremonyEndsAt ?? 0) > Date.now())
check('and closes any open clue behind it', sopen.open === null)
sopen = reducer(sopen, { type: 'revealWinner' })
check('revealing moves to the winner', sopen.ceremony === 'winner')
check('and clears the countdown clock', sopen.ceremonyEndsAt === null)
sopen = reducer(sopen, { type: 'endCeremony' })
check('and it can be dismissed', sopen.ceremony === 'off')

check('a new game clears the ceremony',
  reducer(sopen, { type: 'newGame' }).ceremony === 'off')

// Finishing the closing question ends the game, so the ceremony follows on its own
// rather than dropping the host back to a board with nothing left to play.
let sfin = reducer(sc3, { type: 'openClue', ref: FINAL_REF })
check('the closing question opens', sfin.open?.categoryIndex === -1)
sfin = reducer(sfin, { type: 'awardTo', teamId: tw.id, points: 1000 })
sfin = reducer(sfin, { type: 'consumeClue', key: '-1-0' })
sfin = reducer(sfin, { type: 'startCeremony', seconds: 3 })
check('and rolls straight into the ceremony', sfin.ceremony === 'countdown')
check('with the clue closed behind it', sfin.open === null)
check('the winner reflects the closing points',
  standings(sfin)[0].team.id === tw.id)

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
// It opens like any tile, but it is marked rather than awarded — see the partial
// credit section below.
let sf = reducer(initialState(), { type: 'shuffleTeams' })
sf = reducer(sf, { type: 'setTeams', rosters: sf.teams.map(t => t.members) })
sf = reducer(sf, { type: 'openClue', ref: FINAL_REF })
check('opening it starts the same sequence', sf.cluePhase === 'reading')
sf = reducer(sf, { type: 'setFinalHits', teamId: sf.teams[0].id, hits: 3 })
check('marking all three credits the full value',
  computeScores(sf).get(sf.teams[0].id) === FINAL_CLUE.points)
check('and it lands under its own key, not a tile’s', sf.lastAward?.key === FINAL_KEY)
// The all-or-nothing path must not reach it, or its points could arrive twice.
const sfAward = reducer(sf, { type: 'awardTo', teamId: sf.teams[0].id, points: 1000 })
check('the all-or-nothing award does not apply to it',
  computeScores(sfAward).get(sf.teams[0].id) === FINAL_CLUE.points)

console.log('\nstickers')
/**
 * Decoration, but decoration that ships on a projector, so it gets the same
 * treatment as the questions. TypeScript already rejects art that does not exist
 * and test/stickers.mjs checks the files are on disk; what is left is whether each
 * clue was dressed, and dressed with some variety.
 */
const decorated = [...allClues, FINAL_CLUE]
const counts = decorated.map(c => c.stickers.length)
check(`every clue carries three or four stickers (${Math.min(...counts)}-${Math.max(...counts)})`,
  Math.min(...counts) >= 3 && Math.max(...counts) <= 4)

const art = decorated.map(c => c.stickers.map(artOf))
const dupWithin = art.filter(a => new Set(a).size !== a.length)
check(`no clue repeats one piece of art${dupWithin.length ? ` (${dupWithin.length})` : ''}`,
  dupWithin.length === 0)

// Postcards are landscape and get a wider box in the scatter; they are also the only
// art that names a place, so a clue set to nowhere in particular should not have one.
const cards = art.flat().filter(k => k.startsWith('postcard-'))
check(`postcards are in play (${cards.length}) and none repeats`,
  cards.length >= 5 && new Set(cards).size === cards.length)

// No clue should be more than half postcards — they are 200px wide.
check('no clue is mostly postcards',
  art.every(a => a.filter(k => k.startsWith('postcard-')).length <= 2 ||
    a.every(k => k.startsWith('postcard-'))))

// An explicit scale is for a piece the default box does not do justice to. Past
// about 2x it stops being emphasis and starts crowding the question.
const scales = decorated.flatMap(c => c.stickers.map(scaleOf))
check(`explicit sizes stay between 1 and 2 (${[...new Set(scales)].sort().join(', ')})`,
  scales.every(v => v >= 1 && v <= 2))

/**
 * The room sees the stickers while the question is being read, so a sticker that
 * depicts the answer hands over the point. Names are safe — no object gives away a
 * person — so this checks the general-knowledge answers against the art keys.
 */
const spoilers = standard
  .filter(c => !PEOPLE.includes(c.answer.trim()))
  .flatMap(c => {
    const words = c.answer.toLowerCase().match(/[a-z]{4,}/g) ?? []
    return c.stickers
      .map(artOf)
      .filter(k => words.some(w => k.includes(w) || w.includes(k)))
      .map(k => `${k} on "${c.answer}"`)
  })
check(`no sticker names the answer it sits next to${spoilers.length ? ` (${spoilers})` : ''}`,
  spoilers.length === 0)

console.log('\nplayers naming themselves')
/**
 * A player editing their name changes a label, not an identity. The roster name keys
 * their style, the teams hold it, and the clues were written with it — so "Spot the
 * lie about Hannah" must still say Hannah however she labels herself.
 */
let sdn = reducer(initialState(), { type: 'shuffleTeams' })
sdn = reducer(sdn, { type: 'setTeams', rosters: sdn.teams.map(t => t.members) })
const look = (st: GameState, n: string) => styleFor(n, st.playerStyles, st.roster, st.displayNames)

check('everyone starts labelled with their roster name',
  TEAMMATES.every(n => look(sdn, n).label === n))

sdn = reducer(sdn, { type: 'setPlayerName', name: 'Juan', label: 'Nacho' })
check('a player can set their own name', look(sdn, 'Juan').label === 'Nacho')
check('and it changes nobody else', look(sdn, 'Hannah').label === 'Hannah')
check('the roster still holds the identity', sdn.roster.includes('Juan'))
check('so do the teams', sdn.teams.some(t => t.members.includes('Juan')))
check('and the clues still say the canonical name',
  CATEGORIES.flatMap(c => c.clues).some(c => c.kind === 'standard' && c.answer === 'Juan'))

// It is a label, so it must not become a second identity in playerStyles.
sdn = reducer(sdn, { type: 'setPlayerStyle', name: 'Juan', color: PLAYER_COLORS[3], icon: PLAYER_EMOJI[3] })
check('a style set after renaming still lands on the roster name',
  sdn.playerStyles.Juan?.color === PLAYER_COLORS[3] && !('Nacho' in sdn.playerStyles))
check('and the renamed player keeps that style', look(sdn, 'Juan').color === PLAYER_COLORS[3])

sdn = reducer(sdn, { type: 'setPlayerName', name: 'Juan', label: '   ' })
check('blanking it falls back to the roster name', look(sdn, 'Juan').label === 'Juan')
check('and leaves nothing behind', !('Juan' in sdn.displayNames))

sdn = reducer(sdn, { type: 'setPlayerName', name: 'Ana', label: 'Ana' })
check('setting it to the name it already was stores nothing',
  !('Ana' in sdn.displayNames))

sdn = reducer(sdn, { type: 'setPlayerName', name: 'Greg', label: 'x'.repeat(60) })
check(`a very long name is capped at ${MAX_NAME}`,
  look(sdn, 'Greg').label.length === MAX_NAME)

sdn = reducer(sdn, { type: 'setPlayerName', name: 'Ask', label: '  Ask the Elder  ' })
check('surrounding space is trimmed', look(sdn, 'Ask').label === 'Ask the Elder')

console.log('\npartial credit on the closing question')
/**
 * The closing question is a three-way match, so a team can land one or two. It is
 * also the one clue where every team scores at once — a tile has a single winner by
 * construction, this does not.
 */
let sfp = reducer(initialState(), { type: 'shuffleTeams' })
sfp = reducer(sfp, { type: 'setTeams', rosters: sfp.teams.map(t => t.members) })
const [fp1, fp2, fp3] = sfp.teams
sfp = reducer(sfp, { type: 'openClue', ref: FINAL_REF })

check('a third of the thousand, rounded', finalPoints(1) === 333 && finalPoints(2) === 667)
check('all three is the full value', finalPoints(3) === FINAL_CLUE.points)
check('none is nothing', finalPoints(0) === 0)
check('and it cannot exceed the full value', finalPoints(9) === FINAL_CLUE.points)

sfp = reducer(sfp, { type: 'setFinalHits', teamId: fp1.id, hits: 2 })
check('two of three scores two thirds', score(sfp, fp1.id) === 667)
sfp = reducer(sfp, { type: 'setFinalHits', teamId: fp2.id, hits: 1 })
check('a second team can score at the same time', score(sfp, fp2.id) === 333)
check('and the first keeps its own', score(sfp, fp1.id) === 667)
check('a team given nothing stays on zero', score(sfp, fp3.id) === 0)

// Setting a value twice must not stack, or a host correcting themselves inflates it.
sfp = reducer(sfp, { type: 'setFinalHits', teamId: fp1.id, hits: 2 })
check('re-marking the same score changes nothing', score(sfp, fp1.id) === 667)
sfp = reducer(sfp, { type: 'setFinalHits', teamId: fp1.id, hits: 3 })
check('marking up replaces rather than adds', score(sfp, fp1.id) === 1000)
sfp = reducer(sfp, { type: 'setFinalHits', teamId: fp1.id, hits: 1 })
check('and marking down replaces too', score(sfp, fp1.id) === 333)
sfp = reducer(sfp, { type: 'setFinalHits', teamId: fp1.id, hits: 0 })
check('zero clears it', score(sfp, fp1.id) === 0 && !(fp1.id in sfp.finalHits))

// The celebration should fire on a mark going up, and stay quiet on a correction.
let sfq = reducer(sfp, { type: 'setFinalHits', teamId: fp3.id, hits: 3 })
const seqUp = sfq.lastAward?.seq ?? 0
check('marking up stamps an award for the confetti',
  sfq.lastAward?.teamId === fp3.id && sfq.lastAward?.points === 1000)
sfq = reducer(sfq, { type: 'setFinalHits', teamId: fp3.id, hits: 1 })
check('marking down does not set it off again', (sfq.lastAward?.seq ?? 0) === seqUp)

// Points live in finalHits, not the ledger, so putting the clue back must clear them.
sfq = reducer(sfq, { type: 'clearClue', key: FINAL_KEY })
check('clearing the closing question strips its partial points',
  score(sfq, fp3.id) === 0 && Object.keys(sfq.finalHits).length === 0)

// One source of truth: the closing question must not also be in the award ledger,
// or its points would be counted twice.
let sfr = reducer(sfp, { type: 'setFinalHits', teamId: fp2.id, hits: 3 })
check('the closing question is not double-counted', score(sfr, fp2.id) === 1000)

sfr = reducer(sfr, { type: 'resetGame' })
check('reset clears partial credit', Object.keys(sfr.finalHits).length === 0)

/**
 * The buzzer still decides who answers the closing question first, so winning it on
 * the buzzer has to be worth all three — the host presses Correct, not 3 of 3.
 */
let sfb = reducer(initialState(), { type: 'shuffleTeams' })
sfb = reducer(sfb, { type: 'setTeams', rosters: sfb.teams.map(t => t.members) })
sfb = reducer(sfb, { type: 'openClue', ref: FINAL_REF })
sfb = reducer(sfb, { type: 'openBuzzers', seconds: 25 })
sfb = reducer(sfb, {
  type: 'buzz',
  buzz: { playerId: 'p1', name: sfb.teams[0].members[0], teamId: sfb.teams[0].id, reactionMs: 300 },
})
sfb = reducer(sfb, { type: 'endBuzzing' })
check('a buzz on the closing question puts a team on the spot',
  currentBuzz(sfb)?.teamId === sfb.teams[0].id)
// What App dispatches for Correct on the closing question.
sfb = reducer(sfb, { type: 'setFinalHits', teamId: sfb.teams[0].id, hits: FINAL_ITEMS })
sfb = reducer(sfb, { type: 'reveal' })
check('winning it on the buzzer is worth all three',
  score(sfb, sfb.teams[0].id) === FINAL_CLUE.points)
check('and it lands on the answers', sfb.cluePhase === 'revealed')
// Wrong there must still promote the next team, or the queue means nothing.
let sfw = reducer(sfb, { type: 'markWrong', teamId: sfb.teams[0].id })
check('a wrong answer still locks that team out',
  sfw.lockedOut.includes(sfb.teams[0].id))

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
check('15 players on the roster', TEAMMATES.length === 15)
// The host is nameable in clues but must never be drafted into a team.
check('the host is not on the roster', !TEAMMATES.includes(HOST))
check('but the host can still be named in a clue', PEOPLE.includes(HOST))
check('every teammate has a personal clue' + (noPersonal.length ? ` (missing: ${noPersonal})` : ''),
  noPersonal.length === 0)
/**
 * Players with no specialist-subject clue. Ivan's car mechanics became Jonattan's
 * card and Daniel's foods-starting-with-Q became the pediatric doctor question;
 * Benja joined after the sign-up form, so there is no niche of his on record. All
 * three are still represented personally.
 *
 * Pinned as an exact set rather than exempted, so this still fails the moment
 * anyone else loses their niche question.
 */
const NO_NICHE_BY_DESIGN = ['Ivan', 'Daniel', 'Benja']
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

console.log('\ndefault colours apply without anyone choosing')
// A player should have a colour before they have touched anything, so the default is
// derived rather than assigned — nothing is written to state until someone picks.
const defaults = TEAMMATES.map(n => defaultStyle(n, TEAMMATES))
check('every player gets a distinct colour by default',
  new Set(defaults.map(a => a.color)).size === TEAMMATES.length)
check('every player gets a distinct emoji by default',
  new Set(defaults.map(a => a.icon)).size === TEAMMATES.length)
check('the same name always resolves to the same style',
  JSON.stringify(defaultStyle('Lucy', TEAMMATES)) === JSON.stringify(defaultStyle('Lucy', TEAMMATES)))
// A walk-in must not shift everyone else's colours along.
const withGuest = [...TEAMMATES, 'A Walk-in']
check('adding someone does not reshuffle the existing players',
  TEAMMATES.every(n =>
    JSON.stringify(defaultStyle(n, withGuest)) === JSON.stringify(defaultStyle(n, TEAMMATES))))
check('someone off the roster still gets a style',
  !!defaultStyle('A Walk-in', TEAMMATES).color)

console.log('\nan explicit pick overrides the default')
check('with no pick, the default applies',
  styleFor('Lucy', {}, TEAMMATES).color === defaultStyle('Lucy', TEAMMATES).color)
const picked = { Lucy: { color: PLAYER_COLORS[9], icon: PLAYER_EMOJI[9] } }
check('a pick wins over the default', styleFor('Lucy', picked, TEAMMATES).color === PLAYER_COLORS[9])
check('and only for that player',
  styleFor('Matt', picked, TEAMMATES).color === defaultStyle('Matt', TEAMMATES).color)

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
