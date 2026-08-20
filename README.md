# Trivia Night

A buzzer-based trivia board. React + Vite + TypeScript on the client, a single
Cloudflare Worker with one Durable Object per room on the server.

## Commands

```bash
npm install
npm run dev         # app, sync and buzzers on http://localhost:5173
npm test            # reducer, content and CSS checks
npm run test:sync   # end-to-end sync, needs `npm run dev` running
npm run typecheck
npm run build
npm run deploy      # build, then wrangler deploy
```

`npm run dev` is the whole stack. The Cloudflare Vite plugin runs the Worker and the
Durable Object inside the dev server, so hot reload and the realtime layer share one
port. The dev server also prints a LAN address, which is how you reach `/buzz` from a
phone.

## Routes

| Path | Surface | Answers visible |
|---|---|---|
| `/host` | Control surface; drives the game | Yes |
| `/present` | Read-only mirror, intended for screen sharing | Only after an explicit reveal |
| `/buzz` | Phone buzzer | n/a |
| `/` | Empty by design | — |

Nothing is served at the root: the host surface prints the full answer key, so it must
not sit at a path anyone can reach by truncating another one. Mode is fixed by the path
with no in-session toggle.

`/present` renders the same controls as `/host` but disabled, so the mirror shows what
is happening without being able to drive it. Only answers are withheld.

Add `?room=<name>` to any route to use a separate Durable Object instance.

## Architecture

Client state is a single reducer (`src/state/gameState.ts`). The Worker runs the **same
reducer** on the authoritative copy, so client and server cannot drift.

- Clients send actions over a WebSocket and receive whole states back.
- Actions apply optimistically on the client, except those in `SERVER_OWNED`
  (`src/net/useRoom.ts`) — anything non-deterministic, i.e. randomised or clock-reading.
  Guessing those locally produces a different result than the server and visibly snaps.
- `webSocketMessage` in the Durable Object is serialised through a promise chain. It is
  async and the runtime may re-enter it, so two actions arriving together would otherwise
  both read the same state and the second save would clobber the first.
- Sockets identify their surface on connect, so ephemeral messages (cursor position) are
  relayed only to `/present` rather than broadcast to every phone. Ephemeral data is
  never written to state.
- With no server reachable, the same reducer runs locally and each new state is published
  over a `BroadcastChannel`, which keeps windows on one machine in step. Cross-machine
  sync requires the Worker.

### State versioning

`STATE_VERSION` in `src/state/gameState.ts`. State loaded from disk or from the Durable
Object with a different version is **discarded, never merged**, and stale localStorage
keys are pruned on load. Bump it whenever the shape or the seeded defaults change —
otherwise an old save silently beats new defaults.

Consequence: deploying a version bump resets live state.

### Scoring the closing question

Every tile is all-or-nothing: one team wins it, and `awards` records who. The closing
question is a three-way match, so a team can land one or two of them, and every team
hands in an answer rather than one team buzzing — several can score at once.

That does not fit the ledger, so it has its own field, `finalHits` (teamId -> matches
landed, 0-3), and `computeScores` adds `finalPoints(hits)` for each. Deliberately one
field rather than a fractional entry in `awards`: two ledgers that can both describe
the same clue is two things to keep in step. `awardTo` refuses the closing question
outright for the same reason.

The buzzer still works there, and still decides who answers first: Correct on the
closing question means all three, and Wrong locks that team out and promotes the next
buzz, exactly as on a tile. "Reveal the answers" is the way past when nobody buzzed in
with a full answer.

The marker appears only once the answers are revealed: scoring before the room has
seen what the answers were puts the arithmetic ahead of the moment the question exists
for.

Setting a mark replaces it rather than adding, so a host correcting themselves cannot
inflate a score, and only a mark going *up* stamps `lastAward` — otherwise fixing a
typo sets off the confetti again. Putting the question back on the board clears
`finalHits` as well as the ledger.

### Buzz ordering

Ranking by message arrival ranks connections, not reaction times: round trips differ by
50–200ms per client. Each client starts its own clock when the button paints and sends
the elapsed reaction time; the Durable Object ranks by that value. One buzz per client
id. A wrong verdict locks that team out of the clue and promotes the next-fastest buzz
from a team still eligible.

## Content

The board lives in `src/data/index.ts`. A clue is one of two shapes:

```ts
{ kind: 'standard', points: 300, question: `…`, answer: `…`, credit?: `…` }
{ kind: 'lie', points: 600, person: `…`, statements: [`…`, `…`, `…`], lieIndex: 2, prompt?: `…` }
```

Point values are explicit rather than derived from array position, so categories need
not hold equal numbers of clues; short columns are padded in the grid.

`npm test` covers content as well as logic — ascending point ladders, no duplicate
questions, no clue containing its own answer, no clue disclosing another's answer, and
valid `lieIndex` values.

## Stickers

Every clue carries three or four stickers, scattered down the left and right edges of
the stage. The art is generated, keyed and vendored into `public/stickers` as WebP —
102 pieces, 4.2MB for the whole set, preloaded during setup.

Sized generously on both ends. At a 100px box and 208px assets this art read as mush,
and a higher-quality encode at that size changed nothing measurable — the pixel count
was the constraint, not the compression. Objects now render up to 124px from 384px
files and postcards up to 250px from 640px files, roughly 3x, which leaves headroom for
the tilt: rotating a bitmap resamples it a second time and fine linework shows it.

`sticker-prompts.csv` holds the prompt behind each key. Each piece is drawn in the
printing technique that suits the thing it is — litho card, matchbox label, risograph,
enamel tin sign, embroidered patch, woodblock, Ben-Day comic — with its own palette
taken from what the object actually looks like. That variety is the point: a fridge
door is never one sticker pack, and an earlier pass that fixed one palette across all
of them came back looking like exactly that. The thin white die-cut edge is what holds
the set together.

Filenames are the keys used in `src/data/index.ts`, and the union in
`src/data/stickers.ts` is generated from the directory, so a typo in the board data is
a build error rather than a missing image on the projector.

### Keying

```bash
python3 tools/key.py --dir raw/ --out public/stickers/
```

Prompts ask for a flat magenta background rather than transparency. Asked for
transparency, image models sometimes paint the *symbol* for it — an opaque
grey-and-white checkerboard — and that is unrecoverable here: the art has pure white
die-cut borders, so a border pixel landing on a white checker square is bit-identical
to the background, and half of every border does. A lattice-based repair measured IoU
0.43-0.71 and ate up to 42% of the sticker. White and black are out for the same
reason; the art uses both.

The keyer samples the key per image (the generated pink drifts across R 194-235,
G 27-106), selects by connectivity rather than colour alone so that near-key art like
an oxblood car interior cannot be punched through, keeps only the largest component,
and unmixes edge pixels instead of thresholding them so nothing keeps a pink fringe.
Measured against known alpha: IoU 0.982-0.994.

It also repairs one generation fault — art that comes back with the key colour walled
*inside* it, where the model filled a disc with the background instead of a colour.
That match is at a fixed tolerance, not one scaled to the background's noise: scaling
it put a cream blotch through the middle of a red heart.

### Placement

Derived from a hash of the clue key, not authored, so the host's screen and the shared
screen scatter identically and nothing moves on re-render. Each sticker takes its own
side and its own band down the edges — four is the maximum, which is two per side, so
nothing can overlap. Bands sit below the header and above the footer: free scatter kept
putting art in the corners, where the stage already has the category name, the Close
button and the primary action.

`test/render.tsx` renders every clue's layer and asserts the numbers it writes are
inside the box. That exists because a signed `>>` on a hash that fills all 32 bits went
negative, made a band index -1, and blanked the stage on twelve of the 37 clues.

## Sound

Only `/present` produces audio. Cues are synthesised with the Web Audio API rather than
loaded as files, so there are no audio assets to serve. They fire off state transitions
rather than input events, because the mirror never handles the interaction.

Browsers keep an `AudioContext` suspended until a gesture in that window, and `/present`
is opened programmatically, so it surfaces an explicit control to unlock audio.

## Deploying

One Worker serves the static client and the realtime layer, so there is a single origin
and no CORS.

Pushes to `main` build and deploy through Cloudflare Workers Builds:

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Root directory | *(blank)* |
| Branch | `main` |

The Worker name in the dashboard must match `name` in `wrangler.toml`. Pushes to other
branches upload a preview version instead of deploying.

Manual deploys need `npx wrangler login` once per machine, then `npm run deploy`.

Durable Object state is independent of the code, so it survives deploys. Clients keep
running whatever bundle they loaded; a build check surfaces a reload prompt when a page
is behind the version the server is serving.
