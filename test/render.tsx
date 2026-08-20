/**
 * Renders every clue's sticker layer and checks what comes out.
 *
 * This exists because of a real crash: the placement hash fills all 32 bits, a
 * signed `>>` on a value above 2^31 came out negative, and a negative band index
 * made the whole stage blank the moment the host opened one of the twelve clues
 * whose key happened to hash high. Nothing in the type system could see it, and
 * the reducer tests never render.
 *
 * So this asserts twice over: that the layer renders at all, and that the numbers
 * it puts on the page are inside the box. A silently negative offset is the same
 * bug one shift away.
 */
import { renderToStaticMarkup } from 'react-dom/server'
import { Stickers } from '../src/components/Stickers'
import { ClueStage } from '../src/components/ClueStage'
import { CATEGORIES, FINAL_CLUE } from '../src/data'
import { clueKey, type Clue, type CluePhase, type Buzz } from '../src/types'
import { initialState, reducer } from '../src/state/gameState'

let pass = 0, fail = 0
const check = (label: string, cond: boolean) => {
  if (cond) { pass++; console.log('  PASS ' + label) }
  else { fail++; console.log('  FAIL ' + label) }
}

const clues: { clue: Clue; seed: string }[] = [
  ...CATEGORIES.flatMap((cat, c) =>
    cat.clues.map((clue, i) => ({ clue, seed: clueKey({ categoryIndex: c, clueIndex: i }) }))),
  { clue: FINAL_CLUE, seed: '-1-0' },
]

console.log('sticker rendering')

const crashed: string[] = []
const html: string[] = []
for (const { clue, seed } of clues) {
  try {
    html.push(renderToStaticMarkup(<Stickers stickers={clue.stickers} seed={seed} />))
  } catch (e) {
    crashed.push(`${seed}: ${(e as Error).message}`)
  }
}
check(`every clue's stickers render (${clues.length})${crashed.length ? ` — ${crashed}` : ''}`,
  crashed.length === 0)

const all = html.join('')
const nums = (prop: string) =>
  [...all.matchAll(new RegExp(`${prop}:\\s*(-?[\\d.]+)`, 'g'))].map((m) => Number(m[1]))

const tops = nums('top')
// Below the header, and clear of the footer once a printed piece's height is added.
const badTop = tops.filter((v) => v < 15 || v > 70)
check(`every top is between 15% and 70% (${tops.length} of them)${badTop.length ? ` — ${badTop}` : ''}`,
  tops.length > 0 && badTop.length === 0)

const insets = [...nums('left'), ...nums('right')]
const badInset = insets.filter((v) => v < 2 || v > 7)
check(`every inset is between 2% and 7% (${insets.length})${badInset.length ? ` — ${badInset}` : ''}`,
  insets.length > 0 && badInset.length === 0)

const rots = nums('--rot')
const badRot = rots.filter((v) => v < -13 || v > 13)
check(`every tilt is within 13 degrees${badRot.length ? ` — ${badRot}` : ''}`, badRot.length === 0)

// Near 1 by default; a clue may call for an explicit emphasis, which multiplies it.
const scales = nums('--scale')
const badScale = scales.filter((v) => v < 0.85 || v > 2.3)
check(`every scale is between 0.85 and 2.3${badScale.length ? ` — ${badScale}` : ''}`,
  scales.length > 0 && badScale.length === 0)
const emphasised = scales.filter((v) => v > 1.15)
check(`exactly one sticker is emphasised (${emphasised.length})`, emphasised.length === 1)

// Both sides get used, or the "scatter" is a single column.
check('stickers land on both edges',
  nums('left').length > 0 && nums('right').length > 0)
/**
 * Two stickers on one side of one clue must sit in different bands. Heights are set
 * in CSS, so this checks the gap between them instead: a printed piece is about 16%
 * of the stage tall, and the bands are 34% apart, so anything closer than 20% means
 * two pieces have been dealt into the same band and will overlap.
 */
const stacked = clues.flatMap(({ seed }, n) => {
  const bySide: Record<string, number[]> = { left: [], right: [] }
  for (const m of html[n].matchAll(/style="([^"]*)"/g)) {
    const side = /(left|right):/.exec(m[1])?.[1]
    const top = /top:\s*([\d.]+)/.exec(m[1])?.[1]
    if (side && top) bySide[side].push(Number(top))
  }
  return Object.entries(bySide).flatMap(([side, tops]) =>
    tops.flatMap((a, i) => tops.slice(i + 1)
      .filter((b) => Math.abs(a - b) < 20)
      .map(() => `${seed} ${side}`)))
})
check(`no clue stacks two stickers in one band${stacked.length ? ` — ${stacked}` : ''}`,
  stacked.length === 0)

console.log('\nno step is a dead end')
/**
 * Every phase of every clue must offer the host at least one enabled action, or the
 * game stops with no way forward. This exists because the closing question spent a
 * commit with nothing in its footer during the verdict step: Correct and Wrong were
 * removed there, since a match question has no single team on the spot, and nothing
 * replaced them.
 */
let seeded = reducer(initialState(), { type: 'shuffleTeams' })
seeded = reducer(seeded, { type: 'setTeams', rosters: seeded.teams.map((t) => t.members) })
const teams = seeded.teams
const buzz: Buzz = {
  playerId: 'p1', name: teams[0].members[0], teamId: teams[0].id, reactionMs: 420,
}

const PHASES: CluePhase[] = ['reading', 'buzzing', 'verdict', 'revealed']
const stage = (clue: Clue, phase: CluePhase, isFinal: boolean) =>
  renderToStaticMarkup(
    <ClueStage
      clue={clue}
      categoryName="Test"
      accent="#8B90E5"
      mode="host"
      teams={teams}
      awardedIds={[]}
      phase={phase}
      timerEndsAt={null}
      buzzes={phase === 'reading' ? [] : [buzz]}
      styleOf={() => ({ color: '#8B90E5', icon: '🐝' })}
      lockedOut={[]}
      onTheSpot={phase === 'reading' ? null : buzz}
      lastWrong={null}
      clueKeyStr={isFinal ? '-1-0' : '0-0'}
      onOpenBuzzers={() => {}}
      onEndBuzzing={() => {}}
      onCorrect={() => {}}
      onWrong={() => {}}
      onSkipToAnswer={() => {}}
      finalHits={{}}
      onSetFinalHits={() => {}}
      isFinal={isFinal}
      doneLabel={isFinal ? 'And the winner is…' : 'Next question'}
      canReturnToBoard={!isFinal}
      onDone={() => {}}
      onDismiss={() => {}}
      onReturnToBoard={() => {}}
    />,
  )

/** Enabled buttons in the footer, which is where the step's action lives. */
function footerActions(markup: string): number {
  const foot = markup.split('class="stage-foot"')[1] ?? ''
  return [...foot.matchAll(/<button[^>]*>/g)].filter((m) => !m[0].includes('disabled')).length
}

const deadEnds: string[] = []
for (const phase of PHASES) {
  for (const [label, clue, isFinal] of [
    ['tile', CATEGORIES[0].clues[0], false],
    ['closing question', FINAL_CLUE, true],
  ] as const) {
    const n = footerActions(stage(clue, phase, isFinal))
    if (n === 0) deadEnds.push(`${label} / ${phase}`)
  }
}
check(`every step offers the host an action${deadEnds.length ? ` — stuck at ${deadEnds}` : ''}`,
  deadEnds.length === 0)

// The closing question leads into the ceremony rather than back to the board.
const finalRevealed = stage(FINAL_CLUE, 'revealed', true)
check('the closing question reveals a winner from its last step',
  finalRevealed.includes('And the winner is'))
check('and it cannot be put back on a tile it never had',
  !finalRevealed.includes('Put back on the board'))

// Marking is what replaces Correct/Wrong there, and it has to be reachable.
check('the closing question can be marked while it is being judged',
  stage(FINAL_CLUE, 'verdict', true).includes('finalmark'))
check('and still while the answers are up',
  stage(FINAL_CLUE, 'revealed', true).includes('finalmark'))
check('a tile never shows the marker',
  !stage(CATEGORIES[0].clues[0], 'verdict', false).includes('finalmark'))

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) throw new Error(`${fail} render check(s) failed`)
