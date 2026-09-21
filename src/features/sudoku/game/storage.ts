/**
 * ローカル保存（仕様書 19章）。
 * MVP ではサーバーに保存せず、ブラウザの localStorage だけで完結させる。
 */
import type { GameState } from './gameState'
import type { Difficulty, Puzzle } from '../board/types'

const KEY = 'sudoku:saved-game:v1'

/** 保存する形。関数や巨大な履歴は持たせない */
type SavedGame = {
  puzzle: Puzzle
  grid: number[]
  notes: number[]
  eliminated: number[]
  elapsedMs: number
  hintCount: number
  hintTechniques?: GameState['hintTechniques']
  mistakes?: number
  dailyDate?: string
  savedAt: number
}

/** 保存内容が変わったことを購読側に知らせる */
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())

export const subscribeSavedGame = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** ホーム画面の「続きから」に出す要約 */
export type SavedSummary = {
  difficulty: Difficulty
  elapsedMs: number
}

// useSyncExternalStore は同じ内容なら同じ参照を返す必要があるため、
// 生の文字列が変わったときだけ作り直す
let cachedRaw: string | null | undefined
let cachedSummary: SavedSummary | null = null

export const getSavedSummary = (): SavedSummary | null => {
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(KEY)
  } catch {
    raw = null
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw
    const game = loadSavedGame()
    cachedSummary = game
      ? { difficulty: game.puzzle.difficulty, elapsedMs: game.elapsedMs }
      : null
  }
  return cachedSummary
}

/** サーバー描画時は保存データを持たない */
export const getSavedSummaryServer = (): SavedSummary | null => null

export const saveGame = (state: GameState): void => {
  if (typeof window === 'undefined') return
  if (state.status === 'solved') {
    clearSavedGame()
    return
  }
  const payload: SavedGame = {
    puzzle: state.puzzle,
    grid: state.grid,
    notes: state.notes,
    eliminated: state.eliminated,
    elapsedMs: state.elapsedMs,
    hintCount: state.hintCount,
    hintTechniques: state.hintTechniques,
    mistakes: state.mistakes,
    dailyDate: state.dailyDate,
    savedAt: Date.now(),
  }
  try {
    window.localStorage.setItem(KEY, JSON.stringify(payload))
    notify()
  } catch {
    // プライベートモードなどで保存できない場合は黙って諦める
  }
}

export const loadSavedGame = (): SavedGame | null => {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SavedGame
    if (!parsed.puzzle?.givens || parsed.grid?.length !== 81) return null
    return parsed
  } catch {
    return null
  }
}

export const clearSavedGame = (): void => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(KEY)
    notify()
  } catch {
    // 何もしない
  }
}

export type { SavedGame }
