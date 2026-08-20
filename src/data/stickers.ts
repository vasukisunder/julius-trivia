/**
 * Sticker art.
 *
 * Every clue carries one to four stickers, scattered and tilted around the edges
 * of the stage like magnets on a fridge. They are decoration with a job: they give
 * the room something to look at while the question is read, and they make each clue
 * feel like a made object rather than a text slide.
 *
 * The art is generated, keyed and vendored into public/stickers as WebP — see
 * sticker-prompts.csv for the prompt behind each key and tools/key.py for the
 * keying. Vendored rather than hot-linked so nothing depends on a CDN mid-game.
 *
 * Each piece is drawn in the printing technique that suits the thing it is — litho
 * card, matchbox label, risograph, enamel tin sign, embroidered patch, woodblock,
 * Ben-Day comic — with its own palette. That variety is the point: a fridge door is
 * never one sticker pack. The thin white die-cut edge is what holds it together.
 *
 * Postcards are art like everything else, keyed by a `postcard-` prefix. They used
 * to be built from HTML and type, along with a pennant, a rosette, a luggage tag, a
 * ticket stub and a postage stamp, and they all came to the same thing: a flat shape
 * with a word on it, which read as a prop.
 *
 * ONE RULE: a sticker must never answer the question. It can set the scene the
 * question lives in, but a Brazilian flag on "which nation has played every World
 * Cup" hands over the point. Where the answer is a teammate this is free — no
 * object gives away a person — so the general-knowledge clues are where to look
 * twice.
 */

/** Art available in public/stickers. The union below makes a typo a build error. */
export const STICKER_KEYS = [
  'automobile', 'ball-soccer', 'bamboo', 'bandage', 'barn', 'baseball', 'basketball', 'bed',
  'beer', 'bicycle', 'brownie', 'camping', 'canoe', 'cat', 'clapper', 'classical-building',
  'clock', 'coat', 'cocktail', 'coffee', 'compass', 'couch', 'crown', 'crutch',
  'cut-of-meat', 'deer', 'dress-shoe', 'egg', 'film', 'fire', 'football', 'fountain-pen',
  'frog', 'gem', 'ghost', 'gi', 'glasses', 'globe', 'goblet', 'golf', 'guitar',
  'heart-pink', 'helmet', 'house-garden', 'inkwell', 'keyboard', 'lantern', 'laptop',
  'luggage', 'medal', 'mic', 'money-bag', 'mountain-snow', 'mouse', 'movie-camera',
  'musical-notes', 'newspaper', 'oil-drum', 'open-book', 'palm', 'palms-up', 'pine',
  'popcorn', 'postcard-arctic-circle', 'postcard-china', 'postcard-green-bay',
  'postcard-india', 'postcard-japan', 'postcard-lagos', 'postcard-madagascar', 'pushpin',
  'rabbit', 'remote', 'ring', 'rose', 'running-shoe', 'ship', 'skate', 'skis', 'snowflake',
  'snowman', 'soccer-boot', 'spotlight', 'stadium', 'star', 'stethoscope', 'sun-umbrella',
  'swords', 'teddy-bear', 'tennis', 'test-tube', 'top-hat', 'trophy', 'tshirt', 'tv',
  'videogame', 'volcano', 'wand', 'water-wave', 'whistle', 'wine', 'world-map',
] as const

export type StickerKey = (typeof STICKER_KEYS)[number]

/** Where the art lives. One place, so the preloader and the renderer agree. */
export const stickerSrc = (key: StickerKey) => `/stickers/${key}.webp`

/**
 * One sticker: a key into the art above, or that key with an explicit size.
 *
 * The size box is a width, so a wide landscape piece comes out short — the estate
 * car is 2.3:1, which in a 124px box is 54px tall and reads as an afterthought next
 * to a square sticker of the same nominal size. `scale` is the escape hatch for a
 * piece that deserves more room than the default gives it.
 */
export type Emphasis = { art: StickerKey; scale: number }
export type Sticker = StickerKey | Emphasis

export const artOf = (s: Sticker): StickerKey => (typeof s === 'string' ? s : s.art)
export const scaleOf = (s: Sticker): number => (typeof s === 'string' ? 1 : s.scale)

/** Postcards are landscape and get a wider box in the scatter. */
export const isWide = (s: Sticker) => artOf(s).startsWith('postcard-')
