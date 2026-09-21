'use client'

/**
 * プレイ画面のロジックをまとめたフック。
 * 盤面の状態・タイマー・保存・ヒントの段階表示をひとまとめに扱う。
 */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { CELL_COUNT, findConflicts, parseGrid } from '../board/board'
import { computeCandidateMasks } from '../candidates/candidateEngine'
import { findHint } from '../hints/hintEngine'
import { buildHintView, emptyHintView } from '../hints/hintView'
import type { Hint } from '../hints/types'
import { createGame, gameReducer } from './gameState'
import type { GameState } from './gameState'
import { saveGame } from './storage'

export const useSudokuGame = (initial: GameState) => {
  const [state, dispatch] = useReducer(gameReducer, initial)
  const [hint, setHint] = useState<Hint | null>(null)
  const [hintStep, setHintStep] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)

  /** 盤面から計算した候補（ヒントで消した分を除く） */
  const autoCandidates = useMemo(() => {
    const masks = computeCandidateMasks(state.grid)
    for (let i = 0; i < CELL_COUNT; i++) masks[i] &= ~state.eliminated[i]
    return masks
  }, [state.grid, state.eliminated])

  const conflicts = useMemo(() => findConflicts(state.grid), [state.grid])

  /** 数字ごとの残り個数 */
  const remaining = useMemo(() => {
    const counts: Record<number, number> = {}
    for (let n = 1; n <= 9; n++) counts[n] = 9
    for (const value of state.grid) {
      if (value !== 0) counts[value] -= 1
    }
    return counts
  }, [state.grid])

  /** 解答と食い違っている入力があるか */
  const hasWrongInput = useMemo(() => {
    const solution = parseGrid(state.puzzle.solution)
    return state.grid.some((value, i) => value !== 0 && value !== solution[i])
  }, [state.grid, state.puzzle.solution])

  const hintView = useMemo(
    () => (hint ? buildHintView(hint, hintStep) : emptyHintView()),
    [hint, hintStep],
  )

  // 盤面が変わったらヒントは作り直す（古い推論を残さない）
  const gridKey = state.grid.join('') + '|' + state.eliminated.join(',')
  const lastGridKey = useRef(gridKey)
  useEffect(() => {
    if (lastGridKey.current !== gridKey) {
      lastGridKey.current = gridKey
      setHint(null)
      setHintStep(0)
      setNotice(null)
    }
  }, [gridKey])

  // タイマー
  useEffect(() => {
    if (state.status === 'solved') return
    const timer = window.setInterval(() => dispatch({ type: 'tick', deltaMs: 1000 }), 1000)
    return () => window.clearInterval(timer)
  }, [state.status])

  // 自動保存（続きから用）
  useEffect(() => {
    saveGame(state)
  }, [state])

  // キーボード操作
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey) {
        if (event.key === 'z') {
          event.preventDefault()
          dispatch({ type: event.shiftKey ? 'redo' : 'undo' })
        }
        return
      }
      if (event.key >= '1' && event.key <= '9') {
        dispatch({ type: 'input', value: Number(event.key) })
      } else if (event.key === 'Backspace' || event.key === 'Delete' || event.key === '0') {
        dispatch({ type: 'erase' })
      } else if (event.key === ' ') {
        event.preventDefault()
        dispatch({ type: 'toggleMode' })
      } else if (state.selected !== null) {
        const moves: Record<string, number> = {
          ArrowLeft: -1,
          ArrowRight: 1,
          ArrowUp: -9,
          ArrowDown: 9,
        }
        const delta = moves[event.key]
        if (delta === undefined) return
        event.preventDefault()
        const next = state.selected + delta
        if (next >= 0 && next < CELL_COUNT) dispatch({ type: 'select', index: next })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [state.selected])

  const requestHint = useCallback(() => {
    if (hint) {
      setHintStep((step) => Math.min(step + 1, 2))
      return
    }
    if (conflicts.size > 0) {
      setNotice('同じ行・列・ブロックに同じ数字が入っています。まず重複を直してみましょう。')
      return
    }
    if (hasWrongInput) {
      setNotice('入力した数字のどれかが正解と違うようです。あやしいマスを見直してみましょう。')
      return
    }
    const found = findHint(state.grid, state.eliminated)
    if (!found) {
      setNotice('実装済みの定石では次の一手が見つかりませんでした。')
      return
    }
    setHint(found)
    setHintStep(0)
    setNotice(null)
    dispatch({ type: 'countHint' })
  }, [hint, conflicts.size, hasWrongInput, state.grid, state.eliminated])

  const nextHintStep = useCallback(() => setHintStep((step) => Math.min(step + 1, 2)), [])

  const applyHint = useCallback(() => {
    if (!hint) return
    dispatch({ type: 'applyHint', hint })
    setHint(null)
    setHintStep(0)
  }, [hint])

  const closeHint = useCallback(() => {
    setHint(null)
    setHintStep(0)
    setNotice(null)
  }, [])

  const restart = useCallback(() => {
    dispatch({ type: 'restart' })
    closeHint()
  }, [closeHint])

  return {
    state,
    dispatch,
    autoCandidates,
    conflicts,
    remaining,
    hint,
    hintStep,
    hintView,
    notice,
    requestHint,
    nextHintStep,
    applyHint,
    closeHint,
    restart,
  }
}

export { createGame }
