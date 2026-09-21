/**
 * ヒントエンジンのテスト（仕様書 20章）。
 *
 *   盤面 → Hint Engine → 期待する Technique / Cell / 候補消去
 *
 * を、テクニックごとの固定問題（src/data/test-puzzles）で検証する。
 * 固定問題は scripts/make-test-puzzles.ts で生成している。
 */
import { describe, expect, it } from 'vitest'
import { parseCellId, parseGrid } from '../board/board'
import { bit } from '../candidates/candidateEngine'
import { analyze, emptyEliminated, findHint } from './hintEngine'
import { TECHNIQUE_MAP } from './types'
import type { TechniqueId } from './types'

import nakedSingleFixture from '../../../data/test-puzzles/naked-single.json'
import hiddenSingleFixture from '../../../data/test-puzzles/hidden-single.json'
import lockedCandidateFixture from '../../../data/test-puzzles/locked-candidate.json'
import nakedPairFixture from '../../../data/test-puzzles/naked-pair.json'
import hiddenPairFixture from '../../../data/test-puzzles/hidden-pair.json'
import nakedTripleFixture from '../../../data/test-puzzles/naked-triple.json'
import hiddenTripleFixture from '../../../data/test-puzzles/hidden-triple.json'
import xWingFixture from '../../../data/test-puzzles/x-wing.json'
import xyWingFixture from '../../../data/test-puzzles/xy-wing.json'

type Fixture = {
  technique: string
  grid: string
  eliminatedBefore: string[]
  expected: {
    targetCell?: string
    value?: number
    eliminations: { cell: string; value: number }[]
    relatedCells: string[]
  }
}

const FIXTURES: Fixture[] = [
  nakedSingleFixture,
  hiddenSingleFixture,
  lockedCandidateFixture,
  nakedPairFixture,
  hiddenPairFixture,
  nakedTripleFixture,
  hiddenTripleFixture,
  xWingFixture,
  xyWingFixture,
]

/** "R1C1:3" 形式の配列を消去マスクに戻す */
const restoreEliminated = (entries: string[]): number[] => {
  const eliminated = emptyEliminated()
  for (const entry of entries) {
    const [cell, value] = entry.split(':')
    const index = parseCellId(cell)
    if (index >= 0) eliminated[index] |= bit(Number(value))
  }
  return eliminated
}

describe.each(FIXTURES)('$technique の固定問題', (fixture) => {
  const grid = parseGrid(fixture.grid)
  const eliminated = restoreEliminated(fixture.eliminatedBefore)
  const hint = findHint(grid, eliminated)

  it('期待したテクニックを検出する', () => {
    expect(hint).not.toBeNull()
    expect(hint!.technique).toBe(fixture.technique)
  })

  it('期待した対象セルと数字を返す', () => {
    expect(hint!.targetCell).toBe(fixture.expected.targetCell)
    expect(hint!.value).toBe(fixture.expected.value)
  })

  it('期待した候補消去を返す', () => {
    expect(hint!.eliminations).toEqual(fixture.expected.eliminations)
  })

  it('関係するセルを返す', () => {
    expect(hint!.relatedCells).toEqual(fixture.expected.relatedCells)
  })

  it('説明文と3段階のヒントを持つ', () => {
    expect(hint!.explanation.length).toBeGreaterThan(10)
    expect(hint!.steps).toHaveLength(3)
    for (const step of hint!.steps) {
      expect(step.title.length).toBeGreaterThan(0)
      expect(step.body.length).toBeGreaterThan(0)
    }
    expect(hint!.techniqueName).toBe(TECHNIQUE_MAP[hint!.technique].name)
  })
})

describe('ヒントの優先順位（仕様書10章）', () => {
  it('やさしい解法から順に検索する', () => {
    // Naked Single が存在する盤面では、必ず Naked Single が返る
    const fixture = nakedSingleFixture as Fixture
    const hint = findHint(parseGrid(fixture.grid))
    expect(hint!.technique).toBe('NAKED_SINGLE')
  })

  it('maxLevel を下げると上位のテクニックを使わない', () => {
    const fixture = xyWingFixture as Fixture
    const eliminated = restoreEliminated(fixture.eliminatedBefore)
    const limited = findHint(parseGrid(fixture.grid), eliminated, 1)
    if (limited) {
      expect(TECHNIQUE_MAP[limited.technique].level).toBeLessThanOrEqual(1)
    }
  })
})

describe('盤面解析', () => {
  it('固定問題を論理だけで最後まで解ける', () => {
    for (const fixture of FIXTURES) {
      const analysis = analyze(parseGrid(fixture.grid))
      expect(analysis.solved).toBe(true)
      expect(analysis.moveCount).toBeGreaterThan(0)
    }
  })

  it('使用テクニックと最難テクニックを記録する', () => {
    const analysis = analyze(parseGrid((xWingFixture as Fixture).grid))
    expect(analysis.techniques.length).toBeGreaterThan(0)
    expect(analysis.hardest).not.toBeNull()
    const hardestWeight = TECHNIQUE_MAP[analysis.hardest as TechniqueId].weight
    for (const id of analysis.techniques) {
      expect(TECHNIQUE_MAP[id].weight).toBeLessThanOrEqual(hardestWeight)
    }
  })
})
