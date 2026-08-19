/**
 * Player identity: one colour and one shape each.
 *
 * Geometric shapes rather than emoji — they sit inside the design instead of
 * fighting it, stay legible at pill size, and there are enough of them that
 * nobody has to share.
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

/** SVG path data drawn inside a 0 0 24 24 box. */
export const PLAYER_ICONS: Record<string, string> = {
  circle:   'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18z',
  square:   'M4.5 4.5h15v15h-15z',
  triangle: 'M12 3.5 21 20H3z',
  diamond:  'M12 2.5 21.5 12 12 21.5 2.5 12z',
  star:     'M12 2.5l2.7 6.3 6.8.5-5.2 4.4 1.6 6.6L12 16.9l-5.9 3.4 1.6-6.6L2.5 9.3l6.8-.5z',
  hexagon:  'M12 2.5l8.2 4.75v9.5L12 21.5 3.8 16.75v-9.5z',
  cross:    'M9.5 3h5v6.5H21v5h-6.5V21h-5v-6.5H3v-5h6.5z',
  drop:     'M12 2.5c4 5 7 8 7 11.2A7 7 0 0 1 5 13.7C5 10.5 8 7.5 12 2.5z',
  ring:     'M12 3a9 9 0 1 0 0 18A9 9 0 0 0 12 3zm0 5a4 4 0 1 1 0 8a4 4 0 0 1 0-8z',
  arrow:    'M12 2.5 20 12h-4.5v9.5h-7V12H4z',
  moon:     'M15 2.5a9.5 9.5 0 1 0 0 19 8 8 0 0 1 0-19z',
  bolt:     'M13.5 2.5 5.5 13.5H11l-1.5 8 8.5-11.5H12z',
  pentagon: 'M12 2.5l9 6.9-3.4 10.6H6.4L3 9.4z',
  chevron:  'M7.5 2.5 17 12l-9.5 9.5-3.2-3.2L10.6 12 4.3 5.7z',
  heart:    'M12 20.8S3.4 14.6 3.4 9.1A4.6 4.6 0 0 1 12 6.9a4.6 4.6 0 0 1 8.6 2.2c0 5.5-8.6 11.7-8.6 11.7z',
  shield:   'M12 2.5l8 3v6.6c0 5-3.6 8.3-8 9.4-4.4-1.1-8-4.4-8-9.4V5.5z',
}

export const ICON_KEYS = Object.keys(PLAYER_ICONS)

export type PlayerStyle = { color: string; icon: string }

/**
 * Picks a style nobody else has.
 *
 * Prefers an unused colour and an unused shape, because a distinct colour is
 * what makes someone recognisable at a glance. Past the size of the palette it
 * falls back to a distinct colour+shape *pair* — there are 16x16 of those, so it
 * keeps working however many walk-ins turn up.
 */
export function freeStyle(taken: readonly PlayerStyle[]): PlayerStyle {
  const usedColors = new Set(taken.map((s) => s.color))
  const usedIcons = new Set(taken.map((s) => s.icon))

  const freeColor = PLAYER_COLORS.find((c) => !usedColors.has(c))
  const freeIcon = ICON_KEYS.find((i) => !usedIcons.has(i))
  if (freeColor && freeIcon) return { color: freeColor, icon: freeIcon }

  const usedPairs = new Set(taken.map((s) => `${s.color}|${s.icon}`))
  for (const icon of ICON_KEYS) {
    for (const color of PLAYER_COLORS) {
      if (!usedPairs.has(`${color}|${icon}`)) return { color, icon }
    }
  }
  return { color: PLAYER_COLORS[0], icon: ICON_KEYS[0] }
}
