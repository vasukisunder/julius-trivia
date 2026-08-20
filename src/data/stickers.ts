/**
 * Sticker art.
 *
 * Every clue carries one to four stickers, scattered and tilted around the edges
 * of the stage like magnets on a fridge. They are decoration with a job: they give
 * the room something to look at while the question is read, and they make each clue
 * feel like a made object rather than a text slide.
 *
 * Two materials, deliberately:
 *
 *   - Objects are glossy 3D art from Microsoft's Fluent Emoji set (MIT), vendored
 *     into public/stickers as WebP. Vendored rather than hot-linked so nothing
 *     depends on a CDN mid-game, and WebP because it took the set from 2.6MB to
 *     under 600KB.
 *   - Printed ephemera — postcards, a felt pennant, a ticket stub — are built from
 *     HTML and type instead. Flat paper should look like flat paper next to the
 *     glossy objects, and they carry words, which art cannot.
 *
 * ONE RULE: a sticker must never answer the question. It can set the scene the
 * question lives in, but a Brazilian flag on "which nation has played every World
 * Cup" hands over the point. Where the answer is a teammate this is free — no
 * object gives away a person — so the general-knowledge clues are where to look
 * twice.
 */

/** Art available in public/stickers. The union below makes a typo a build error. */
export const STICKER_KEYS = [
  'automobile', 'ball-soccer', 'bandage', 'baseball', 'basketball', 'bed', 'beer',
  'bicycle', 'brownie', 'camping', 'canoe', 'cat', 'clapper', 'classical-building', 'clock',
  'coat', 'cocktail', 'coffee', 'compass', 'couch', 'crown', 'crutch', 'cut-of-meat',
  'deer', 'dress-shoe', 'egg', 'film', 'fire', 'football', 'fountain-pen', 'frog', 'gem',
  'ghost', 'gi', 'glasses', 'globe', 'golf', 'guitar', 'heart-pink', 'house-garden',
  'keyboard', 'laptop', 'luggage', 'medal', 'mic', 'money-bag', 'mountain-snow',
  'movie-camera', 'musical-notes', 'newspaper', 'oil-drum', 'open-book', 'palm', 'palms-up',
  'pine', 'popcorn', 'pushpin', 'rabbit', 'ring', 'rose', 'running-shoe', 'ship', 'skate',
  'skis', 'snowflake', 'snowman', 'star', 'stethoscope', 'sun-umbrella', 'swords', 'tennis',
  'test-tube', 'top-hat', 'trophy', 'tshirt', 'tv', 'videogame', 'volcano', 'wand',
  'water-wave', 'wine', 'world-map',
] as const

export type StickerKey = (typeof STICKER_KEYS)[number]

/** Where the art lives. One place, so the preloader and the renderer agree. */
export const stickerSrc = (key: StickerKey) => `/stickers/${key}.webp`

/**
 * A postcard. `place` is printed large, `note` is the scrawl underneath — vary it,
 * because four identical "Wish you were here" cards read as a template.
 */
export type Postcard = { postcard: string; note: string }

/** A felt sports pennant. */
export type Pennant = { pennant: string }

/** A torn ticket stub: headline over a small line of detail. */
export type Stub = { stub: string; sub: string }

/**
 * One sticker. A bare key is the common case and stays readable in the board data;
 * the object forms are the printed pieces.
 */
export type Sticker = StickerKey | Postcard | Pennant | Stub

export const isPostcard = (s: Sticker): s is Postcard =>
  typeof s === 'object' && 'postcard' in s
export const isPennant = (s: Sticker): s is Pennant =>
  typeof s === 'object' && 'pennant' in s
export const isStub = (s: Sticker): s is Stub =>
  typeof s === 'object' && 'stub' in s
/** Printed pieces are wide, so the scatter keeps them further from the text. */
export const isWide = (s: Sticker) => typeof s === 'object'
