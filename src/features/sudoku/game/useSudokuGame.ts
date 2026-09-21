'use client'

/**
 * プレイ画面のロジックをまとめたフック。
 * 盤面の状態・タイマー・保存・ヒントの段階表示をひとまとめに扱う。
 */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { CELL_COUNT } from '../board/board'
import { computeCandidateMasks } from '../candidates/candidateEngine'
import { analyze, findHint } from '../hints/hintEngine'
import { buildHintView, emptyHintView } from '../hints/hintView'
import type { Hint } from '../hints/types'
import { placedDigit, soundForTransition } from '../../audio/gameSounds'
import { playSound } from '../../audio/sounds'
import {
  autoFillTargets,
  canAutoFill,
  correctCount,
  createGame,
  gameReducer,
  isWrongAt,
} from './gameState'
import type { GameAction, GameState } from './gameState'
import { saveGame } from './storage'

/** 自動入力で1マスずつ埋めていく間隔（ミリ秒）。音が旋律として聞こえる速さにしてある */
const AUTO_FILL_STEP_MS = 180

export const useSudokuGame = (
  initial: GameState,
  options: { autoFillThreshold?: number } = {},
) => {
  const { autoFillThreshold = 0 } = options
  const [state, rawDispatch] = useReducer(gameReducer, initial)
  const [hint, setHint] = useState<Hint | null>(null)
  const [hintStep, setHintStep] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)

  /**
   * 効果音は「直前の状態」と「今の状態」を比べて鳴らす。
   * reducer は純粋なままにしておきたいので、ここで面倒を見る。
   */
  const lastActionRef = useRef<GameAction | null>(null)
  const previousStateRef = useRef<GameState | null>(null)

  const dispatch = useCallback((action: GameAction) => {
    lastActionRef.current = action
    rawDispatch(action)
  }, [])

  useEffect(() => {
    const previous = previousStateRef.current
    const action = lastActionRef.current
    previousStateRef.current = state
    if (!previous || !action) return
    const sound = soundForTransition(action, previous, state)
    if (sound) playSound(sound, { digit: placedDigit(previous, state) })
  }, [state])

  /** 盤面から計算した候補（ヒントで消した分を除く） */
  const autoCandidates = useMemo(() => {
    const masks = computeCandidateMasks(state.grid)
    for (let i = 0; i < CELL_COUNT; i++) masks[i] &= ~state.eliminated[i]
    return masks
  }, [state.grid, state.eliminated])

  /**
   * 不正解の数字が入っているマス。答え合わせありなので、その場で赤く見せる。
   * 重複は必ずどこかに不正解を含むので、重複の検出もこれで兼ねる。
   */
  const wrongCells = useMemo(() => {
    const cells = new Set<number>()
    for (let i = 0; i < CELL_COUNT; i++) {
      if (isWrongAt(state, i)) cells.add(i)
    }
    return cells
    // state 全体ではなく盤面と問題だけに依存させる（タイマーのたびに作り直さないため）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.grid, state.puzzle])

  /** 数字ごとの残り個数。不正解は数えず「あと何個正しく置けばよいか」を出す */
  const remaining = useMemo(() => {
    const counts: Record<number, number> = {}
    for (let n = 1; n <= 9; n++) counts[n] = 9 - correctCount(state, n)
    return counts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.grid, state.puzzle])

  /** この問題を解くのに必要だった定石（クリア画面で振り返る） */
  const requiredTechniques = useMemo(
    () => (state.status === 'solved' ? analyze(state.givens).techniques : []),
    [state.status, state.givens],
  )

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
    if (state.status === 'solved' || state.paused) return
    const timer = window.setInterval(() => dispatch({ type: 'tick', deltaMs: 1000 }), 1000)
    return () => window.clearInterval(timer)
  }, [state.status, state.paused, dispatch])

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
        const value = Number(event.key)
        // 数字優先モードでは、数字キーは「その数字を選ぶ」操作になる
        dispatch(
          state.inputStyle === 'digit'
            ? { type: 'selectDigit', digit: value }
            : { type: 'input', value },
        )
      } else if (event.key === 'Backspace' || event.key === 'Delete' || event.key === '0') {
        dispatch(
          state.inputStyle === 'digit' ? { type: 'selectDigit', digit: 'erase' } : { type: 'erase' },
        )
      } else if (event.key === ' ') {
        event.preventDefault()
        dispatch({ type: 'toggleMode' })
      } else if (event.key === 'Escape') {
        dispatch({ type: 'selectDigit', digit: null })
      } else if (event.key === 'Enter' && state.selected !== null) {
        event.preventDefault()
        dispatch({ type: 'tapCell', index: state.selected })
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
  }, [state.selected, state.inputStyle, dispatch])

  const requestHint = useCallback(() => {
    if (hint) {
      setHintStep((step) => Math.min(step + 1, 2))
      return
    }
    // 不正解が残っていると推論の前提が崩れるので、先に直してもらう
    if (wrongCells.size > 0) {
      setNotice('赤いマスの数字が間違っています。直してからもう一度ヒントを押してください。')
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
    dispatch({ type: 'countHint', technique: found.technique })
  }, [hint, wrongCells.size, state.grid, state.eliminated, dispatch])

  const nextHintStep = useCallback(() => setHintStep((step) => Math.min(step + 1, 2)), [])

  const applyHint = useCallback(() => {
    if (!hint) return
    dispatch({ type: 'applyHint', hint })
    setHint(null)
    setHintStep(0)
  }, [hint, dispatch])

  const closeHint = useCallback(() => {
    setHint(null)
    setHintStep(0)
    setNotice(null)
  }, [])

  /**
   * 終盤の自動入力。始めたら、空きマスを左上から一定の間隔で1つずつ埋める。
   * 一度に埋めずに間を空けるのは、完成の演出と音階の旋律を順に見せるため。
   * 休憩・クリア・不正解が出たら止める。
   */
  const [autoFilling, setAutoFilling] = useState(false)
  const autoFillAvailable = canAutoFill(state, autoFillThreshold)

  const startAutoFill = useCallback(() => {
    if (autoFillAvailable) setAutoFilling(true)
  }, [autoFillAvailable])

  useEffect(() => {
    if (!autoFilling) return
    const timer = window.setTimeout(() => {
      const target = autoFillTargets(state)[0]
      const stop =
        target === undefined || state.status === 'solved' || state.paused || wrongCells.size > 0
      if (stop) {
        setAutoFilling(false)
        return
      }
      dispatch({ type: 'autoFill', index: target })
    }, AUTO_FILL_STEP_MS)
    return () => window.clearTimeout(timer)
  }, [autoFilling, state, wrongCells.size, dispatch])

  const restart = useCallback(() => {
    dispatch({ type: 'restart' })
    setAutoFilling(false)
    closeHint()
  }, [closeHint, dispatch])

  return {
    state,
    dispatch,
    autoCandidates,
    wrongCells,
    remaining,
    requiredTechniques,
    hint,
    hintStep,
    hintView,
    notice,
    requestHint,
    nextHintStep,
    applyHint,
    closeHint,
    restart,
    autoFillAvailable,
    autoFilling,
    startAutoFill,
  }
}

export { createGame }
