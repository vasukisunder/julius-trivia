/**
 * Category palette — an indigo → blue → teal → green sweep, plus a lilac to
 * round out the range. Muted rather than fluorescent, so it stays warm-hearted
 * on the deep indigo canvas.
 *
 * Six hues have to stay tellable apart at a glance, so the family is spread
 * across the blues and greens rather than clustered.
 *
 * Coral-red is reserved for host chrome and wrong answers, which is why no
 * category claims it.
 */
export const CATEGORY_COLORS = [
  '#8B90E5', // indigo
  '#6D9EE8', // cornflower
  '#4FBAC7', // teal
  '#4FBD8F', // sea green
  '#A2C86E', // sage
  '#A98BE0', // lilac
]

/** Team identity colours — the three most separable of the family. */
export const TEAM_COLORS = ['#8B90E5', '#4FBAC7', '#A2C86E']

export const catColor = (i: number) => CATEGORY_COLORS[i % CATEGORY_COLORS.length]
export const teamColor = (i: number) => TEAM_COLORS[i % TEAM_COLORS.length]
