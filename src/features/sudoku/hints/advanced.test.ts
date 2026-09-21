/**
 * 高度な解法のテスト。
 *
 * Swordfish や XYZ-Wing は実際の問題ではめったに出番が来ないため、
 * 候補の並びを直接組み立てて、そのパターンだけを狙って検証する。
 */
import { describe, expect, it } from 'vitest'
import { CELL_COUNT, cellId, indexOf } from '../board/board'
import { numbersToMask } from '../candidates/candidateEngine'
import type { HintContext } from './types'
import { jellyfish } from './jellyfish'
import { swordfish } from './swordfish'
import { xWing } from './xWing'
import { xyWing } from './xyWing'
import { xyzWing } from './xyzWing'

/**
 * 盤面は全マス空のまま、候補だけを組み立てる。
 * spec に無いマスには filler の候補を入れる。
 */
const buildContext = (spec: Record<number, number[]>, filler: number[]): HintContext => {
  const grid = new Array<number>(CELL_COUNT).fill(0)
  const masks = new Array<number>(CELL_COUNT).fill(numbersToMask(filler))
  for (const [index, values] of Object.entries(spec)) {
    masks[Number(index)] = numbersToMask(values)
  }
  return { grid, masks }
}

describe('Swordfish', () => {
  // 5を置ける場所が、1〜3行目でいずれも1〜3列目に収まっている形
  const target = indexOf(4, 1) // R5C2 に残った5を消せる
  const ctx = buildContext(
    {
      [indexOf(0, 0)]: [5],
      [indexOf(0, 1)]: [5],
      [indexOf(1, 1)]: [5],
      [indexOf(1, 2)]: [5],
      [indexOf(2, 0)]: [5],
      [indexOf(2, 2)]: [5],
      [target]: [5],
    },
    [1, 2],
  )

  it('3行3列の対応を検出する', () => {
    const hint = swordfish(ctx)
    expect(hint).not.toBeNull()
    expect(hint!.technique).toBe('SWORDFISH')
    expect(hint!.value).toBe(5)
  })

  it('対応する列の外にある候補を消す', () => {
    const hint = swordfish(ctx)!
    expect(hint.eliminations).toEqual([{ cell: cellId(target), value: 5 }])
  })

  it('土台の6マスを関係するマスとして返す', () => {
    const hint = swordfish(ctx)!
    for (const index of [
      indexOf(0, 0),
      indexOf(0, 1),
      indexOf(1, 1),
      indexOf(1, 2),
      indexOf(2, 0),
      indexOf(2, 2),
    ]) {
      expect(hint.relatedCells).toContain(cellId(index))
    }
  })

  it('同じ盤面では X-Wing は成立しない（Swordfish が必要）', () => {
    expect(xWing(ctx)).toBeNull()
  })

  it('説明文と3段階のヒントを持つ', () => {
    const hint = swordfish(ctx)!
    expect(hint.techniqueName).toBe('Swordfish')
    expect(hint.explanation).toContain('5')
    expect(hint.steps).toHaveLength(3)
  })
})

describe('Jellyfish', () => {
  // 4行が同じ4列に収まっている形
  const target = indexOf(5, 2)
  const ctx = buildContext(
    {
      [indexOf(0, 0)]: [5],
      [indexOf(0, 1)]: [5],
      [indexOf(1, 1)]: [5],
      [indexOf(1, 2)]: [5],
      [indexOf(2, 2)]: [5],
      [indexOf(2, 3)]: [5],
      [indexOf(3, 0)]: [5],
      [indexOf(3, 3)]: [5],
      [target]: [5],
    },
    [1, 2],
  )

  it('4行4列の対応を検出する', () => {
    const hint = jellyfish(ctx)
    expect(hint).not.toBeNull()
    expect(hint!.technique).toBe('JELLYFISH')
    expect(hint!.value).toBe(5)
  })

  it('対応する列の外にある候補を消す', () => {
    expect(jellyfish(ctx)!.eliminations).toEqual([{ cell: cellId(target), value: 5 }])
  })

  it('同じ盤面では X-Wing も Swordfish も成立しない', () => {
    expect(xWing(ctx)).toBeNull()
    expect(swordfish(ctx)).toBeNull()
  })
})

describe('XYZ-Wing', () => {
  const pivot = indexOf(0, 0) // {1,2,3}
  const pincerA = indexOf(0, 1) // {1,3}
  const pincerB = indexOf(1, 0) // {2,3}
  const target = indexOf(1, 1) // 3つすべてから見える。ここから3が消える
  const ctx = buildContext(
    {
      [pivot]: [1, 2, 3],
      [pincerA]: [1, 3],
      [pincerB]: [2, 3],
      [target]: [3, 8],
    },
    [8, 9],
  )

  it('3候補のセルを軸にした形を検出する', () => {
    const hint = xyzWing(ctx)
    expect(hint).not.toBeNull()
    expect(hint!.technique).toBe('XYZ_WING')
    expect(hint!.value).toBe(3)
  })

  it('3マスすべてから見えるマスの候補を消す', () => {
    expect(xyzWing(ctx)!.eliminations).toEqual([{ cell: cellId(target), value: 3 }])
  })

  it('軸と2つの先端を関係するマスとして返す', () => {
    const hint = xyzWing(ctx)!
    expect(hint.relatedCells).toContain(cellId(pivot))
    expect(hint.relatedCells).toContain(cellId(pincerA))
    expect(hint.relatedCells).toContain(cellId(pincerB))
  })

  it('同じ盤面では XY-Wing は成立しない（XYZ-Wing が必要）', () => {
    expect(xyWing(ctx)).toBeNull()
  })

  it('ピボットからしか見えないマスは消さない', () => {
    // pincerA・pincerB から見えない位置に3を置いても、消去対象にはならない
    const far = indexOf(8, 8)
    const farCtx = buildContext(
      {
        [pivot]: [1, 2, 3],
        [pincerA]: [1, 3],
        [pincerB]: [2, 3],
        [far]: [3, 8],
      },
      [8, 9],
    )
    expect(xyzWing(farCtx)).toBeNull()
  })
})
