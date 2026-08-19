import { Fragment } from 'react'
import { TEAMMATES } from '../data'

/** Longest first, so "Hannah" cannot be shadowed by a shorter name inside it. */
const NAME_RE = new RegExp(
  `\\b(${[...TEAMMATES]
    .sort((a, b) => b.length - a.length)
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')})\\b`,
  'g',
)

/**
 * Renders text with teammate names picked out, so "Hattie's specialty" reads as
 * being about a person rather than as a run of grey words.
 *
 * Case-sensitive and word-bounded: names are capitalised, and matching loosely
 * would light up the word "ask" in ordinary prose.
 */
export function WithNames({ text }: { text: string }) {
  const parts = text.split(NAME_RE)
  return (
    <>
      {parts.map((part, i) =>
        // split() puts captured groups at odd indices.
        i % 2 === 1 ? (
          <span className="pname" key={i}>{part}</span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  )
}
