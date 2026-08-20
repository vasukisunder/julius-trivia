import {
  isPennant, isPhoto, isPostcard, isRosette, isStamp, isStub, isTag, isWide,
  stickerSrc, type Sticker,
} from '../data/stickers'

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
 * Slots hug the left and right edges — see SLOTS below for why.
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

/**
 * Slots anchor to an edge rather than centring on a point. Centring meant half of a
 * corner sticker sat outside the layer and got clipped; anchoring an inset puts the
 * whole box inside by construction, and jitter only ever moves it further in.
 *
 * All eight hug the left or right edge at four heights. The stage's text is centred
 * horizontally, so the edges are the only region that is clear of it no matter how
 * long the question runs — and alternating sides keeps any run of slots balanced.
 */
const SLOTS = [
  { l: 3, t: 7 }, { r: 3, t: 5 },
  { l: 2, t: 33 }, { r: 2, t: 30 },
  { l: 5, t: 60 }, { r: 5, t: 57 },
  { l: 3, b: 6 }, { r: 3, b: 5 },
] as const

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

        const style: Record<string, string | number> = {
          ['--rot']: `${((h >> 11) % 27) - 13}deg`,
          ['--scale']: 0.87 + ((h >> 17) % 7) / 26,
          ['--d']: `${i * 80}ms`,
        }
        // Jitter is added to the inset, never subtracted: more inset is always
        // further from the edge, so no amount of it can push a sticker out.
        if ('l' in slot) style.left = `${slot.l + ((h >> 3) % 4)}%`
        else style.right = `${slot.r + ((h >> 3) % 4)}%`
        if ('t' in slot) style.top = `${slot.t + ((h >> 7) % 5)}%`
        else style.bottom = `${slot.b + ((h >> 7) % 5)}%`

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

  if (isPhoto(sticker)) {
    return (
      <div className="polaroid">
        <div className="polaroid-frame">
          <img src={stickerSrc(sticker.of)} alt="" draggable={false} />
        </div>
        <div className="polaroid-cap">{sticker.photo}</div>
      </div>
    )
  }

  if (isTag(sticker)) {
    return (
      <div className="ltag">
        <span className="ltag-hole" />
        <span className="ltag-text">
          {sticker.tag}
          {sticker.sub && <em>{sticker.sub}</em>}
        </span>
      </div>
    )
  }

  if (isRosette(sticker)) {
    return (
      <div className="rosette">
        <span className="rosette-tail" />
        <span className="rosette-tail" />
        <span className="rosette-disc">{sticker.rosette}</span>
      </div>
    )
  }

  if (isStamp(sticker)) {
    return (
      <div className="pstamp">
        <span className="pstamp-panel">{sticker.stamp}</span>
      </div>
    )
  }

  return <img className="sticker-img" src={stickerSrc(sticker)} alt="" draggable={false} />
}
