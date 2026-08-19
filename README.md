# Trivia Night

Jeopardy-style trivia board, built with React + Vite + TypeScript.

Scripts: `npm test` (rules + content), `npm run test:sync` (needs `dev:full` running),
`npm run typecheck`, `npm run build`.

## The board

One 6×6 Jeopardy board — 36 clues. Sized for a one-hour meeting with 2–3 teams:
a real set of choices without an overwhelming wall of tiles.

Every column is a real subject, and teammate facts live inside whichever subject
they belong to — there is no generic "guess the teammate" column. All fourteen
sign-ups get both a personal clue and a clue built from a niche they said they'd
crush; `npm test` asserts it, along with the fact that no plain clue gives away a
spot-the-lie card.

## Adding questions

The board lives in [`src/data/index.ts`](src/data/index.ts). A clue is either:

```ts
{ kind: 'standard', points: 300, question: `...`, answer: `...`, credit: `whose specialty` }
{ kind: 'lie', points: 600, person: 'Ivan', statements: [`…`, `…`, `…`], lieIndex: 2 }
```

Leave `credit` off personal clues — it would give the answer away.

Point values are explicit, so categories do **not** need equal numbers of clues —
short columns are padded on the board automatically.

## The three screens

| Path | Who | Shows answers |
|---|---|---|
| `/host` | Host, marking answers right or wrong | Yes - on every tile and on the clue stage |
| `/present` | Whoever shares their screen | No, until the host reveals |
| `/buzz` | Players, on their phones | n/a |
| `/` | Nobody - deliberately empty | - |

The empty root is the point: the host view prints the whole answer key, so if it lived at
`/` a player could delete "buzz" off their link and read every answer. Nothing on the root
page hints at the other paths either.

The host clicks **Open presentation window** to launch the shared view. There is
deliberately no toggle between modes - it was too easy to hit mid-game and would flash
the answers to the room. Host mode also tints the viewport edge red so a mis-shared
window is obvious.

The presentation screen mirrors the host's controls so the room can follow what is
happening; they are just inert there. The **only** thing withheld is the answers.

## Running it

```bash
npm run dev        # everything: app, sync and buzzers on http://localhost:5173
```

One command. The Cloudflare Vite plugin runs the Worker and the Durable Object *inside*
the dev server, so hot reload and the buzzers work on the same port — there is no second
process to start.

Every screen shows a sync badge, so the state is never a mystery:

| Badge | Meaning |
|---|---|
| **Synced** | The Worker is driving it; separate machines will agree |
| **Reconnecting** | Was connected, lost it, coming back |
| **No server — this window only** | Never reached a server; check the URL |

The dev server also prints a LAN address, so you can open `/buzz` on a real phone while
testing.

## Deploying

One Cloudflare Worker serves the app *and* the buzzer, so it is one URL with no CORS.

**Automatic** - every push to `main` builds and deploys, via Cloudflare Workers Builds.
Settings live in the dashboard under Workers & Pages -> trivia -> Settings -> Builds:

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` (the default) |
| Root directory | *(blank)* |
| Branch | `main` |

The Worker name in the dashboard has to match `name` in `wrangler.toml`, or the build
fails. Pushes to other branches upload a preview version rather than going live.

**Manual**, if you need to deploy without pushing:

```bash
npx wrangler login   # once per machine
npm run deploy
```

Live at **https://trivia.juliusedu.workers.dev** - the host gets `/host`, the presenter
`/present`, and the room `/buzz`. Hand the host `/`, the presenter `/present`, and the
room `/buzz`. Nothing runs locally during the game, and it fits inside the Cloudflare
free plan.

State lives in a Durable Object - one per room, single-threaded, which is what makes
buzz ordering authoritative with no races. Add `?room=<name>` to run separate games.

Because that state persists between sessions, use **New game** in the host toolbar
before the real thing - it clears scores, teams and the player list. `Reset scores`
keeps the teams and just clears the board.

### What a deploy does and does not touch

- **Open tabs keep the old code.** Deploying changes what the server hands out; a page
  already loaded keeps running what it loaded. Everyone (phones included) has to reload.
- **Game state survives**, because the Durable Object is separate from the code.
- **Unless the state shape changed.** When `STATE_VERSION` in `src/state/gameState.ts`
  is bumped, the Durable Object discards mismatched state instead of merging it - that is
  what stops stale defaults surviving a rename. So a deploy carrying a version bump
  resets the live game.

**Do not deploy on game day.** Deploy, hit **New game**, then leave it alone.

## Sound

Only the **presentation screen** makes noise — the host's laptop and every phone stay
silent. Sound belongs to the one machine whose audio the room hears; sixteen devices
chiming at once would be unusable.

Cues are synthesised with the Web Audio API rather than loaded from files: nothing extra
for the Worker to serve, nothing to fail on a flaky connection, and the whole set is a
couple of kilobytes. They are short, soft-attacked and quiet, because this plays over a
video call.

Cues fire off changes in shared state, not off the click that caused them — the shared
screen never handles the interaction, so it watches the state instead. There is a cue for
a tile opening, buzzers going live, each buzz (first place is brighter), the closing five
seconds, the clock running out, a right answer, a wrong one, teams being drawn, and the
game starting.

**One thing the host must do:** browsers keep audio suspended until something is clicked
in that window, and the presentation window is opened programmatically, so it has had no
click of its own. It shows an amber **Turn on sound** button until pressed — pressing
anything in that window also does it. Without that, the night is silent and nothing says
why.

## How the buzzer stays fair

Ranking by when a buzz *arrives* would rank people by their broadband, not their
reflexes - round-trips differ by 50-200ms per person, and on a video call people hear
the question at different times anyway. So each phone starts its own clock when the
button actually paints and sends the **elapsed reaction time**; the server ranks by
that. A wrong answer locks that team out of the clue and promotes the next-fastest
buzzer from a team still in play.

## Hosting a game

- Setup runs in two steps: confirm **who's here** (add walk-ins, drop no-shows, pick how
  many teams), then **shuffle** them into teams. Editing the roster first is what makes
  the draw come out even.
- After the shuffle you can drag players between teams before starting.
- Each clue runs as a fixed sequence, with one obvious action at every step:

  1. **Read the question.** Everyone sees it. Host's only move: *Open buzzers*
     (or the quiet *Skip to answer*, for a clue nobody will buzz on).
  2. **Buzzers open.** A large countdown, buzzes landing in order. Nothing else is
     possible. Host's only move: *Stop buzzers*, or let the clock run out.
  3. **One team has the floor** — the fastest buzzer from a team not already ruled
     out. Host rules *Correct* or *Wrong*. Wrong buzzes that team out, flashes the
     stage red, and promotes the next team automatically. When everyone who buzzed
     is out, it moves on by itself.
  4. **Answer.** Shown plainly, with who scored. Host's only move: *Next question*.

  The step is named at the top of the screen throughout, on both the host's view
  and the shared one. Scores can still be corrected any time from the scoreboard
  steppers, so the sequence never traps the host.
- Clicking a tile opens the clue. **Escape, the ✕, and clicking outside all close
  without using it up** — only "Done" retires a clue.
- After revealing, tap every player who got it. Tapping again takes it back.
- A retired tile stays clickable: reopen it to re-score, or "Put back on the board".
- Progress saves to localStorage automatically; a refresh will not lose the game.

`julius-trivia.html` is the original single-file version, kept for reference.
