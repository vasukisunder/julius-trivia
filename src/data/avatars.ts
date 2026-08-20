/**
 * Player identity: one colour and one emoji each.
 *
 * Duplicates are allowed on purpose — if two people both want the fox, that is
 * their business. Auto-assignment still prefers something nobody has yet, so a
 * player who never opens the picker is still distinguishable.
 */
export const PLAYER_COLORS = [
  '#8B90E5', // indigo
  '#6D9EE8', // cornflower
  '#4FBAC7', // teal
  '#4FBD8F', // sea green
  '#A2C86E', // sage
  '#A98BE0', // lilac
  '#E9926F', // apricot
  '#E4B063', // honey
  '#DE8AA0', // dusty rose
  '#63C6D9', // aqua
  '#9FD68A', // pistachio
  '#C0A2F0', // wisteria
  '#7FD1B9', // mint
  '#F0A6B4', // blush
  '#D4B483', // sand
  '#7C9EF0', // periwinkle
]

/** Emoji that read clearly at pill size across phones and desktops. */
export const PLAYER_EMOJI = [
  '🦊', '🐼', '🐙', '🦁', '🐢', '🦉', '🐝', '🦆',
  '🐸', '🦄', '🐧', '🦋', '🐳', '🦖', '🐴', '🦩',
  '🍕', '🍄', '🌵', '🍩', '🍋', '🌶️', '🧁', '🥑',
  '🚀', '⚡', '🔥', '🌈', '⭐', '🎯', '🎸', '👑',
]

export type PlayerStyle = { color: string; icon: string }

/** Stable small integer for a name not on the sign-up list. */
function hash(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0
  return Math.abs(h)
}

/**
 * Everyone's colour and emoji, whether or not they have opened the buzzer.
 *
 * Derived from their position on the sign-up list, which never moves — so a
 * player's colour is the same before they have touched anything, and adding a
 * walk-in does not reshuffle everyone else's. The list is shorter than the palette,
 * so the whole team comes out distinct. Walk-ins are hashed.
 */
export function defaultStyle(name: string, roster: readonly string[]): PlayerStyle {
  const i = roster.indexOf(name)
  const n = i >= 0 ? i : hash(name)
  return {
    color: PLAYER_COLORS[n % PLAYER_COLORS.length],
    icon: PLAYER_EMOJI[n % PLAYER_EMOJI.length],
  }
}

/**
 * The style to show for someone: their own pick if they made one, otherwise the
 * default. `playerStyles` therefore holds only deliberate choices.
 */
export function styleFor(
  name: string,
  overrides: Record<string, PlayerStyle>,
  roster: readonly string[],
): PlayerStyle {
  return overrides[name] ?? defaultStyle(name, roster)
}
