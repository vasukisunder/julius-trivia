import { useMemo } from 'react'
import { CATEGORY_COLORS, TEAM_COLORS } from '../theme'

const COLORS = [...TEAM_COLORS, ...CATEGORY_COLORS]
const COUNT = 90

/**
 * Full-screen confetti, generated rather than loaded — no library, no assets, and
 * it picks up the board's own palette.
 *
 * Sits above everything but takes no pointer events, and adds no backdrop: an
 * earlier celebration dimmed the screen and made the answer underneath hard to
 * read, which is the one thing a celebration must not do.
 *
 * `seed` changes per award so the pieces are re-randomised and the animation
 * replays even when the same team scores twice.
 */
export function Confetti({ seed }: { seed: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: COUNT }, (_, i) => ({
        left: Math.random() * 100,
        drift: (Math.random() - 0.5) * 30,
        delay: Math.random() * 0.5,
        duration: 2.2 + Math.random() * 1.6,
        spin: 360 + Math.random() * 720 * (Math.random() < 0.5 ? -1 : 1),
        size: 6 + Math.random() * 8,
        long: Math.random() < 0.4,
        color: COLORS[i % COLORS.length],
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seed],
  )

  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <i
          key={i}
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.long ? p.size * 2.4 : p.size,
            background: p.color,
            borderRadius: p.long ? 2 : '50%',
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            ['--dx' as string]: `${p.drift}vw`,
            ['--spin' as string]: `${p.spin}deg`,
          }}
        />
      ))}
    </div>
  )
}
