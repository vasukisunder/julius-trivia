import { PLAYER_ICONS } from '../data/avatars'
import type { PlayerStyle } from '../types'

type Props = {
  name: string
  style?: PlayerStyle
  size?: 'sm' | 'md'
}

/** The player's shape, drawn in their colour. */
export function PlayerIcon({ icon, size = 16 }: { icon: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d={PLAYER_ICONS[icon] ?? PLAYER_ICONS.circle} fill="currentColor" />
    </svg>
  )
}

/**
 * A player as a coloured pill. Used on the team cards and in the buzz queue, so
 * the same colour and shape mean the same person everywhere.
 *
 * Players without a claimed style are shown plain rather than given a temporary
 * colour — a colour that changed once they opened the buzzer would be worse than
 * no colour at all.
 */
export function PlayerPill({ name, style, size = 'md' }: Props) {
  if (!style) {
    return <span className={`ppill blank ${size}`}>{name}</span>
  }
  return (
    <span className={`ppill ${size}`} style={{ ['--p' as string]: style.color }}>
      <PlayerIcon icon={style.icon} size={size === 'sm' ? 13 : 15} />
      {name}
    </span>
  )
}
