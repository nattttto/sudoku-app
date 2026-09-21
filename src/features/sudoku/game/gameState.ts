/**
 * ゲーム状態とその更新（Phase 1: 入力・Undo/Redo・リスタート）。
 *
 * 盤面の数字・ユーザーの候補メモ・ヒントで消した候補をまとめて1つの状態として扱い、
 * 変更のたびにスナップショットを積むことで Undo / Redo を実現する。
 */
import {
  CELL_COUNT,
  PEERS,
  findConflicts,
  isSolved,
  parseCellId,
  parseGrid,
} from '../board/board'
import { bit, maskToNumbers } from '../candidates/candidateEngine'
import type { Grid, Puzzle } from '../board/types'
import type { Hint } from '../hints/types'

export type InputMode = 'value' | 'note'
export type GameStatus = 'playing' | 'solved'

/** Undo / Redo で戻せる範囲の状態 */
export type Snapshot = {
  grid: Grid
  /** ユーザーが手で書いた候補メモ（ビットマスク） */
  notes: number[]
  /** ヒントの適用で消した候補（ビットマスク） */
  eliminated: number[]
}

export type GameState = Snapshot & {
  puzzle: Puzzle
  /** 問題の初期状態（リスタート用） */
  givens: Grid
  selected: number | null
  mode: InputMode
  /** 自動候補の表示 */
  showCandidates: boolean
  past: Snapshot[]
  future: Snapshot[]
  elapsedMs: number
  status: GameStatus
  /** ヒントを使った回数 */
  hintCount: number
}

export type GameAction =
  | { type: 'select'; index: number | null }
  | { type: 'setMode'; mode: InputMode }
  | { type: 'toggleMode' }
  | { type: 'toggleCandidates' }
  | { type: 'input'; value: number }
  | { type: 'erase' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'restart' }
  | { type: 'tick'; deltaMs: number }
  | { type: 'applyHint'; hint: Hint }
  | { type: 'countHint' }
  | { type: 'load'; state: GameState }

const emptyMasks = (): number[] => new Array<number>(CELL_COUNT).fill(0)

const snapshotOf = (state: Snapshot): Snapshot => ({
  grid: state.grid.slice(),
  notes: state.notes.slice(),
  eliminated: state.eliminated.slice(),
})

export const createGame = (puzzle: Puzzle): GameState => {
  const givens = parseGrid(puzzle.givens)
  return {
    puzzle,
    givens,
    grid: givens.slice(),
    notes: emptyMasks(),
    eliminated: emptyMasks(),
    selected: null,
    mode: 'value',
    showCandidates: false,
    past: [],
    future: [],
    elapsedMs: 0,
    status: 'playing',
    hintCount: 0,
  }
}

/** そのマスが問題の初期数字（編集不可）か */
export const isGiven = (state: GameState, index: number): boolean => state.givens[index] !== 0

/** 重複しているマスの集合 */
export const conflictsOf = (state: GameState): Set<number> => findConflicts(state.grid)

/** ユーザーの候補メモを数字配列で取り出す */
export const notesOf = (state: GameState, index: number): number[] =>
  maskToNumbers(state.notes[index])

/** 変更を記録して新しい状態を返す */
const commit = (state: GameState, next: Partial<Snapshot>): GameState => {
  const merged: Snapshot = {
    grid: next.grid ?? state.grid,
    notes: next.notes ?? state.notes,
    eliminated: next.eliminated ?? state.eliminated,
  }
  return {
    ...state,
    ...merged,
    past: [...state.past, snapshotOf(state)],
    future: [],
    status: isSolved(merged.grid) ? 'solved' : 'playing',
  }
}

/**
 * 数字を入力する。
 * 数字を確定させると候補の前提が変わるため、ヒントで消した候補はリセットする
 * （消去の根拠が現在の盤面と食い違わないようにするため）。
 */
const inputValue = (state: GameState, index: number, value: number): GameState => {
  const grid = state.grid.slice()
  const notes = state.notes.slice()

  if (grid[index] === value) {
    // 同じ数字をもう一度押したら消す
    grid[index] = 0
  } else {
    grid[index] = value
    notes[index] = 0
    // 同じ行・列・ブロックのメモから、入れた数字を自動で取り除く
    for (const peer of PEERS[index]) {
      notes[peer] &= ~bit(value)
    }
  }

  return commit(state, { grid, notes, eliminated: emptyMasks() })
}

const inputNote = (state: GameState, index: number, value: number): GameState => {
  if (state.grid[index] !== 0) return state
  const notes = state.notes.slice()
  notes[index] ^= bit(value)
  return commit(state, { notes })
}

export const gameReducer = (state: GameState, action: GameAction): GameState => {
  switch (action.type) {
    case 'select':
      return { ...state, selected: action.index }

    case 'setMode':
      return { ...state, mode: action.mode }

    case 'toggleMode':
      return { ...state, mode: state.mode === 'value' ? 'note' : 'value' }

    case 'toggleCandidates':
      return { ...state, showCandidates: !state.showCandidates }

    case 'input': {
      const index = state.selected
      if (index === null || isGiven(state, index) || state.status === 'solved') return state
      return state.mode === 'value'
        ? inputValue(state, index, action.value)
        : inputNote(state, index, action.value)
    }

    case 'erase': {
      const index = state.selected
      if (index === null || isGiven(state, index) || state.status === 'solved') return state
      if (state.grid[index] === 0 && state.notes[index] === 0) return state
      const grid = state.grid.slice()
      const notes = state.notes.slice()
      grid[index] = 0
      notes[index] = 0
      return commit(state, { grid, notes, eliminated: emptyMasks() })
    }

    case 'undo': {
      const previous = state.past.at(-1)
      if (!previous) return state
      return {
        ...state,
        ...previous,
        past: state.past.slice(0, -1),
        future: [snapshotOf(state), ...state.future],
        status: isSolved(previous.grid) ? 'solved' : 'playing',
      }
    }

    case 'redo': {
      const next = state.future[0]
      if (!next) return state
      return {
        ...state,
        ...next,
        past: [...state.past, snapshotOf(state)],
        future: state.future.slice(1),
        status: isSolved(next.grid) ? 'solved' : 'playing',
      }
    }

    case 'restart':
      return {
        ...createGame(state.puzzle),
        mode: state.mode,
        showCandidates: state.showCandidates,
      }

    case 'tick':
      if (state.status === 'solved') return state
      return { ...state, elapsedMs: state.elapsedMs + action.deltaMs }

    case 'countHint':
      return { ...state, hintCount: state.hintCount + 1 }

    case 'applyHint': {
      const { hint } = action
      if (hint.targetCell && hint.value !== undefined) {
        const index = parseCellId(hint.targetCell)
        if (index < 0) return state
        return { ...inputValue(state, index, hint.value), selected: index }
      }
      if (hint.eliminations.length > 0) {
        const eliminated = state.eliminated.slice()
        const notes = state.notes.slice()
        for (const e of hint.eliminations) {
          const index = parseCellId(e.cell)
          if (index < 0) continue
          eliminated[index] |= bit(e.value)
          // 手書きメモからも消しておく
          notes[index] &= ~bit(e.value)
        }
        return commit(state, { eliminated, notes })
      }
      return state
    }

    case 'load':
      return action.state

    default:
      return state
  }
}
