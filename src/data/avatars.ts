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

/**
 * A default for someone who has not chosen. Prefers a colour and emoji nobody
 * has taken so the room stays readable, but nothing stops a player picking a
 * duplicate afterwards.
 */
export function freeStyle(taken: readonly PlayerStyle[]): PlayerStyle {
  const usedColors = new Set(taken.map((s) => s.color))
  const usedEmoji = new Set(taken.map((s) => s.icon))
  return {
    color:
      PLAYER_COLORS.find((c) => !usedColors.has(c)) ??
      PLAYER_COLORS[taken.length % PLAYER_COLORS.length],
    icon:
      PLAYER_EMOJI.find((e) => !usedEmoji.has(e)) ??
      PLAYER_EMOJI[taken.length % PLAYER_EMOJI.length],
  }
}
