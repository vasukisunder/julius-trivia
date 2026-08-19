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
| `/` | Host, marking answers right or wrong | Yes - on every tile and on the clue stage |
| `/present` | Whoever shares their screen | No, until the host reveals |
| `/buzz` | Players, on their phones | n/a |

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

One Cloudflare Worker serves the app *and* the buzzer, so it is one URL with no CORS:

```bash
npx wrangler login
npm run deploy
```

That gives a public HTTPS URL. Hand the host `/`, the presenter `/present`, and the
room `/buzz`. Nothing runs locally during the game, and it fits inside the Cloudflare
free plan.

State lives in a Durable Object - one per room, single-threaded, which is what makes
buzz ordering authoritative with no races. Add `?room=<name>` to run separate games.

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
- Once a clue is revealed, **Open buzzers** starts the countdown and the phones go live.
- Clicking a tile opens the clue. **Escape, the ✕, and clicking outside all close
  without using it up** — only "Done" retires a clue.
- After revealing, tap every player who got it. Tapping again takes it back.
- A retired tile stays clickable: reopen it to re-score, or "Put back on the board".
- Progress saves to localStorage automatically; a refresh will not lose the game.

`julius-trivia.html` is the original single-file version, kept for reference.
