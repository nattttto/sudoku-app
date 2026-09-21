import { describe, expect, it } from 'vitest'
import {
  ALL_UNITS,
  PEERS,
  boxOf,
  cellId,
  findConflicts,
  gridToString,
  isSolved,
  parseCellId,
  parseGrid,
  unitIndices,
} from './board'

describe('セルIDの変換', () => {
  it('index から R*C* 形式に変換できる', () => {
    expect(cellId(0)).toBe('R1C1')
    expect(cellId(80)).toBe('R9C9')
    expect(cellId(30)).toBe('R4C4')
  })

  it('R*C* 形式から index に戻せる', () => {
    expect(parseCellId('R1C1')).toBe(0)
    expect(parseCellId('R9C9')).toBe(80)
    expect(parseCellId('R4C7')).toBe(3 * 9 + 6)
  })

  it('不正な文字列は -1 を返す', () => {
    expect(parseCellId('X1C1')).toBe(-1)
    expect(parseCellId('R0C1')).toBe(-1)
  })
})

describe('ユニットとピア', () => {
  it('ブロック番号を正しく求める', () => {
    expect(boxOf(0)).toBe(0)
    expect(boxOf(8)).toBe(2)
    expect(boxOf(80)).toBe(8)
    expect(boxOf(parseCellId('R4C7'))).toBe(5)
  })

  it('ユニットは27個あり、それぞれ9セルを持つ', () => {
    expect(ALL_UNITS).toHaveLength(27)
    for (const unit of ALL_UNITS) {
      expect(unitIndices(unit)).toHaveLength(9)
    }
  })

  it('各セルのピアは20個', () => {
    for (const peers of PEERS) {
      expect(peers).toHaveLength(20)
    }
  })
})

const PUZZLE_TEXT =
  '53..7....' +
  '6..195...' +
  '.98....6.' +
  '8...6...3' +
  '4..8.3..1' +
  '7...2...6' +
  '.6....28.' +
  '...419..5' +
  '....8..79'

describe('盤面の読み書き', () => {
  const text =
    '53..7....' +
    '6..195...' +
    '.98....6.' +
    '8...6...3' +
    '4..8.3..1' +
    '7...2...6' +
    '.6....28.' +
    '...419..5' +
    '....8..79'

  it('81文字の文字列を読み書きできる', () => {
    const grid = parseGrid(text)
    expect(grid).toHaveLength(81)
    expect(gridToString(grid)).toBe(text)
  })

  it('長さが81でなければエラー', () => {
    expect(() => parseGrid('123')).toThrow()
  })
})

describe('重複検出とクリア判定', () => {
  it('同じ行の重複を検出する', () => {
    const grid = parseGrid('11' + '.'.repeat(79))
    const conflicts = findConflicts(grid)
    expect(conflicts.has(0)).toBe(true)
    expect(conflicts.has(1)).toBe(true)
    expect(conflicts.size).toBe(2)
  })

  it('重複がなければ空集合', () => {
    const grid = parseGrid('12' + '.'.repeat(79))
    expect(findConflicts(grid).size).toBe(0)
  })

  it('完成盤面をクリアと判定する', () => {
    const solved =
      '534678912' +
      '672195348' +
      '198342567' +
      '859761423' +
      '426853791' +
      '713924856' +
      '961537284' +
      '287419635' +
      '345286179'
    expect(isSolved(parseGrid(solved))).toBe(true)
    expect(isSolved(parseGrid(PUZZLE_TEXT))).toBe(false)
  })
})
