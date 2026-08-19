import { useEffect, useState } from 'react'
import { unlockAudio } from '../audio/sfx'

const KEY = 'julius-trivia:sound'

export function useSoundPref(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(() => localStorage.getItem(KEY) !== 'off')
  const set = (next: boolean) => {
    localStorage.setItem(KEY, next ? 'on' : 'off')
    setOn(next)
    if (next) unlockAudio()
  }
  return [on, set]
}

/**
 * Sound lives on the presentation screen only, so this control does too.
 *
 * It doubles as the autoplay unlock. The presentation window is opened
 * programmatically, so it has had no click of its own and the browser keeps its
 * audio suspended — something has to be pressed in *that* window, and saying so
 * plainly beats silently having no sound all night.
 */
export function SoundToggle() {
  const [on, setOn] = useSoundPref()
  const [locked, setLocked] = useState(true)

  useEffect(() => {
    if (!on) return
    setLocked(!unlockAudio())
  }, [on])

  // Any click in this window satisfies the browser, so take the first one.
  useEffect(() => {
    if (!locked) return
    const once = () => {
      if (unlockAudio()) setLocked(false)
    }
    document.addEventListener('click', once)
    return () => document.removeEventListener('click', once)
  }, [locked])

  if (on && locked) {
    return (
      <button
        className="soundbtn needs-unlock"
        onClick={() => setLocked(!unlockAudio())}
      >
        Turn on sound
      </button>
    )
  }

  return (
    <button
      className={`soundbtn${on ? ' on' : ''}`}
      onClick={() => setOn(!on)}
      aria-pressed={on}
    >
      {on ? 'Sound on' : 'Sound off'}
    </button>
  )
}
