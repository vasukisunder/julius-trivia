import { useEffect, useRef } from 'react'
import type { GameState } from '../types'
import { play, playBuzz } from './sfx'

/**
 * Fires sound cues off changes in shared game state.
 *
 * Mounted ONLY on the presentation screen. Sound belongs to the one machine whose
 * audio the room hears; the host's laptop and fourteen phones all chiming at once
 * would be unusable.
 *
 * Cues are driven by transitions rather than by the click that caused them, so
 * the shared screen stays in step with the host even though it never handles the
 * interaction itself.
 */
export function useGameSounds(state: GameState, enabled: boolean) {
  const prev = useRef({
    openKey: null as string | null,
    cluePhase: state.cluePhase,
    buzzCount: 0,
    awardSeq: state.lastAward?.seq ?? 0,
    wrongSeq: state.lastWrong?.seq ?? 0,
    drawSeq: state.drawSeq,
    phase: state.phase,
  })

  useEffect(() => {
    const p = prev.current
    const openKey = state.open ? `${state.open.categoryIndex}-${state.open.clueIndex}` : null

    if (enabled) {
      if (openKey && openKey !== p.openKey) play('select')
      if (state.cluePhase === 'buzzing' && p.cluePhase !== 'buzzing') play('buzzOpen')
      // Only when the clock ran out rather than someone answering.
      if (p.cluePhase === 'buzzing' && state.cluePhase === 'verdict') play('timeUp')
      if (state.buzzes.length > p.buzzCount) playBuzz(state.buzzes.length - 1)
      if ((state.lastAward?.seq ?? 0) > p.awardSeq) play('correct')
      if ((state.lastWrong?.seq ?? 0) > p.wrongSeq) play('wrong')
      if (state.drawSeq > p.drawSeq) play('shuffle')
      if (p.phase === 'draft' && state.phase === 'board') play('start')
    }

    prev.current = {
      openKey,
      cluePhase: state.cluePhase,
      buzzCount: state.buzzes.length,
      awardSeq: state.lastAward?.seq ?? 0,
      wrongSeq: state.lastWrong?.seq ?? 0,
      drawSeq: state.drawSeq,
      phase: state.phase,
    }
  }, [
    state.open, state.cluePhase, state.buzzes.length, state.lastAward?.seq,
    state.lastWrong?.seq, state.drawSeq, state.phase, enabled,
  ])

  // Ticks over the closing seconds. Driven off the shared deadline, so the beats
  // land where the number changes on screen.
  const lastTick = useRef<number | null>(null)
  useEffect(() => {
    if (!enabled || state.timerEndsAt === null) {
      lastTick.current = null
      return
    }
    const id = window.setInterval(() => {
      const left = Math.ceil((state.timerEndsAt! - Date.now()) / 1000)
      if (left > 0 && left <= 5 && left !== lastTick.current) {
        lastTick.current = left
        play('tick')
      }
    }, 120)
    return () => clearInterval(id)
  }, [enabled, state.timerEndsAt])
}
