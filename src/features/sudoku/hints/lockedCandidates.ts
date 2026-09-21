/**
 * ③ Locked Candidates（仕様書 8.1）
 *
 * Pointing:
 *   3×3ブロック内である数字の候補が同一行（列）に限定されているとき、
 *   その行（列）のブロック外から候補を削除できる。
 *
 * Claiming（Box-Line Reduction）:
 *   行（列）内である数字の候補が1つのブロックに限定されているとき、
 *   そのブロックの行（列）外から候補を削除できる。
 */
import { boxOf, colOf, rowOf, unitIndices, unitLabel } from '../board/board'
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

/** ユニット内でその数字の候補を持つ空きマス */
const spotsFor = (ctx: HintContext, unit: Unit, n: number): number[] => {
  const b = bit(n)
  const indices = unitIndices(unit)
  if (indices.some((i) => ctx.grid[i] === n)) return []
  return indices.filter((i) => ctx.grid[i] === 0 && (ctx.masks[i] & b) !== 0)
}

const buildHint = (
  n: number,
  spots: number[],
  eliminated: { index: number; value: number }[],
  lockedUnit: Unit,
  targetUnit: Unit,
  variant: 'pointing' | 'claiming',
): Hint => {
  const eliminations = eliminationsOf(eliminated)
  const lockedLabel = unitLabel(lockedUnit)
  const targetLabel = unitLabel(targetUnit)
  const lineLabel = variant === 'pointing' ? targetLabel : lockedLabel
  const boxLabel = variant === 'pointing' ? lockedLabel : targetLabel

  const explanation =
    variant === 'pointing'
      ? `${boxLabel}の中で${n}を置けるマスは ${joinIds(spots)} で、すべて${lineLabel}に並んでいます。` +
        `${boxLabel}のどこかには必ず${n}が入るので、${n}は${lineLabel}のこの範囲のどれかに確定します。` +
        `したがって同じ${lineLabel}にある${boxLabel}の外のマスには${n}は入りません。` +
        `${describeEliminations(eliminations)}を消去できます。`
      : `${lineLabel}の中で${n}を置けるマスは ${joinIds(spots)} で、すべて${boxLabel}に収まっています。` +
        `${lineLabel}のどこかには必ず${n}が入るので、${n}は${boxLabel}のこの範囲のどれかに確定します。` +
        `したがって${boxLabel}の中で${lineLabel}以外のマスには${n}は入りません。` +
        `${describeEliminations(eliminations)}を消去できます。`

  return makeHint({
    technique: 'LOCKED_CANDIDATES',
    value: n,
    relatedCells: [...spots, ...eliminated.map((e) => e.index)],
    explanation,
    eliminations,
    units: [lockedUnit, targetUnit],
    candidateMarks: [...focusMarks(spots, [n]), ...eliminateMarks(eliminations)],
    steps: [
      {
        title: '考え方',
        body:
          `「${n}」と ${variant === 'pointing' ? boxLabel : lineLabel} に注目してみましょう。\n\n` +
          `${variant === 'pointing' ? boxLabel : lineLabel}の中で、${n}を置ける場所がどこに集まっているか見てください。`,
      },
      {
        title: 'もう少しヒント',
        body:
          `${n}を置けるのは ${joinIds(spots)} だけで、これらはすべて` +
          `${variant === 'pointing' ? lineLabel : boxLabel}に含まれています。\n\n` +
          `つまり${n}は必ずこの中に入ります。では、同じ${variant === 'pointing' ? lineLabel : boxLabel}の` +
          'ほかのマスはどうなるでしょうか。',
      },
      {
        title: '答え',
        body:
          `${describeEliminations(eliminations)} を候補から消せます。\n\n` +
          `これは「Locked Candidates（${variant === 'pointing' ? 'Pointing' : 'Claiming'}）」という推論です。\n` +
          'ブロックと行・列が重なる部分を使って候補を絞り込みます。',
      },
    ],
  })
}

export const lockedCandidates: HintRule = (ctx) => {
  // Pointing: ブロック → 行・列
  for (let box = 0; box < 9; box++) {
    const boxUnit: Unit = { type: 'box', index: box }
    for (let n = 1; n <= 9; n++) {
      const spots = spotsFor(ctx, boxUnit, n)
      if (spots.length < 2) continue

      const rows = new Set(spots.map(rowOf))
      const cols = new Set(spots.map(colOf))
      const line: Unit | null =
        rows.size === 1
          ? { type: 'row', index: [...rows][0] }
          : cols.size === 1
            ? { type: 'col', index: [...cols][0] }
            : null
      if (!line) continue

      const b = bit(n)
      const eliminated = unitIndices(line)
        .filter(
          (i) =>
            boxOf(i) !== box && ctx.grid[i] === 0 && (ctx.masks[i] & b) !== 0,
        )
        .map((index) => ({ index, value: n }))
      if (eliminated.length === 0) continue

      return buildHint(n, spots, eliminated, boxUnit, line, 'pointing')
    }
  }

  // Claiming: 行・列 → ブロック
  for (const line of [
    ...Array.from({ length: 9 }, (_, i) => ({ type: 'row', index: i }) as Unit),
    ...Array.from({ length: 9 }, (_, i) => ({ type: 'col', index: i }) as Unit),
  ]) {
    for (let n = 1; n <= 9; n++) {
      const spots = spotsFor(ctx, line, n)
      if (spots.length < 2) continue

      const boxes = new Set(spots.map(boxOf))
      if (boxes.size !== 1) continue
      const box = [...boxes][0]
      const boxUnit: Unit = { type: 'box', index: box }

      const b = bit(n)
      const inLine = new Set(spots)
      const eliminated = unitIndices(boxUnit)
        .filter(
          (i) =>
            !inLine.has(i) &&
            (line.type === 'row' ? rowOf(i) !== line.index : colOf(i) !== line.index) &&
            ctx.grid[i] === 0 &&
            (ctx.masks[i] & b) !== 0,
        )
        .map((index) => ({ index, value: n }))
      if (eliminated.length === 0) continue

      return buildHint(n, spots, eliminated, line, boxUnit, 'claiming')
    }
  }

  return null
}
