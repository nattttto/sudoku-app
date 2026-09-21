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
  savedAt: number
}

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
    savedAt: Date.now(),
  }
  try {
    window.localStorage.setItem(KEY, JSON.stringify(payload))
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
  } catch {
    // 何もしない
  }
}

export const savedDifficulty = (): Difficulty | null => loadSavedGame()?.puzzle.difficulty ?? null

export type { SavedGame }
