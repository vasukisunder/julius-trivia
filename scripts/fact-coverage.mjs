/**
 * Builds fact-coverage.csv: every personal fact from the sign-up export, whether it
 * is used on the board, and where.
 *
 *   npm run facts
 *
 * Both inputs and the output are gitignored — they contain personal data.
 *
 * Matching is keyword-based and cannot see that "brewer" and "brew their own beer"
 * are the same fact, so verified corrections live in FIX below. Add to it rather
 * than trusting a null.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { CATEGORIES, FINAL_CLUE, FINAL_CATEGORY } from '../node_modules/.cache/board.mjs'

const ROOT = process.cwd()

/* ---- board -------------------------------------------------------------- */
const asEntry = (cl, where) => ({
  where,
  text: cl.kind === 'lie' ? `${cl.person} ${cl.statements.join(' ')}` : `${cl.question} ${cl.answer}`,
  personal: cl.kind === 'lie' || !cl.credit,
})

// The closing question is off the board but still uses facts, so it has to be
// searched too or its facts read as unused.
const clues = [
  ...CATEGORIES.flatMap((c) => c.clues.map((cl) => asEntry(cl, `${c.name} ${cl.points}`))),
  asEntry(FINAL_CLUE, FINAL_CATEGORY),
].filter((c) => c.personal)

const STOP = new Set(['about','after','again','because','before','being','could','every','first','their','there','these','those','which','while','would','still','never','once','three','other','years','times'])
const key = (s) => [...new Set(s.toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/)
  .filter((w) => w.length > 4 && !STOP.has(w)))]

function autoLocate(fact) {
  const words = key(fact)
  let best = null
  for (const c of clues) {
    const hay = c.text.toLowerCase()
    const hits = words.filter((w) => hay.includes(w)).length
    if (hits >= 2 && (!best || hits / words.length > best.score)) {
      best = { where: c.where, score: hits / words.length }
    }
  }
  return best?.where ?? null
}

/**
 * Hand corrections, verified against the clue text. Keyword matching cannot see
 * that "brewer" and "brew their own beer" are the same fact, or that "bike fixing
 * shop" and "bike repair shop" are — and it credited Shakir's Lagos to Juan's
 * travel clue purely on shared geography words.
 */
const FIX = [
  // One distinctive word, so it cannot clear the two-keyword threshold. It lives in
  // the closing question.
  [/ambidextrous/i, FINAL_CATEGORY],
  // The form says "delivering"; the clue says "delivered".
  [/delivering newspapers/i, FINAL_CATEGORY],
  [/brewer/i, 'Origin Stories 300'],
  [/kung fu/i, 'Game On 300'],
  [/bike fixing shop/i, 'Origin Stories 600'],
  [/Lagos/i, null],
]
/**
 * Lies the form never marked. Two people left theirs unmarked; where the answer has
 * since been supplied, record it here so the column is not left saying "not marked"
 * for a set we can actually resolve.
 */
const KNOWN_LIE = { Hattie: /brownies/i }

/** Fragments and pleasantries that are not facts in their own right. */
const DROP = [/^I was sober/i, /^Thank you/i, /^Thanks for/i, /^I love travelling and living abroad$/i]
/** Tidy the artefacts of splitting free text. */
const CLEAN = (t) => t
  // Trailing lie markers, in every form people wrote them: "(lie)", "(a lie)",
  // "(false)", "-> Lie", "— LIE".
  .replace(/\.?\s*\((a |an )?lie,?[^)]*\)?$/i, '')
  .replace(/\.?\s*\(false\)$/i, '')
  .replace(/\.?\s*(->|—|-)\s*LIE$/i, '')
  .replace(/,\s*\d$/, '')
  .replace(/\.$/, '')
  .replace(/^i /, 'I ')
  .replace(/[,;\s]+$/, '')
  .trim()

/**
 * Facts from people who are not in the sign-up export — the host, who has clues on
 * the board without having filled in the form. Without these the CSV would report
 * her facts as unused.
 */
const EXTRA = [
  ['Alexis', 'Started a podcast in 2012', 'true'],
  ['Alexis', "Collects frog-themed things, but doesn't like real frogs", 'true'],
  ['Alexis', 'Is pretty good at playing the electric guitar', 'the lie'],
]

/* ---- form.csv ----------------------------------------------------------- */
function parseCsv(text) {
  const out = []; let row = []; let cell = ''; let q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (ch === '"') q = false
      else cell += ch
    } else if (ch === '"') q = true
    else if (ch === ',') { row.push(cell); cell = '' }
    else if (ch === '\n') { row.push(cell); out.push(row); row = []; cell = '' }
    else if (ch !== '\r') cell += ch
  }
  if (cell || row.length) { row.push(cell); out.push(row) }
  return out
}

const SOURCE = `${ROOT}/form.csv`
const table = parseCsv(readFileSync(SOURCE, 'utf8'))
const head = table[0]
const iName = head.findIndex((h) => h.includes('your name'))
const iFun = head.findIndex((h) => h.includes('fun fact'))
const iTtl = head.findIndex((h) => h.includes('Two truths'))
const iElse = head.findIndex((h) => h.includes('Anything else'))

const SHORT = { 'Hannah Bercovici':'Hannah','Shakir Cannon-Moye':'Shakir','Juan Ignacio':'Juan',
  'Antonela Tamagnini':'Antonela','Ana Merlo':'Ana','Greg Blair':'Greg','Joe Sarubbi':'Joe' }

const LIE_MARK = /\blie\b|\bfalse\b/i
const rows = []

for (const r of table.slice(1)) {
  if (!r[iName]) continue
  const name = SHORT[r[iName]] ?? r[iName]

  const raw = []

  const splitStatements = (field) => {
    const byLine = field.split('\n').map((x) => x.trim()).filter((x) => x.length > 8)
    if (byLine.length >= 3) return byLine
    return field.split(/\.\s+|,\s+(?=I |At age|When I|\d\.)/)
  }
  for (const f of r[iFun].split(/\n|,\s+(?=I |and I )/)) raw.push(['Fun fact', f])
  for (const f of splitStatements(r[iTtl])) raw.push(['Two truths & a lie', f])
  if (r[iElse]) raw.push(['Anything else', r[iElse]])

  // Two people never marked which statement was false.
  const marked = LIE_MARK.test(r[iTtl])

  for (const [source, rawText] of raw) {
    const stripped = rawText.replace(/^(Truths?:|True:|Lie:|\d+\.)\s*/i, '').replace(/^[-\s]+/, '').trim()
    if (stripped.length < 9) continue
    if (DROP.some((d) => d.test(stripped))) continue

    const fact = CLEAN(stripped)
    const isLie = LIE_MARK.test(rawText) && source === 'Two truths & a lie'

    let where = autoLocate(`${name} ${fact}`)
    for (const [pattern, fixed] of FIX) if (pattern.test(fact)) where = fixed

    const known = KNOWN_LIE[name]
    const kind = source !== 'Two truths & a lie'
      ? ''
      : known ? (known.test(fact) ? 'the lie' : 'true')
      : !marked ? 'not marked'
      : isLie ? 'the lie'
      : 'true'
    rows.push({ name, fact, source, kind, where })
  }
}

for (const [name, fact, kind] of EXTRA) {
  rows.push({ name, fact, source: 'Two truths & a lie', kind, where: autoLocate(`${name} ${fact}`) })
}

/* ---- write -------------------------------------------------------------- */
const esc = (v) => /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
const csv = [
  ['Person', 'Fact', 'Source', 'True or lie', 'In game', 'Where in game'].join(','),
  ...rows.map((r) => [r.name, r.fact, r.source, r.kind, r.where ? 'Yes' : 'No', r.where ?? ''].map(esc).join(',')),
].join('\n') + '\n'

writeFileSync(`${ROOT}/fact-coverage.csv`, csv)
const used = rows.filter((r) => r.where).length
console.log(`wrote fact-coverage.csv — ${rows.length} facts, ${used} in game, ${rows.length - used} unused`)
