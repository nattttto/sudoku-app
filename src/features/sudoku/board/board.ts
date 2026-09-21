/**
 * 盤面ユーティリティ。index ⇔ 行/列/ブロック の変換、ピア計算、
 * Grid ⇔ Board ⇔ 文字列 の相互変換をまとめる。
 */
import type { Board, Cell, Grid, Unit, UnitType } from './types'

export const SIZE = 9
export const CELL_COUNT = 81

export const rowOf = (index: number): number => Math.floor(index / SIZE)
export const colOf = (index: number): number => index % SIZE
export const boxOf = (index: number): number =>
  Math.floor(rowOf(index) / 3) * 3 + Math.floor(colOf(index) / 3)

export const indexOf = (row: number, col: number): number => row * SIZE + col

/** "R4C7" 形式のセルID */
export const cellId = (index: number): string => `R${rowOf(index) + 1}C${colOf(index) + 1}`

/** "R4C7" → index。不正な文字列は -1 */
export const parseCellId = (id: string): number => {
  const m = /^R([1-9])C([1-9])$/.exec(id.trim().toUpperCase())
  if (!m) return -1
  return indexOf(Number(m[1]) - 1, Number(m[2]) - 1)
}

/** ユニット（行・列・ブロック）に属する 9 個の index */
export const unitIndices = (unit: Unit): number[] => {
  const out: number[] = []
  if (unit.type === 'row') {
    for (let c = 0; c < SIZE; c++) out.push(indexOf(unit.index, c))
  } else if (unit.type === 'col') {
    for (let r = 0; r < SIZE; r++) out.push(indexOf(r, unit.index))
  } else {
    const baseRow = Math.floor(unit.index / 3) * 3
    const baseCol = (unit.index % 3) * 3
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) out.push(indexOf(baseRow + r, baseCol + c))
    }
  }
  return out
}

/** 全27ユニット */
export const ALL_UNITS: Unit[] = (() => {
  const units: Unit[] = []
  const types: UnitType[] = ['row', 'col', 'box']
  for (const type of types) {
    for (let i = 0; i < SIZE; i++) units.push({ type, index: i })
  }
  return units
})()

/** ユニットの日本語表記 */
export const unitLabel = (unit: Unit): string => {
  if (unit.type === 'row') return `${unit.index + 1}行目`
  if (unit.type === 'col') return `${unit.index + 1}列目`
  return `ブロック${unit.index + 1}`
}

/** index が属する 3 つのユニット */
export const unitsOf = (index: number): Unit[] => [
  { type: 'row', index: rowOf(index) },
  { type: 'col', index: colOf(index) },
  { type: 'box', index: boxOf(index) },
]

/** 同じ行・列・ブロックのセル（自分自身は除く）。事前計算する */
export const PEERS: number[][] = (() => {
  const peers: number[][] = []
  for (let i = 0; i < CELL_COUNT; i++) {
    const set = new Set<number>()
    for (const unit of unitsOf(i)) {
      for (const j of unitIndices(unit)) {
        if (j !== i) set.add(j)
      }
    }
    peers.push([...set])
  }
  return peers
})()

/** 2つのセルが同じユニットに属するか */
export const isPeer = (a: number, b: number): boolean =>
  a !== b && (rowOf(a) === rowOf(b) || colOf(a) === colOf(b) || boxOf(a) === boxOf(b))

// ---- 変換 ----

/** 81文字の文字列（1-9 と . / 0）→ Grid */
export const parseGrid = (text: string): Grid => {
  const chars = text.replace(/\s/g, '').split('')
  if (chars.length !== CELL_COUNT) {
    throw new Error(`盤面は81文字である必要があります（受け取った長さ: ${chars.length}）`)
  }
  return chars.map((ch) => (ch >= '1' && ch <= '9' ? Number(ch) : 0))
}

/** Grid → 81文字の文字列。空マスは '.' */
export const gridToString = (grid: Grid): string =>
  grid.map((v) => (v === 0 ? '.' : String(v))).join('')

export const emptyGrid = (): Grid => new Array<number>(CELL_COUNT).fill(0)

export const cloneGrid = (grid: Grid): Grid => grid.slice()

/** Grid から Board を作る。value が入っているセルを given とみなす */
export const boardFromGrid = (grid: Grid): Board =>
  grid.map<Cell>((value) => ({
    value: value === 0 ? null : value,
    candidates: [],
    isGiven: value !== 0,
    isError: false,
  }))

/** Board → Grid */
export const gridFromBoard = (board: Board): Grid => board.map((cell) => cell.value ?? 0)

export const cloneBoard = (board: Board): Board =>
  board.map((cell) => ({ ...cell, candidates: [...cell.candidates] }))

/** 空マスがないか */
export const isFilled = (grid: Grid): boolean => grid.every((v) => v !== 0)

/**
 * 重複しているセルの index 集合を返す。
 * 同じユニット内に同じ数字が2つ以上あれば、そのすべてを重複とみなす。
 */
export const findConflicts = (grid: Grid): Set<number> => {
  const conflicts = new Set<number>()
  for (const unit of ALL_UNITS) {
    const seen = new Map<number, number[]>()
    for (const i of unitIndices(unit)) {
      const v = grid[i]
      if (v === 0) continue
      const list = seen.get(v)
      if (list) list.push(i)
      else seen.set(v, [i])
    }
    for (const list of seen.values()) {
      if (list.length > 1) list.forEach((i) => conflicts.add(i))
    }
  }
  return conflicts
}

/** 盤面がルール違反なく埋まっているか（＝クリア判定） */
export const isSolved = (grid: Grid): boolean =>
  isFilled(grid) && findConflicts(grid).size === 0

/** その数字をそこに置けるか（ルール上の可否のみ。候補計算とは別） */
export const canPlace = (grid: Grid, index: number, value: number): boolean =>
  PEERS[index].every((p) => grid[p] !== value)
