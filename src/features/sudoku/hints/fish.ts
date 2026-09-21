/**
 * フィッシュ系の共通実装（X-Wing / Swordfish / Jellyfish）。
 *
 * ある数字について、N個の行を選んだとき、
 * その数字を置ける列がちょうどN列に収まっているなら、
 * そのN列にはN個の行で数字を使い切る。
 * したがって、そのN列の他の行からその数字を消せる。
 *
 *   N=2 : X-Wing
 *   N=3 : Swordfish
 *   N=4 : Jellyfish
 *
 * 行と列を入れ替えた形も同じように成立する。
 */
import { cellId, colOf, rowOf, unitIndices } from '../board/board'
import { bit } from '../candidates/candidateEngine'
import type { Unit } from '../board/types'
import {
  combinations,
  describeEliminations,
  eliminateMarks,
  eliminationsOf,
  focusMarks,
  joinIds,
  makeHint,
} from './util'
import type { Hint, HintContext, HintRule, TechniqueId } from './types'

export type FishSize = 2 | 3 | 4

type Orientation = 'row' | 'col'

const SIZE_NAME: Record<FishSize, string> = {
  2: 'X-Wing',
  3: 'Swordfish',
  4: 'Jellyfish',
}

/** その行（列）でその数字を置けるマス。すでに置かれていれば空を返す */
const spotsInLine = (
  ctx: HintContext,
  orientation: Orientation,
  line: number,
  n: number,
): number[] => {
  const unit: Unit = { type: orientation, index: line }
  const indices = unitIndices(unit)
  if (indices.some((i) => ctx.grid[i] === n)) return []
  const b = bit(n)
  return indices.filter((i) => ctx.grid[i] === 0 && (ctx.masks[i] & b) !== 0)
}

/** 「2行目・5行目・7行目」のような表記 */
const linesLabel = (lines: readonly number[], noun: string): string =>
  lines.map((line) => `${line + 1}${noun}目`).join('・')

const findFish = (
  ctx: HintContext,
  orientation: Orientation,
  n: number,
  size: FishSize,
  technique: TechniqueId,
): Hint | null => {
  const crossOf = orientation === 'row' ? colOf : rowOf
  const crossType: Orientation = orientation === 'row' ? 'col' : 'row'
  const b = bit(n)

  // 候補の数が 2〜size に収まっている行（列）だけが土台になれる
  const bases: { line: number; cells: number[]; crosses: number[] }[] = []
  for (let line = 0; line < 9; line++) {
    const spots = spotsInLine(ctx, orientation, line, n)
    if (spots.length < 2 || spots.length > size) continue
    bases.push({ line, cells: spots, crosses: spots.map(crossOf) })
  }
  if (bases.length < size) return null

  for (const combo of combinations(bases, size)) {
    const crosses = [...new Set(combo.flatMap((base) => base.crosses))].sort((a, b) => a - b)
    // 列がちょうどN個に収まっていなければフィッシュではない
    if (crosses.length !== size) continue

    const corners = combo.flatMap((base) => base.cells)
    const cornerSet = new Set(corners)

    const eliminated: { index: number; value: number }[] = []
    for (const cross of crosses) {
      for (const i of unitIndices({ type: crossType, index: cross })) {
        if (cornerSet.has(i)) continue
        if (ctx.grid[i] !== 0) continue
        if ((ctx.masks[i] & b) === 0) continue
        eliminated.push({ index: i, value: n })
      }
    }
    if (eliminated.length === 0) continue

    return buildFishHint(technique, size, orientation, n, combo.map((c) => c.line), crosses, corners, eliminated)
  }
  return null
}

const buildFishHint = (
  technique: TechniqueId,
  size: FishSize,
  orientation: Orientation,
  n: number,
  baseLines: number[],
  crosses: number[],
  corners: number[],
  eliminated: { index: number; value: number }[],
): Hint => {
  const eliminations = eliminationsOf(eliminated)
  const baseNoun = orientation === 'row' ? '行' : '列'
  const crossNoun = orientation === 'row' ? '列' : '行'
  const baseLabel = linesLabel(baseLines, baseNoun)
  const crossLabel = linesLabel(crosses, crossNoun)
  const name = SIZE_NAME[size]

  const units: Unit[] = [
    ...baseLines.map<Unit>((line) => ({ type: orientation, index: line })),
    ...crosses.map<Unit>((cross) => ({
      type: orientation === 'row' ? 'col' : 'row',
      index: cross,
    })),
  ]

  // 2×2のときだけは、長方形の形を描いたほうが分かりやすい
  const diagram =
    size === 2
      ? `\n\n${cellId(corners[0])} ─── ${cellId(corners[1])}\n   │              │\n${cellId(corners[2])} ─── ${cellId(corners[3])}\n`
      : `\n\n${joinIds(corners)}\n`

  return makeHint({
    technique,
    value: n,
    relatedCells: [...corners, ...eliminated.map((e) => e.index)],
    explanation:
      `${baseLabel}の${size}つの${baseNoun}では、${n}を置ける場所がすべて${crossLabel}の${size}${crossNoun}に収まっています` +
      `（${joinIds(corners)}）。` +
      `この${size}つの${baseNoun}にはそれぞれ${n}が1つ入るので、${size}個の${n}がこの${size}${crossNoun}で使い切られます。` +
      `したがって${crossLabel}の他のマスに${n}は入りません。` +
      `${describeEliminations(eliminations)}を消去できます。`,
    eliminations,
    units,
    candidateMarks: [...focusMarks(corners, [n]), ...eliminateMarks(eliminations)],
    steps: [
      {
        title: '考え方',
        body:
          `「${n}」に注目し、${baseLabel}を見てみましょう。\n\n` +
          `それぞれの${baseNoun}で${n}を置ける場所が、どの${crossNoun}にあるか書き出してみてください。`,
      },
      {
        title: 'もう少しヒント',
        body:
          `${size}つの${baseNoun}のどれも、${n}を置けるのは${crossLabel}の中だけです。${diagram}\n` +
          `${size}つの${baseNoun}に${n}が1つずつ入るので、\n` +
          `この${size}${crossNoun}が${n}で埋まってしまいます。`,
      },
      {
        title: '答え',
        body:
          `${describeEliminations(eliminations)} を候補から消せます。\n\n` +
          `これは「${name}」という推論です。\n` +
          `${size}つの${baseNoun}と${size}つの${crossNoun}の対応を使って、${crossNoun}全体の候補を絞り込みます。`,
      },
    ],
  })
}

export const makeFishRule = (size: FishSize, technique: TechniqueId): HintRule => (ctx) => {
  for (let n = 1; n <= 9; n++) {
    const byRow = findFish(ctx, 'row', n, size, technique)
    if (byRow) return byRow
    const byCol = findFish(ctx, 'col', n, size, technique)
    if (byCol) return byCol
  }
  return null
}
