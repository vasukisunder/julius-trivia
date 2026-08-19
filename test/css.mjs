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
const SET_INLINE = new Set(['cols', 'p'])

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

// Braces balancing, so a bad edit cannot silently kill every rule after it.
const opens = (css.match(/\{/g) ?? []).length
const closes = (css.match(/\}/g) ?? []).length
check(`braces balance (${opens} open, ${closes} close)`, opens === closes)

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) throw new Error(`${fail} css check(s) failed`)
