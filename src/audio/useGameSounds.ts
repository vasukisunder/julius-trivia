import { useEffect, useRef } from 'react'
import type { GameState } from '../types'
import { play, playBuzz, playThinkStep, THINK_STEP_MS } from './sfx'

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
    ceremony: state.ceremony,
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
      if (p.ceremony !== 'winner' && state.ceremony === 'winner') play('fanfare')
    }

    prev.current = {
      openKey,
      cluePhase: state.cluePhase,
      buzzCount: state.buzzes.length,
      awardSeq: state.lastAward?.seq ?? 0,
    ceremony: state.ceremony,
      wrongSeq: state.lastWrong?.seq ?? 0,
      drawSeq: state.drawSeq,
      phase: state.phase,
    }
  }, [
    state.open, state.cluePhase, state.buzzes.length, state.lastAward?.seq,
    state.lastWrong?.seq, state.drawSeq, state.phase, state.ceremony, enabled,
  ])

  /** One beat per number of the closing countdown. */
  const lastBeat = useRef<number | null>(null)
  useEffect(() => {
    if (!enabled || state.ceremony !== 'countdown' || state.ceremonyEndsAt === null) {
      lastBeat.current = null
      return
    }
    const id = window.setInterval(() => {
      const left = Math.ceil((state.ceremonyEndsAt! - Date.now()) / 1000)
      if (left > 0 && left !== lastBeat.current) {
        lastBeat.current = left
        play('countIn')
      }
    }, 100)
    return () => clearInterval(id)
  }, [enabled, state.ceremony, state.ceremonyEndsAt])

  /**
   * The thinking loop, for the whole buzzer window. Steady tempo on purpose: it is
   * there to fill the silence and mark time passing, not to hurry anyone.
   */
  const beat = useRef(0)
  useEffect(() => {
    const endsAt = state.timerEndsAt
    if (!enabled || endsAt === null || state.cluePhase !== 'buzzing') return

    const total = (endsAt - Date.now()) / 1000
    beat.current = 0

    const id = window.setInterval(() => {
      const left = (endsAt - Date.now()) / 1000
      if (left <= 0) return
      const progress = total > 0 ? Math.min(1, Math.max(0, 1 - left / total)) : 0
      playThinkStep(beat.current++, progress)
    }, THINK_STEP_MS)

    return () => clearInterval(id)
  }, [enabled, state.timerEndsAt, state.cluePhase])
}
