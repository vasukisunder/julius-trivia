/**
 * Guards the sticker art.
 *
 * The clue data references art by key and TypeScript checks the key against the
 * registry — but nothing in the type system knows whether the file behind the key
 * is actually on disk. A missing file is an invisible failure: the sticker simply
 * does not appear, and only on the projector, mid-game.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const read = (p) => readFileSync(new URL(p, root), 'utf8')

let pass = 0, fail = 0
const check = (label, cond) => {
  if (cond) { pass++; console.log('  PASS ' + label) }
  else { fail++; console.log('  FAIL ' + label) }
}

const files = readdirSync(new URL('public/stickers', root))
  .filter((f) => f.endsWith('.webp'))
  .map((f) => f.slice(0, -5))

// The literals inside STICKER_KEYS only — the prose above it names things too.
const registry = read('src/data/stickers.ts')
  .split('STICKER_KEYS = [')[1].split('] as const')[0]
const keys = [...registry.matchAll(/'([a-z][a-z0-9-]*)'/g)].map((m) => m[1])

const board = read('src/data/index.ts')
const used = new Set(
  [...board.matchAll(/stickers: \[([\s\S]*?)\]/g)]
    .flatMap((m) => [...m[1].matchAll(/'([a-z][a-z0-9-]*)'/g)].map((x) => x[1])),
)

console.log('sticker art')
console.log(`  (${files.length} files, ${keys.length} registered, ${used.size} used)`)

const noFile = keys.filter((k) => !files.includes(k))
check(`every registered key has art on disk${noFile.length ? ` (${noFile})` : ''}`,
  noFile.length === 0)

const unregistered = files.filter((f) => !keys.includes(f))
check(`every file on disk is registered${unregistered.length ? ` (${unregistered})` : ''}`,
  unregistered.length === 0)

// Art nobody uses is 30KB of dead weight shipped to every screen by the preloader.
const orphans = files.filter((f) => !used.has(f))
check(`no orphaned art${orphans.length ? ` (${orphans})` : ''}`, orphans.length === 0)

const missing = [...used].filter((u) => !files.includes(u))
check(`every sticker on the board has art${missing.length ? ` (${missing})` : ''}`,
  missing.length === 0)

/**
 * The whole set is preloaded on the host and shared screens during setup, so its
 * total size is a real number rather than a detail.
 *
 * The budget was 1MB when the art was flat 3D emoji that compressed to 4KB apiece.
 * The generated set is detailed illustration — litho card, woodblock, halftone — and
 * lands around 10KB at the resolution it is actually displayed: 208px for objects,
 * which render at up to 100px, and 416px for postcards, which render at up to 204px.
 * Squeezing under 1MB meant 208px postcards, which is under 2x for their display
 * size and visibly soft on a projector. 1.5MB preloads in about a second on office
 * wifi, once, on two screens, while people are still joining.
 */
const bytes = files.reduce(
  (n, f) => n + statSync(new URL(`public/stickers/${f}.webp`, root)).size, 0)
check(`the set preloads under 1.5MB (${Math.round(bytes / 1024)}KB)`,
  bytes < 1536 * 1024)

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) throw new Error(`${fail} sticker check(s) failed`)
