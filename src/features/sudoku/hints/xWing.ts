/**
 * X-Wing（仕様書 9章 Lv.3 / 13.5）
 *
 * ある数字について、2つの行で候補が「まったく同じ2つの列」にしか無い場合、
 * その2列の他の行からその数字を消せる（行と列を入れ替えた形も同様）。
 *
 *   R2C2 ───────── R2C8
 *     │              │
 *   R7C2 ───────── R7C8
 */
import { cellId, colOf, rowOf, unitIndices } from '../board/board'
import { bit } from '../candidates/candidateEngine'
import type { Unit } from '../board/types'
import {
  describeEliminations,
  eliminateMarks,
  eliminationsOf,
  focusMarks,
  joinIds,
  makeHint,
} from './util'
import type { Hint, HintContext, HintRule } from './types'

type Orientation = 'row' | 'col'

const spotsInLine = (
  ctx: HintContext,
  orientation: Orientation,
  line: number,
  n: number,
): number[] => {
  const b = bit(n)
  const unit: Unit = { type: orientation, index: line }
  const indices = unitIndices(unit)
  if (indices.some((i) => ctx.grid[i] === n)) return []
  return indices.filter((i) => ctx.grid[i] === 0 && (ctx.masks[i] & b) !== 0)
}

const findFor = (ctx: HintContext, orientation: Orientation, n: number): Hint | null => {
  const crossOf = orientation === 'row' ? colOf : rowOf
  const b = bit(n)

  // 候補がちょうど2つの行（列）だけを集める
  const lines: { line: number; cross: [number, number]; cells: number[] }[] = []
  for (let line = 0; line < 9; line++) {
    const spots = spotsInLine(ctx, orientation, line, n)
    if (spots.length !== 2) continue
    lines.push({
      line,
      cross: [crossOf(spots[0]), crossOf(spots[1])],
      cells: spots,
    })
  }

  for (let a = 0; a < lines.length; a++) {
    for (let c = a + 1; c < lines.length; c++) {
      const first = lines[a]
      const second = lines[c]
      if (first.cross[0] !== second.cross[0] || first.cross[1] !== second.cross[1]) continue

      const corners = [...first.cells, ...second.cells]
      const cornerSet = new Set(corners)
      const crossLines = first.cross

      const eliminated: { index: number; value: number }[] = []
      for (const cross of crossLines) {
        const unit: Unit = { type: orientation === 'row' ? 'col' : 'row', index: cross }
        for (const i of unitIndices(unit)) {
          if (cornerSet.has(i)) continue
          if (ctx.grid[i] !== 0) continue
          if ((ctx.masks[i] & b) === 0) continue
          eliminated.push({ index: i, value: n })
        }
      }
      if (eliminated.length === 0) continue

      const lineNoun = orientation === 'row' ? '行' : '列'
      const crossNoun = orientation === 'row' ? '列' : '行'
      const lineNames = `${first.line + 1}${lineNoun}目と${second.line + 1}${lineNoun}目`
      const crossNames = `${crossLines[0] + 1}${crossNoun}目と${crossLines[1] + 1}${crossNoun}目`
      const eliminations = eliminationsOf(eliminated)

      const units: Unit[] = [
        { type: orientation, index: first.line },
        { type: orientation, index: second.line },
        { type: orientation === 'row' ? 'col' : 'row', index: crossLines[0] },
        { type: orientation === 'row' ? 'col' : 'row', index: crossLines[1] },
      ]

      return makeHint({
        technique: 'X_WING',
        value: n,
        relatedCells: [...corners, ...eliminated.map((e) => e.index)],
        explanation:
          `${lineNames}では、${n}を置ける場所がどちらも${crossNames}の2か所しかありません` +
          `（${joinIds(corners)}）。` +
          `この2つの${lineNoun}にはそれぞれ${n}が1つ入るので、長方形の対角どちらかの組み合わせで` +
          `${n}が使われます。どちらの場合でも${crossNames}は${n}で埋まるため、` +
          `${crossNames}の他のマスに${n}は入りません。` +
          `${describeEliminations(eliminations)}を消去できます。`,
        eliminations,
        units,
        candidateMarks: [...focusMarks(corners, [n]), ...eliminateMarks(eliminations)],
        steps: [
          {
            title: '考え方',
            body:
              `「${n}」に注目し、${lineNames}を見てみましょう。\n\n` +
              `それぞれの${lineNoun}で${n}を置ける場所が何か所あるか数えてみてください。`,
          },
          {
            title: 'もう少しヒント',
            body:
              `どちらの${lineNoun}も、${n}を置けるのは${crossNames}の2か所だけです。\n\n` +
              `${cellId(corners[0])} ─── ${cellId(corners[1])}\n` +
              `   │              │\n` +
              `${cellId(corners[2])} ─── ${cellId(corners[3])}\n\n` +
              `この長方形の対角のどちらかに${n}が入ります。\n` +
              `ということは、${crossNames}はこの4マスのどれかで${n}を使い切ります。`,
          },
          {
            title: '答え',
            body:
              `${describeEliminations(eliminations)} を候補から消せます。\n\n` +
              'これは「X-Wing」という推論です。\n' +
              '2×2の長方形の関係を使って、列（行）全体の候補を絞り込みます。',
          },
        ],
      })
    }
  }
  return null
}

export const xWing: HintRule = (ctx) => {
  for (let n = 1; n <= 9; n++) {
    const byRow = findFor(ctx, 'row', n)
    if (byRow) return byRow
    const byCol = findFor(ctx, 'col', n)
    if (byCol) return byCol
  }
  return null
}
