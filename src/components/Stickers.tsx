import { isPennant, isPostcard, isStub, isWide, stickerSrc, type Sticker } from '../data/stickers'

/**
 * The sticker layer for a clue.
 *
 * Placement is derived, not authored. Hand-placing ninety-odd stickers would be
 * busywork and would drift the moment a clue changed, so each one is dealt a slot
 * from a ring, then tilted and sized by a hash of the clue key. That makes it
 * deterministic — the host's screen and the shared screen scatter identically,
 * and a sticker never jumps on re-render — while no two clues come out arranged
 * the same way.
 *
 * The ring is corner-weighted. Stage text is centred both ways, so the corners are
 * the only region that is reliably clear of it whatever the clue's length.
 */

/** FNV-1a. Small, stable, and good enough to shuffle a tilt. */
function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Percentages of the stage. Alternating sides, so any run of slots stays balanced. */
const SLOTS = [
  { x: 11, y: 17 }, { x: 89, y: 15 },
  { x: 14, y: 83 }, { x: 86, y: 85 },
  { x: 5, y: 50 }, { x: 95, y: 46 },
  { x: 31, y: 8 }, { x: 69, y: 9 },
  { x: 34, y: 92 }, { x: 66, y: 91 },
]

/** Postcard scenery. Indexed by position so four cards on one clue never match. */
const SCENES = [
  { sky: ['#F4A259', '#E2574C'], land: '#3B2A44', sun: '#FFE08A' },
  { sky: ['#7FD8E8', '#C9F0E0'], land: '#2E7D5B', sun: '#FFF3B0' },
  { sky: ['#6D6BB0', '#E58CA8'], land: '#2A2545', sun: '#FFD9A0' },
  { sky: ['#BFE3F2', '#EAF2F7'], land: '#4A6B8A', sun: '#FFFFFF' },
  { sky: ['#F6D48A', '#E8944A'], land: '#8B5A38', sun: '#FFF6D8' },
  { sky: ['#26356B', '#5B7FC7'], land: '#16203D', sun: '#EFF3FF' },
]

type Props = {
  stickers: readonly Sticker[]
  /** Anything stable and unique per clue — the clue key. */
  seed: string
}

export function Stickers({ stickers, seed }: Props) {
  if (stickers.length === 0) return null
  const base = hash(seed)

  return (
    <div className="stickers" aria-hidden="true">
      {stickers.map((sticker, i) => {
        const h = hash(`${seed}#${i}`)
        const slot = SLOTS[(base + i) % SLOTS.length]
        const wide = isWide(sticker)

        // Printed pieces are two to three times the width of an object, so they
        // get pulled in from the edge and pushed out of the vertical middle,
        // where a long question reaches furthest.
        const x = wide ? 50 + (slot.x - 50) * 0.78 : slot.x
        const y = wide && slot.y > 30 && slot.y < 70 ? (slot.y < 50 ? 19 : 81) : slot.y

        const style = {
          ['--x' as string]: `${x + ((h >> 3) % 5) - 2}%`,
          ['--y' as string]: `${y + ((h >> 7) % 7) - 3}%`,
          ['--rot' as string]: `${((h >> 11) % 27) - 13}deg`,
          ['--scale' as string]: 0.87 + ((h >> 17) % 7) / 26,
          ['--d' as string]: `${i * 80}ms`,
        }

        return (
          <div className={`sticker${wide ? ' wide' : ''}`} key={i} style={style}>
            <div className="sticker-art">{art(sticker, i)}</div>
          </div>
        )
      })}
    </div>
  )
}

function art(sticker: Sticker, i: number) {
  if (isPostcard(sticker)) {
    const scene = SCENES[(hash(sticker.postcard) + i) % SCENES.length]
    return (
      <div className="pcard">
        <div
          className="pcard-scene"
          style={{ background: `linear-gradient(${scene.sky[0]}, ${scene.sky[1]})` }}
        >
          <span className="pcard-sun" style={{ background: scene.sun }} />
          <span className="pcard-land" style={{ background: scene.land }} />
          <span className="pcard-place">{sticker.postcard}</span>
        </div>
        <div className="pcard-note">{sticker.note}</div>
      </div>
    )
  }

  if (isPennant(sticker)) {
    return (
      <div className="pennant">
        <span className="pennant-text">{sticker.pennant}</span>
      </div>
    )
  }

  if (isStub(sticker)) {
    return (
      <div className="stub">
        <span className="stub-head">{sticker.stub}</span>
        <span className="stub-sub">{sticker.sub}</span>
      </div>
    )
  }

  return <img className="sticker-img" src={stickerSrc(sticker)} alt="" draggable={false} />
}
