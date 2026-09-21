import { describe, expect, it } from 'vitest'
import { parseCellId, parseGrid } from '../board/board'
import {
  ALL_MASK,
  bit,
  computeCandidates,
  maskToNumbers,
  numbersToMask,
  popCount,
  singleValue,
} from './candidateEngine'

const PUZZLE =
  '53..7....' +
  '6..195...' +
  '.98....6.' +
  '8...6...3' +
  '4..8.3..1' +
  '7...2...6' +
  '.6....28.' +
  '...419..5' +
  '....8..79'

describe('ビットマスク操作', () => {
  it('数字と配列を相互変換できる', () => {
    expect(maskToNumbers(ALL_MASK)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(numbersToMask([2, 5, 7])).toBe(bit(2) | bit(5) | bit(7))
    expect(maskToNumbers(numbersToMask([2, 5, 7]))).toEqual([2, 5, 7])
  })

  it('立っているビット数を数えられる', () => {
    expect(popCount(0)).toBe(0)
    expect(popCount(ALL_MASK)).toBe(9)
    expect(popCount(numbersToMask([1, 9]))).toBe(2)
  })

  it('候補が1つのときだけ singleValue を返す', () => {
    expect(singleValue(bit(5))).toBe(5)
    expect(singleValue(numbersToMask([5, 6]))).toBe(0)
    expect(singleValue(0)).toBe(0)
  })
})

describe('候補計算（仕様書6章）', () => {
  const grid = parseGrid(PUZZLE)

  it('行・列・ブロックの数字を除外した候補を返す', () => {
    // R1C3 は 1行目に 5,3,7 / 1列目〜3列目のブロックに 5,3,6,9,8 / 3列目に 8 がある
    const candidates = computeCandidates(grid, parseCellId('R1C3'))
    expect(candidates).toEqual([1, 2, 4])
  })

  it('数字が入っているセルの候補は空', () => {
    expect(computeCandidates(grid, parseCellId('R1C1'))).toEqual([])
  })

  it('候補には行・列・ブロックの数字が含まれない', () => {
    for (let i = 0; i < 81; i++) {
      if (grid[i] !== 0) continue
      for (const value of computeCandidates(grid, i)) {
        expect(value).toBeGreaterThanOrEqual(1)
        expect(value).toBeLessThanOrEqual(9)
      }
    }
  })
})
