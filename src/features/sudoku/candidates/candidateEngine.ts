/**
 * 候補計算エンジン。仕様書 6章。
 *
 * 各セルについて {1..9} から
 *   同じ行 / 同じ列 / 同じ3x3ブロック に存在する数字
 * を取り除いたものを候補とする。
 *
 * 内部表現はビットマスク（bit0 = 数字1 ... bit8 = 数字9）。
 * 集合演算が速く、ヒントエンジンの各ルールで扱いやすい。
 */
import { CELL_COUNT, PEERS } from '../board/board'
import type { Grid } from '../board/types'

/** 1-9 すべてを含むマスク */
export const ALL_MASK = 0b111111111

/** 数字 n (1-9) → マスク */
export const bit = (n: number): number => 1 << (n - 1)

/** マスクに数字 n が含まれるか */
export const hasBit = (mask: number, n: number): boolean => (mask & bit(n)) !== 0

/** マスク → 数字の配列（昇順） */
export const maskToNumbers = (mask: number): number[] => {
  const out: number[] = []
  for (let n = 1; n <= 9; n++) {
    if (mask & bit(n)) out.push(n)
  }
  return out
}

/** 数字の配列 → マスク */
export const numbersToMask = (numbers: readonly number[]): number =>
  numbers.reduce((m, n) => m | bit(n), 0)

/** 立っているビットの数 */
export const popCount = (mask: number): number => {
  let count = 0
  let m = mask
  while (m) {
    m &= m - 1
    count++
  }
  return count
}

/** マスクに数字が1つだけならその数字、そうでなければ 0 */
export const singleValue = (mask: number): number =>
  popCount(mask) === 1 ? maskToNumbers(mask)[0] : 0

/**
 * 盤面全体の候補マスクを計算する。
 * 数字が確定しているセルのマスクは 0（候補なし）とする。
 */
export const computeCandidateMasks = (grid: Grid): number[] => {
  const masks = new Array<number>(CELL_COUNT).fill(0)
  for (let i = 0; i < CELL_COUNT; i++) {
    if (grid[i] !== 0) continue
    let mask = ALL_MASK
    for (const p of PEERS[i]) {
      const v = grid[p]
      if (v !== 0) mask &= ~bit(v)
    }
    masks[i] = mask
  }
  return masks
}

/** 1セル分の候補（数字の配列） */
export const computeCandidates = (grid: Grid, index: number): number[] => {
  if (grid[index] !== 0) return []
  let mask = ALL_MASK
  for (const p of PEERS[index]) {
    const v = grid[p]
    if (v !== 0) mask &= ~bit(v)
  }
  return maskToNumbers(mask)
}

/** 盤面全体の候補を数字配列で返す（UI 表示用） */
export const computeAllCandidates = (grid: Grid): number[][] =>
  computeCandidateMasks(grid).map(maskToNumbers)
