/**
 * End-to-end sync check against a running Worker.
 *
 *   npm run dev           # in one terminal
 *   npm run test:sync     # in another
 *
 * Proves the thing the whole two-host setup depends on: an action from one
 * screen reaches the others, the random draw happens once on the server rather
 * than separately in each window, and buzzes are ordered by reaction time.
 */
// Two clients on one room: does an action from A reach B?
const PORT = process.env.PORT ?? '5173'
const URL = `ws://localhost:${PORT}/api/room/t${Date.now().toString(36)}/ws`
let pass = 0, fail = 0
const check = (l, c) => { c ? (pass++, console.log('  PASS ' + l)) : (fail++, console.log('  FAIL ' + l)) }
const nextState = (ws) => new Promise((res) => {
  ws.addEventListener('message', function h(e) {
    const m = JSON.parse(e.data)
    if (m.type === 'state') { ws.removeEventListener('message', h); res(m.state) }
  })
})
const open = (ws) => new Promise((res) => ws.addEventListener('open', res))

const a = new WebSocket(URL); await open(a)
const sA = await nextState(a)
check('client A receives state on connect', !!sA && sA.phase === 'roster')
check('state carries the roster', Array.isArray(sA.roster) && sA.roster.length > 0)

const b = new WebSocket(URL); await open(b)
const sB = await nextState(b)
check('client B receives the same state', JSON.stringify(sB.roster) === JSON.stringify(sA.roster))

// A edits the roster; B must see it without asking.
const bWaits = nextState(b)
a.send(JSON.stringify({ type: 'action', action: { type: 'removeFromRoster', name: 'Joe' } }))
const sB2 = await bWaits
check('an action from A is broadcast to B', !sB2.roster.includes('Joe'))

// A shuffles; the draw must be identical on both, not rolled twice.
// Track the LATEST state each client has seen, so a queued earlier broadcast
// cannot be mistaken for the shuffle result.
const latest = new Map()
for (const [k, ws] of [['a', a], ['b', b]]) {
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data)
    if (m.type === 'state') latest.set(k, m.state)
  })
}
a.send(JSON.stringify({ type: 'action', action: { type: 'shuffleTeams' } }))
await new Promise(r => setTimeout(r, 300))
const sA3 = latest.get('a'), sB3 = latest.get('b')
check('both views land on the SAME random draw',
  JSON.stringify(sA3.teams) === JSON.stringify(sB3.teams))
check('the draw is even', (() => {
  const l = sB3.teams.map(t => t.members.length)
  return Math.max(...l) - Math.min(...l) <= 1
})())

// Two actions sent back-to-back must both survive. The Durable Object's message
// handler is async, so without serialisation both read the same state and the
// second save clobbered the first — openClue was wiping openBuzzers.
a.send(JSON.stringify({ type: 'action', action: { type: 'openClue', ref: { categoryIndex: 0, clueIndex: 0 } } }))
a.send(JSON.stringify({ type: 'action', action: { type: 'openBuzzers', seconds: 25 } }))
await new Promise(r => setTimeout(r, 250))
check('back-to-back actions do not clobber each other',
  latest.get('b')?.open?.clueIndex === 0 && latest.get('b')?.buzzOpenedAt !== null)
const bWaits3 = nextState(b)
b.send(JSON.stringify({ type: 'action', action: { type: 'buzz', buzz: { playerId: 'slow', name: 'Slow', teamId: 1, reactionMs: 800 } } }))
await bWaits3
const bWaits4 = nextState(b)
a.send(JSON.stringify({ type: 'action', action: { type: 'buzz', buzz: { playerId: 'fast', name: 'Fast', teamId: 2, reactionMs: 200 } } }))
const sB4 = await bWaits4
check('buzzes ranked by reaction time across clients',
  sB4.buzzes.map(x => x.name).join() === 'Fast,Slow')

// A third client joining mid-game gets the live state, not a fresh one.
const c = new WebSocket(URL); await open(c)
const sC = await nextState(c)
check('a phone joining late receives the game in progress',
  sC.buzzes.length === 2 && sC.open?.categoryIndex === 0)

// A phone whose socket dies (screen lock, backgrounded tab) must come back
// knowing whether the buzzers are open, without a refresh.
c.close()
await new Promise(r => setTimeout(r, 200))
const d = new WebSocket(URL); await open(d)
const sD = await nextState(d)
check('a reconnecting phone learns the buzzers are OPEN', sD.buzzOpenedAt !== null)

// And when the host shuts them, the already-connected phone hears about it.
const dWaits = nextState(d)
a.send(JSON.stringify({ type: 'action', action: { type: 'closeBuzzers' } }))
const sD2 = await dWaits
check('a connected phone hears the buzzers close', sD2.buzzOpenedAt === null)

// Hover is relayed, not stored: the shared screen has no cursor of its own, but
// mouse movement must not persist or re-broadcast the whole game state.
const hoverSeen = new Promise((res) => {
  b.addEventListener('message', function h(e) {
    const m = JSON.parse(e.data)
    if (m.type === 'hover') { b.removeEventListener('message', h); res(m.key) }
  })
})
a.send(JSON.stringify({ type: 'hover', key: '3-4' }))
check('the host\'s hover reaches the shared screen', (await hoverSeen) === '3-4')

// It must not have touched the game state.
const stateAfter = nextState(b)
a.send(JSON.stringify({ type: 'action', action: { type: 'reveal' } }))
const sAfterHover = await stateAfter
check('hover left no trace in game state', !('hovered' in sAfterHover))

a.close(); b.close(); d.close()
console.log(`\n${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
