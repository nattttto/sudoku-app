/**
 * ゲーム状態とその更新。
 *
 * 盤面の数字・ユーザーの候補メモ・ヒントで消した候補をまとめて1つの状態として扱い、
 * 変更のたびにスナップショットを積むことで Undo / Redo を実現する。
 *
 * 入力方式は2通りある（inputStyle）。
 *   cell  : マスを選んでから数字を押す
 *   digit : 数字を選んでからマスをタップする（消しゴムも選べる）
 * どちらでも「数字として入れる / メモとして入れる」（mode）を切り替えられる。
 */
import {
  CELL_COUNT,
  PEERS,
  findConflicts,
  isSolved,
  parseCellId,
  parseGrid,
} from '../board/board'
import { bit, computeCandidateMasks, maskToNumbers } from '../candidates/candidateEngine'
import type { Grid, Puzzle } from '../board/types'
import type { Hint } from '../hints/types'

/** 数字として入れるか、候補メモとして入れるか */
export type InputMode = 'value' | 'note'
/** マス優先か、数字優先か */
export type InputStyle = 'cell' | 'digit'
/** 数字優先モードで選択中のもの。'erase' は消しゴム */
export type DigitSelection = number | 'erase' | null

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
  inputStyle: InputStyle
  /** 数字優先モードで選択中の数字 */
  activeDigit: DigitSelection
  /** 自動候補の表示 */
  showCandidates: boolean
  past: Snapshot[]
  future: Snapshot[]
  elapsedMs: number
  paused: boolean
  status: GameStatus
  /** ヒントを使った回数 */
  hintCount: number
}

export type GameAction =
  | { type: 'select'; index: number | null }
  | { type: 'tapCell'; index: number }
  | { type: 'setMode'; mode: InputMode }
  | { type: 'toggleMode' }
  | { type: 'setInputStyle'; style: InputStyle }
  | { type: 'toggleInputStyle' }
  | { type: 'selectDigit'; digit: DigitSelection }
  | { type: 'toggleCandidates' }
  | { type: 'fillAllNotes' }
  | { type: 'clearAllNotes' }
  | { type: 'input'; value: number }
  | { type: 'erase' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'restart' }
  | { type: 'tick'; deltaMs: number }
  | { type: 'togglePause' }
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
    inputStyle: 'cell',
    activeDigit: null,
    showCandidates: false,
    past: [],
    future: [],
    elapsedMs: 0,
    paused: false,
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

const eraseAt = (state: GameState, index: number): GameState => {
  if (state.grid[index] === 0 && state.notes[index] === 0) return state
  const grid = state.grid.slice()
  const notes = state.notes.slice()
  grid[index] = 0
  notes[index] = 0
  return commit(state, { grid, notes, eliminated: emptyMasks() })
}

/** 編集を受け付けない状況か */
const isLocked = (state: GameState, index: number): boolean =>
  isGiven(state, index) || state.status === 'solved' || state.paused

export const gameReducer = (state: GameState, action: GameAction): GameState => {
  switch (action.type) {
    case 'select':
      return { ...state, selected: action.index }

    case 'tapCell': {
      const index = action.index
      // マス優先、または数字を選んでいないときは、選択するだけ
      if (state.inputStyle === 'cell' || state.activeDigit === null) {
        return { ...state, selected: index }
      }
      if (isLocked(state, index)) return { ...state, selected: index }

      const selectedState = { ...state, selected: index }
      if (state.activeDigit === 'erase') return eraseAt(selectedState, index)
      return state.mode === 'value'
        ? inputValue(selectedState, index, state.activeDigit)
        : inputNote(selectedState, index, state.activeDigit)
    }

    case 'setMode':
      return { ...state, mode: action.mode }

    case 'toggleMode':
      return { ...state, mode: state.mode === 'value' ? 'note' : 'value' }

    case 'setInputStyle':
      return {
        ...state,
        inputStyle: action.style,
        // 方式を変えたら選択中の数字は持ち越さない
        activeDigit: action.style === 'cell' ? null : state.activeDigit,
      }

    case 'toggleInputStyle': {
      const style: InputStyle = state.inputStyle === 'cell' ? 'digit' : 'cell'
      return { ...state, inputStyle: style, activeDigit: null }
    }

    case 'selectDigit':
      // 同じものをもう一度押したら選択解除
      return {
        ...state,
        activeDigit: state.activeDigit === action.digit ? null : action.digit,
      }

    case 'toggleCandidates':
      return { ...state, showCandidates: !state.showCandidates }

    case 'fillAllNotes': {
      if (state.status === 'solved' || state.paused) return state
      const masks = computeCandidateMasks(state.grid)
      const notes = state.notes.slice()
      let changed = false
      for (let i = 0; i < CELL_COUNT; i++) {
        if (state.grid[i] !== 0) continue
        const next = masks[i] & ~state.eliminated[i]
        if (notes[i] !== next) {
          notes[i] = next
          changed = true
        }
      }
      return changed ? commit(state, { notes }) : state
    }

    case 'clearAllNotes': {
      if (state.notes.every((n) => n === 0)) return state
      return commit(state, { notes: emptyMasks() })
    }

    case 'input': {
      const index = state.selected
      if (index === null || isLocked(state, index)) return state
      return state.mode === 'value'
        ? inputValue(state, index, action.value)
        : inputNote(state, index, action.value)
    }

    case 'erase': {
      const index = state.selected
      if (index === null || isLocked(state, index)) return state
      return eraseAt(state, index)
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
        // 操作の好みはリスタートしても引き継ぐ
        mode: state.mode,
        inputStyle: state.inputStyle,
        showCandidates: state.showCandidates,
      }

    case 'tick':
      if (state.status === 'solved' || state.paused) return state
      return { ...state, elapsedMs: state.elapsedMs + action.deltaMs }

    case 'togglePause':
      if (state.status === 'solved') return state
      return { ...state, paused: !state.paused }

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
