/**
 * Guards against silent CSS failures.
 *
 * An undefined custom property invalidates its entire declaration with no error
 * anywhere — that is how the revealed answer quietly stayed at 32px after the
 * type scale lost two of its steps while rules still referenced them.
 */
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../src/styles/app.css', import.meta.url), 'utf8')

let pass = 0, fail = 0
const check = (label, cond) => {
  if (cond) { pass++; console.log('  PASS ' + label) }
  else { fail++; console.log('  FAIL ' + label) }
}

// Set inline from React, so they are legitimately absent from the stylesheet.
// 'dx' and 'spin' are per-confetti-particle; 'cols' is the board width; 'p' is a
// player's colour on a pill and 'me' is the phone owner's own; the rest are one
// sticker's place, tilt, size and stagger.
const SET_INLINE = new Set([
  'cols', 'p', 'dx', 'spin', 'x', 'y', 'rot', 'scale', 'd', 'me',
])

const defined = new Set([...css.matchAll(/--([a-z0-9-]+)\s*:/g)].map((m) => m[1]))
const used = new Set([...css.matchAll(/var\(--([a-z0-9-]+)\s*[,)]/g)].map((m) => m[1]))
const missing = [...used].filter((u) => !defined.has(u) && !SET_INLINE.has(u))

console.log('css tokens')
check(`every custom property is defined${missing.length ? ` (missing: ${missing})` : ''}`,
  missing.length === 0)

// A token nobody uses is scale drift waiting to be referenced wrongly.
const unused = [...defined].filter((d) => d.startsWith('t-') && !used.has(d))
check(`no orphaned type tokens${unused.length ? ` (unused: ${unused})` : ''}`,
  unused.length === 0)

/**
 * A player's colour and their team's colour are different things and must stay in
 * different properties. They were both coming out of `--team`, so choosing a
 * personal colour repainted the team name on the phone.
 */
const rule = (sel) => (css.split(sel + '{')[1] ?? '').split('}')[0]
check('the player\'s own name is coloured from --me',
  rule('.phone-who').includes('var(--me)'))
check('and the team name from --team',
  rule('.phone-team').includes('var(--team)'))
check('the two are not the same property',
  !rule('.phone-who').includes('var(--team)'))

// Braces balancing, so a bad edit cannot silently kill every rule after it.
const opens = (css.match(/\{/g) ?? []).length
const closes = (css.match(/\}/g) ?? []).length
check(`braces balance (${opens} open, ${closes} close)`, opens === closes)

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) throw new Error(`${fail} css check(s) failed`)
