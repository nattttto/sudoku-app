import { describe, expect, it } from 'vitest'
import { emptyGrid, gridToString, isSolved, parseGrid } from '../board/board'
import { generateSolvedGrid, hasUniqueSolution, solve, solveOnce } from './solver'

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

const SOLUTION =
  '534678912' +
  '672195348' +
  '198342567' +
  '859761423' +
  '426853791' +
  '713924856' +
  '961537284' +
  '287419635' +
  '345286179'

describe('Solver', () => {
  it('既知の問題を正しく解く', () => {
    const solution = solveOnce(parseGrid(PUZZLE))
    expect(solution).not.toBeNull()
    expect(gridToString(solution!)).toBe(SOLUTION)
  })

  it('一意解を持つ問題を一意と判定する', () => {
    expect(hasUniqueSolution(parseGrid(PUZZLE))).toBe(true)
  })

  it('空盤面は複数解を持つ', () => {
    expect(hasUniqueSolution(emptyGrid())).toBe(false)
    expect(solve(emptyGrid(), 2).count).toBe(2)
  })

  it('数字を1つ削ると一意解でなくなる場合がある', () => {
    // 解答から数字を大量に削れば、ほぼ確実に複数解になる
    const sparse = parseGrid(SOLUTION.slice(0, 10) + '.'.repeat(71))
    expect(hasUniqueSolution(sparse)).toBe(false)
  })

  it('矛盾した盤面は解なし', () => {
    const broken = parseGrid('11' + '.'.repeat(79))
    expect(solve(broken, 1).count).toBe(0)
  })
})

describe('完成盤面の生成', () => {
  it('ルール違反のない完成盤面を作る', () => {
    for (let i = 0; i < 5; i++) {
      const grid = generateSolvedGrid(Math.random)
      expect(isSolved(grid)).toBe(true)
    }
  })

  it('毎回異なる盤面を作る', () => {
    const a = gridToString(generateSolvedGrid(Math.random))
    const b = gridToString(generateSolvedGrid(Math.random))
    expect(a).not.toBe(b)
  })
})
