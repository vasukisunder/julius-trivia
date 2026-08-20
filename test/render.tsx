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
import { CATEGORIES, FINAL_CLUE } from '../src/data'
import { clueKey, type Clue } from '../src/types'

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

const scales = nums('--scale')
const badScale = scales.filter((v) => v < 0.85 || v > 1.15)
check(`every scale is near 1${badScale.length ? ` — ${badScale}` : ''}`,
  scales.length > 0 && badScale.length === 0)

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

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) throw new Error(`${fail} render check(s) failed`)
