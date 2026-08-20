import { artOf, isWide, scaleOf, stickerSrc, type Sticker } from '../data/stickers'

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

/**
 * FNV-1a. Small, stable, and good enough to shuffle a tilt.
 *
 * Every read of the result below uses `>>>`, not `>>`. The hash fills all 32 bits,
 * and a signed shift on anything above 2^31 comes out negative — which quietly
 * turned a band index into -1 and took the whole stage down with it.
 */
function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/**
 * Placement is banded rather than free.
 *
 * Free scatter kept putting art in the four corners, which is where the stage puts
 * everything else — the category name, the Close button, the primary action — and
 * where a sticker looks like it fell off the page. So stickers stay in a middle
 * band down the left and right edges: below the header, above the footer, never in
 * a corner, and always clear of the centred text.
 *
 * Within that, each sticker gets its own side and its own band, alternating. Four
 * on one clue is the most there can be, which is exactly two per side — so nothing
 * can overlap anything else, including a postcard, without needing to pack.
 */
/** Vertical bands, as a percentage of the stage. Objects are short and get room to
 *  drift; printed pieces are three times the height and get a tighter leash. */
const BANDS = {
  object: [{ t: 18, drift: 14 }, { t: 54, drift: 14 }],
  wide: [{ t: 18, drift: 6 }, { t: 52, drift: 6 }],
}

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
        const wide = isWide(sticker)

        // Which side and band this one takes. The two flips give four arrangements,
        // so clues do not all deal their stickers out in the same order.
        const onLeft = (i % 2 === 0) !== (base % 2 === 1)
        const band = (Math.floor(i / 2) + ((base >>> 1) % 2)) % 2
        const { t, drift } = BANDS[wide ? 'wide' : 'object'][band]

        const style: Record<string, string | number> = {
          ['--rot']: `${((h >>> 11) % 27) - 13}deg`,
          ['--scale']: (0.87 + ((h >>> 17) % 7) / 26) * scaleOf(sticker),
          ['--d']: `${i * 80}ms`,
          top: `${t + ((h >>> 7) % drift)}%`,
        }
        // Anchored as an inset from the edge, and the jitter only ever adds to it —
        // more inset is further in, so no amount of it can push a sticker out.
        const inset = `${2 + ((h >>> 3) % 5)}%`
        if (onLeft) style.left = inset
        else style.right = inset

        return (
          <div className={`sticker${wide ? ' wide' : ''}`} key={i} style={style}>
            <div className="sticker-art">
              <img className="sticker-img" src={stickerSrc(artOf(sticker))} alt="" draggable={false} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
