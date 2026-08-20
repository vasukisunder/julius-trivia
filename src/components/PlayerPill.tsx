import type { PlayerLook } from '../types'

type Props = {
  name: string
  style?: PlayerLook
  size?: 'sm' | 'md' | 'lg'
  /** Off where the emoji would crowd the name — a revealed answer, for instance. */
  icon?: boolean
}

/** The player's emoji. */
export function PlayerIcon({ icon, size = 16 }: { icon: string; size?: number }) {
  return (
    <span className="pemoji" style={{ fontSize: size }} aria-hidden="true">
      {icon}
    </span>
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
export function PlayerPill({ name, style, size = 'md', icon = true }: Props) {
  if (!style) {
    return <span className={`ppill blank ${size}`}>{name}</span>
  }
  return (
    <span className={`ppill ${size}`} style={{ ['--p' as string]: style.color }}>
      {icon && (
        <PlayerIcon icon={style.icon} size={size === 'sm' ? 12 : size === 'lg' ? 30 : 14} />
      )}
      {style.label}
    </span>
  )
}
