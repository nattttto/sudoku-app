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
  canPlace,
  findConflicts,
  isSolved,
  parseCellId,
  parseGrid,
  unitIndices,
  unitsOf,
} from '../board/board'
import { bit, computeCandidateMasks, maskToNumbers } from '../candidates/candidateEngine'
import type { Grid, Puzzle, Unit } from '../board/types'
import type { Hint, TechniqueId } from '../hints/types'

/** 数字として入れるか、候補メモとして入れるか */
export type InputMode = 'value' | 'note'
/** マス優先か、数字優先か */
export type InputStyle = 'cell' | 'digit'
/** 数字優先モードで選択中のもの。'erase' は消しゴム */
export type DigitSelection = number | 'erase' | null

export type GameStatus = 'playing' | 'solved'

/**
 * ブロック・行・列を正しく埋め切ったときの演出情報。
 * 演出は一瞬で終わるが、状態として持っておくことで
 * reducer を純粋なまま「いま何が起きたか」を画面と効果音に伝えられる。
 */
export type Celebration = {
  /** 今回の一手で完成したユニット（ブロック → 行 → 列 の順） */
  units: Unit[]
  /** 最後に数字を置いたマス。演出はここから波のように広がる */
  origin: number
  /** 今回の一手で9個すべて正しく置き終えた数字。無ければ null */
  digit: number | null
}

/**
 * 受け付けられなかった操作（ありえないメモなど）。
 * 黙って無視すると押せていないのか分からないので、マスを揺らして音で知らせる。
 * id は同じマスで続けて起きても演出をやり直せるよう、毎回増やす。
 */
export type Rejection = {
  index: number
  id: number
}

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
  /** ヒントで見た定石とその回数（プレイ記録に残す） */
  hintTechniques: Partial<Record<TechniqueId, number>>
  /** 解答と違う数字を入れた回数 */
  mistakes: number
  /** デイリー数独として遊んでいる場合の日付（YYYY-MM-DD） */
  dailyDate?: string
  /** 直前にブロック・行・列を完成させたときの演出。無ければ null */
  celebration: Celebration | null
  /** 直前に受け付けなかった操作。無ければ null */
  rejection: Rejection | null
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
  | { type: 'countHint'; technique: TechniqueId }
  /** 終盤の自動入力。選択に関係なく、指定のマスに正解を置く */
  | { type: 'autoFill'; index: number }
  | { type: 'load'; state: GameState }

const emptyMasks = (): number[] => new Array<number>(CELL_COUNT).fill(0)

const snapshotOf = (state: Snapshot): Snapshot => ({
  grid: state.grid.slice(),
  notes: state.notes.slice(),
  eliminated: state.eliminated.slice(),
})

export const createGame = (puzzle: Puzzle, dailyDate?: string): GameState => {
  const givens = parseGrid(puzzle.givens)
  return {
    puzzle,
    givens,
    dailyDate,
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
    hintTechniques: {},
    mistakes: 0,
    celebration: null,
    rejection: null,
  }
}

/** そのマスの正解の数字 */
export const solutionAt = (state: GameState, index: number): number =>
  state.puzzle.solution.charCodeAt(index) - 48

/**
 * 入っている数字が不正解のマス。
 * このアプリは答え合わせありなので、不正解はその場で赤く見せる。
 */
export const isWrongAt = (state: GameState, index: number): boolean =>
  state.grid[index] !== 0 && state.grid[index] !== solutionAt(state, index)

/** その数字を正しく置けた個数 */
export const correctCount = (state: GameState, n: number): number => {
  let count = 0
  for (let i = 0; i < CELL_COUNT; i++) {
    if (state.grid[i] === n && solutionAt(state, i) === n) count++
  }
  return count
}

/** その数字を9個すべて正しく置き終えたか */
export const isDigitComplete = (state: GameState, n: number): boolean =>
  correctCount(state, n) === 9

/** 解答（puzzle.solution）と照らして、その手が間違いか */
const isWrongMove = (state: GameState, index: number, value: number): boolean =>
  solutionAt(state, index) !== value

/** そのマスが問題の初期数字（編集不可）か */
export const isGiven = (state: GameState, index: number): boolean => state.givens[index] !== 0

/**
 * そのマスが確定済みか。
 * 問題の初期数字に加えて、プレイヤーが正解を入れたマスも確定として扱い、
 * それ以上は書き換えられないようにする。
 */
export const isSettled = (state: GameState, index: number): boolean =>
  isGiven(state, index) ||
  (state.grid[index] !== 0 && state.grid[index] === solutionAt(state, index))

/**
 * そのマスにメモとして書き込めるか。
 * 同じ行・列・ブロックにすでにある数字はメモできない（ありえない候補になるため）。
 * すでに書いてあるメモを外す操作は、いつでも許す。
 */
export const canAddNote = (state: GameState, index: number, value: number): boolean =>
  state.grid[index] === 0 && canPlace(state.grid, index, value)

/** 終盤の自動入力で埋めるマス（空きマス）。盤面の左上から順に並ぶ */
export const autoFillTargets = (state: GameState): number[] => {
  const targets: number[] = []
  for (let i = 0; i < CELL_COUNT; i++) if (state.grid[i] === 0) targets.push(i)
  return targets
}

/**
 * 終盤の自動入力を始められるか。
 * 空きマスが threshold 以下で、不正解が残っていないときだけ。
 * 不正解を残したまま埋めると、どこを間違えたかを本人が確かめる機会が無くなるため。
 * threshold が 0 なら自動入力は使わない設定。
 */
export const canAutoFill = (state: GameState, threshold: number): boolean => {
  if (threshold <= 0 || state.status === 'solved' || state.paused) return false
  let empty = 0
  for (let i = 0; i < CELL_COUNT; i++) {
    if (state.grid[i] === 0) empty++
    else if (isWrongAt(state, i)) return false
  }
  return empty > 0 && empty <= threshold
}

/** そのユニットが正解どおりにすべて埋まっているか */
const isUnitComplete = (state: GameState, grid: Grid, unit: Unit): boolean =>
  unitIndices(unit).every((i) => grid[i] === solutionAt(state, i))

/** そのマスを含むユニットのうち、正解で埋まっているもの（ブロック → 行 → 列） */
const completedUnitsAt = (state: GameState, grid: Grid, index: number): Unit[] => {
  const [row, col, box] = unitsOf(index)
  return [box, row, col].filter((unit) => isUnitComplete(state, grid, unit))
}

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
  const removing = grid[index] === value

  if (removing) {
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

  const next = commit(state, { grid, notes, eliminated: emptyMasks() })
  if (removing) return next

  // 間違えた手は Undo しても記録上は消さない（実際に間違えたことは変わらないため）
  if (isWrongMove(state, index, value)) {
    return { ...next, mistakes: state.mistakes + 1 }
  }

  // 正解でブロック・行・列が埋まったり、数字を9個とも置き終えたら演出する。
  // クリアのときはクリアの演出を優先する
  if (next.status !== 'solved') {
    const units = completedUnitsAt(state, grid, index)
    const digit = isDigitComplete(next, value) ? value : null
    if (units.length > 0 || digit !== null) {
      return { ...next, celebration: { units, origin: index, digit } }
    }
  }
  return next
}

/** 操作を受け付けなかったことを記録する（画面と音で知らせるため） */
const reject = (state: GameState, index: number): GameState => ({
  ...state,
  rejection: { index, id: (state.rejection?.id ?? 0) + 1 },
})

const inputNote = (state: GameState, index: number, value: number): GameState => {
  if (state.grid[index] !== 0) return state
  const adding = (state.notes[index] & bit(value)) === 0
  // ありえない候補は書かせない。外すほうはいつでもできる
  if (adding && !canAddNote(state, index, value)) return reject(state, index)
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
  isSettled(state, index) || state.status === 'solved' || state.paused

/**
 * 盤面が変わったあとの後始末。
 * 数字優先で選んでいた数字を9個とも正しく置き終えたら、選択を外す
 * （もう置く場所が無いのに選ばれたままだと、次に何を押せばよいか迷うため）。
 */
export const gameReducer = (state: GameState, action: GameAction): GameState => {
  const next = reduce(state, action)
  if (
    next.grid !== state.grid &&
    typeof next.activeDigit === 'number' &&
    isDigitComplete(next, next.activeDigit)
  ) {
    return { ...next, activeDigit: null }
  }
  return next
}

const reduce = (state: GameState, action: GameAction): GameState => {
  switch (action.type) {
    case 'select':
      return { ...state, selected: action.index }

    case 'tapCell': {
      const index = action.index
      // マス優先では、選択するだけ
      if (state.inputStyle === 'cell') return { ...state, selected: index }

      const selectedState = { ...state, selected: index }
      const value = state.grid[index]

      // 数字優先で、数字の入っているマスをタップしたら、その数字を選ぶ。
      // ただし間違えた数字のマスは、数字を選んでいれば書き直しの対象にする
      if (
        value !== 0 &&
        state.activeDigit !== 'erase' &&
        (isSettled(state, index) || state.activeDigit === null)
      ) {
        return isDigitComplete(state, value)
          ? selectedState
          : { ...selectedState, activeDigit: value }
      }

      if (state.activeDigit === null || isLocked(state, index)) return selectedState
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
      // 置き終えた数字は選べない
      if (typeof action.digit === 'number' && isDigitComplete(state, action.digit)) return state
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

    case 'autoFill': {
      const index = action.index
      if (state.grid[index] !== 0 || isLocked(state, index)) return state
      return inputValue(state, index, solutionAt(state, index))
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
        celebration: null,
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
        celebration: null,
      }
    }

    case 'restart':
      return {
        ...createGame(state.puzzle, state.dailyDate),
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
      return {
        ...state,
        hintCount: state.hintCount + 1,
        hintTechniques: {
          ...state.hintTechniques,
          [action.technique]: (state.hintTechniques[action.technique] ?? 0) + 1,
        },
      }

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
