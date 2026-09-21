import { describe, expect, it } from 'vitest'
import { parseGrid } from '../board/board'
import { analyze } from '../hints/hintEngine'
import { hasUniqueSolution, solveOnce } from '../solver/solver'
import { DIFFICULTIES } from '../board/types'
import { ABSOLUTE_MIN_GIVENS, generatePuzzle, validatePuzzle } from './generator'
import { bandOf, difficultyOf, hardestWeight } from './difficulty'

describe.each(DIFFICULTIES)('問題生成: %s', (difficulty) => {
  const puzzle = generatePuzzle(difficulty)

  it('問題を生成できる', () => {
    expect(puzzle).not.toBeNull()
    expect(puzzle!.givens).toHaveLength(81)
    expect(puzzle!.solution).toHaveLength(81)
  })

  it('一意解を持つ（仕様書4.1）', () => {
    expect(hasUniqueSolution(parseGrid(puzzle!.givens))).toBe(true)
  })

  it('保存された解答が実際の解答と一致する', () => {
    const solved = solveOnce(parseGrid(puzzle!.givens))
    expect(solved!.join('')).toBe(parseGrid(puzzle!.solution).join(''))
  })

  it('ヒントエンジンだけで最後まで解ける（仕様書15章）', () => {
    const analysis = analyze(parseGrid(puzzle!.givens))
    expect(analysis.solved).toBe(true)
  })

  it('難易度判定が要求と一致する（仕様書14章）', () => {
    const analysis = analyze(parseGrid(puzzle!.givens))
    expect(difficultyOf(analysis)).toBe(difficulty)
    const band = bandOf(difficulty)
    expect(hardestWeight(analysis)).toBeGreaterThanOrEqual(band.minWeight)
    expect(hardestWeight(analysis)).toBeLessThanOrEqual(band.maxWeight)
  })

  it('初期数字が下限を下回らない', () => {
    const givens = puzzle!.givens.split('').filter((c) => c !== '.').length
    expect(givens).toBeGreaterThanOrEqual(ABSOLUTE_MIN_GIVENS)
  })

  it('validatePuzzle を通る', () => {
    expect(validatePuzzle(puzzle!)).toBe(true)
  })
})
