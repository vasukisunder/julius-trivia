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

Every clue carries one to four stickers, scattered around the stage. Two materials:

- **Objects** are art from [Fluent Emoji](https://github.com/microsoft/fluentui-emoji)
  (MIT), vendored into `public/stickers` as WebP — 82 files, 428KB for the whole set.
  Vendored rather than hot-linked so nothing depends on a CDN mid-game. The union in
  `src/data/stickers.ts` is generated from the directory, so a typo in the board data is
  a build error.
- **Printed pieces** — postcards, a pennant, a ticket stub — are built from HTML and
  type in `src/components/Stickers.tsx`. They carry words, which art cannot, and flat
  paper should not look like a glossy object.

Placement is derived from a hash of the clue key, not authored: the host's screen and the
shared screen scatter identically, nothing moves on re-render, and no two clues come out
arranged alike. Slots are corner-weighted because stage text is centred both ways.

The whole set is preloaded during setup. `test/stickers.mjs` checks the registry, the
files on disk and the board data all agree, and holds the set to a size budget.

### Generating art

`sticker-prompts.csv` holds one image-generation prompt per sticker key, and
`tools/key.py` turns the results into assets:

```bash
python3 tools/key.py --dir raw/ --out public/stickers/
```

Prompts ask for a flat magenta `#FF00FF` background rather than transparency. Asked
for transparency, models sometimes paint the *symbol* for it — an opaque grey-and-white
checkerboard. That cannot be undone here: the art has pure white die-cut borders, so
a border pixel landing on a white checker square is bit-identical to the background,
and half of every border does. A lattice-based repair measured IoU 0.43-0.71 and ate
up to 42% of the sticker. White and black are out for the same reason — the art uses
both. Magenta appears in none of the palettes, which are all faded vintage colours,
so the split is exact: IoU 0.982-0.994 measured against known alpha.

The keyer unmixes edge pixels rather than thresholding them, so an anti-aliased pixel
has the key's contribution subtracted back out instead of leaving a pink fringe.

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
