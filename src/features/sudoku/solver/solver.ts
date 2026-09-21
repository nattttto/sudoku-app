/**
 * Solver。仕様書 16章。
 * 「この問題を解けるか・最終的な解答は何か」だけを担当する。
 * ヒントエンジン（どの定石で次の一手が導けるか）とは分離する。
 *
 * 制約伝播（Naked Single / Hidden Single 相当）＋バックトラックで解く。
 * 解の個数は最大 limit 個まで数え、一意解判定に使う。
 */
import { ALL_UNITS, CELL_COUNT, PEERS, cloneGrid, unitIndices } from '../board/board'
import {
  ALL_MASK,
  bit,
  computeCandidateMasks,
  maskToNumbers,
  popCount,
} from '../candidates/candidateEngine'
import type { Grid } from '../board/types'

export type SolveResult = {
  /** 見つかった解の数（limit で打ち切る） */
  count: number
  /** 最初に見つかった解 */
  solution: Grid | null
}

/** セルに数字を置き、ピアの候補を削る。矛盾したら false */
const assign = (grid: Grid, masks: number[], index: number, value: number): boolean => {
  grid[index] = value
  masks[index] = 0
  const b = bit(value)
  for (const p of PEERS[index]) {
    if (grid[p] === value) return false
    if (grid[p] === 0) {
      masks[p] &= ~b
      if (masks[p] === 0) return false
    }
  }
  return true
}

/** 与えられた盤面がすでに矛盾していないか */
const hasContradiction = (grid: Grid, masks: number[]): boolean => {
  for (let i = 0; i < CELL_COUNT; i++) {
    if (grid[i] === 0 && masks[i] === 0) return true
  }
  for (const unit of ALL_UNITS) {
    const indices = unitIndices(unit)
    for (let n = 1; n <= 9; n++) {
      const b = bit(n)
      let placed = false
      let possible = false
      for (const i of indices) {
        if (grid[i] === n) {
          placed = true
          break
        }
        if (grid[i] === 0 && (masks[i] & b) !== 0) possible = true
      }
      if (!placed && !possible) return true
    }
  }
  return false
}

/**
 * Naked Single と Hidden Single を、これ以上進まなくなるまで適用する。
 * @returns 矛盾を検出したら false
 */
const propagate = (grid: Grid, masks: number[]): boolean => {
  let changed = true
  while (changed) {
    changed = false

    // Naked Single: 候補が1つだけのセル
    for (let i = 0; i < CELL_COUNT; i++) {
      if (grid[i] !== 0) continue
      const mask = masks[i]
      if (mask === 0) return false
      if (popCount(mask) === 1) {
        if (!assign(grid, masks, i, maskToNumbers(mask)[0])) return false
        changed = true
      }
    }

    // Hidden Single: ユニット内でその数字を置けるセルが1つだけ
    for (const unit of ALL_UNITS) {
      const indices = unitIndices(unit)
      for (let n = 1; n <= 9; n++) {
        const b = bit(n)
        let spot = -1
        let count = 0
        let alreadyPlaced = false
        for (const i of indices) {
          if (grid[i] === n) {
            alreadyPlaced = true
            break
          }
          if (grid[i] === 0 && (masks[i] & b) !== 0) {
            spot = i
            count++
          }
        }
        if (alreadyPlaced) continue
        if (count === 0) return false
        if (count === 1) {
          if (!assign(grid, masks, spot, n)) return false
          changed = true
        }
      }
    }
  }
  return true
}

/** 候補が最も少ない空マスを選ぶ（探索の枝を減らす） */
const pickCell = (grid: Grid, masks: number[]): number => {
  let best = -1
  let bestCount = 10
  for (let i = 0; i < CELL_COUNT; i++) {
    if (grid[i] !== 0) continue
    const count = popCount(masks[i])
    if (count < bestCount) {
      best = i
      bestCount = count
      if (count <= 2) break
    }
  }
  return best
}

export const shuffleArray = <T>(array: readonly T[], random: () => number): T[] => {
  const out = array.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

const search = (
  grid: Grid,
  masks: number[],
  limit: number,
  result: SolveResult,
  random?: () => number,
): void => {
  if (result.count >= limit) return
  if (!propagate(grid, masks)) return

  const index = pickCell(grid, masks)
  if (index === -1) {
    // 空マスなし＝解
    result.count++
    if (!result.solution) result.solution = cloneGrid(grid)
    return
  }

  const values = random
    ? shuffleArray(maskToNumbers(masks[index]), random)
    : maskToNumbers(masks[index])

  for (const value of values) {
    const nextGrid = cloneGrid(grid)
    const nextMasks = masks.slice()
    if (assign(nextGrid, nextMasks, index, value)) {
      search(nextGrid, nextMasks, limit, result, random)
    }
    if (result.count >= limit) return
  }
}

/**
 * 解を探す。
 * @param limit 数え上げる解の上限（一意解判定なら 2 で十分）
 */
export const solve = (input: Grid, limit = 1): SolveResult => {
  const grid = cloneGrid(input)
  const masks = computeCandidateMasks(grid)
  const result: SolveResult = { count: 0, solution: null }
  if (hasContradiction(grid, masks)) return result
  search(grid, masks, limit, result)
  return result
}

/** 解が1つだけか（仕様書 4.1 の一意解チェック） */
export const hasUniqueSolution = (grid: Grid): boolean => solve(grid, 2).count === 1

/** 解答を1つ返す。解けなければ null */
export const solveOnce = (grid: Grid): Grid | null => solve(grid, 1).solution

/** ランダムな完成盤面を生成する（仕様書 4.1 の1段目） */
export const generateSolvedGrid = (random: () => number): Grid => {
  const grid = new Array<number>(CELL_COUNT).fill(0)
  const masks = new Array<number>(CELL_COUNT).fill(ALL_MASK)
  const result: SolveResult = { count: 0, solution: null }
  search(grid, masks, 1, result, random)
  if (!result.solution) throw new Error('完成盤面の生成に失敗しました')
  return result.solution
}
