/**
 * Naked / Hidden サブセット（Pair・Triple）の共通実装。
 *
 * Naked N : N個のセルが合計N種類の候補しか持たない
 *           → 同じユニットの他のセルからその数字を消せる
 * Hidden N: N個の数字が、ユニット内のN個のセルにしか入らない
 *           → そのN個のセルから、他の候補を消せる
 */
import { ALL_UNITS, unitIndices, unitLabel } from '../board/board'
import { bit, maskToNumbers, popCount } from '../candidates/candidateEngine'
import type { Unit } from '../board/types'
import {
  combinations,
  describeEliminations,
  eliminateMarks,
  eliminationsOf,
  focusMarks,
  joinIds,
  joinNumbers,
  makeHint,
  unitNoun,
} from './util'
import type { Hint, HintContext, HintRule, TechniqueId } from './types'

const SIZE_LABEL: Record<number, string> = { 2: 'ペア', 3: 'トリプル' }

/** ユニット内の空きマス */
const emptyCells = (ctx: HintContext, unit: Unit): number[] =>
  unitIndices(unit).filter((i) => ctx.grid[i] === 0 && ctx.masks[i] !== 0)

/**
 * Naked Pair / Naked Triple
 */
export const makeNakedSubsetRule = (size: 2 | 3, technique: TechniqueId): HintRule => {
  const sizeLabel = SIZE_LABEL[size]

  return (ctx) => {
    for (const unit of ALL_UNITS) {
      const cells = emptyCells(ctx, unit).filter(
        (i) => popCount(ctx.masks[i]) >= 2 && popCount(ctx.masks[i]) <= size,
      )
      if (cells.length <= size) continue

      for (const combo of combinations(cells, size)) {
        const union = combo.reduce((m, i) => m | ctx.masks[i], 0)
        if (popCount(union) !== size) continue

        const values = maskToNumbers(union)
        const comboSet = new Set(combo)
        const eliminated: { index: number; value: number }[] = []
        for (const i of unitIndices(unit)) {
          if (comboSet.has(i) || ctx.grid[i] !== 0) continue
          for (const v of values) {
            if ((ctx.masks[i] & bit(v)) !== 0) eliminated.push({ index: i, value: v })
          }
        }
        if (eliminated.length === 0) continue

        return buildNakedHint(technique, sizeLabel, unit, combo, values, eliminated, ctx)
      }
    }
    return null
  }
}

const buildNakedHint = (
  technique: TechniqueId,
  sizeLabel: string,
  unit: Unit,
  combo: number[],
  values: number[],
  eliminated: { index: number; value: number }[],
  ctx: HintContext,
): Hint => {
  const eliminations = eliminationsOf(eliminated)
  const noun = unitNoun(unit)
  const label = unitLabel(unit)
  const detail = combo
    .map((i) => `${joinIds([i])} = {${maskToNumbers(ctx.masks[i]).join(',')}}`)
    .join('\n')

  return makeHint({
    technique,
    relatedCells: [...combo, ...eliminated.map((e) => e.index)],
    explanation:
      `${label}の ${joinIds(combo)} は、どれも ${joinNumbers(values)} のいずれかしか入りません。` +
      `この${combo.length}マスで ${joinNumbers(values)} をすべて使い切るため、` +
      `${noun}の他のマスには ${joinNumbers(values)} は入りません。` +
      `${describeEliminations(eliminations)}を消去できます。`,
    eliminations,
    units: [unit],
    candidateMarks: [...focusMarks(combo, values), ...eliminateMarks(eliminations)],
    steps: [
      {
        title: '考え方',
        body:
          `${label}に注目してみましょう。\n\n` +
          `${noun}の中に、候補が ${joinNumbers(values)} だけに絞られているマスが` +
          `${combo.length}つあります。探してみてください。`,
      },
      {
        title: 'もう少しヒント',
        body:
          `${detail}\n\n` +
          `この${combo.length}マスだけで ${joinNumbers(values)} を使い切ります。\n` +
          `では${noun}の残りのマスに ${joinNumbers(values)} は入るでしょうか。`,
      },
      {
        title: '答え',
        body:
          `${describeEliminations(eliminations)} を候補から消せます。\n\n` +
          `これは「Naked ${sizeLabel === 'ペア' ? 'Pair' : 'Triple'}」という推論です。\n` +
          `${combo.length}マスが${combo.length}種類の数字を占有することを使います。`,
      },
    ],
  })
}

/**
 * Hidden Pair / Hidden Triple
 */
export const makeHiddenSubsetRule = (size: 2 | 3, technique: TechniqueId): HintRule => {
  const sizeLabel = SIZE_LABEL[size]

  return (ctx) => {
    for (const unit of ALL_UNITS) {
      const indices = unitIndices(unit)

      // ユニット内で「まだ置かれていない数字」と、その置ける場所
      const spots = new Map<number, number[]>()
      for (let n = 1; n <= 9; n++) {
        if (indices.some((i) => ctx.grid[i] === n)) continue
        const b = bit(n)
        const list = indices.filter((i) => ctx.grid[i] === 0 && (ctx.masks[i] & b) !== 0)
        if (list.length >= 2 && list.length <= size) spots.set(n, list)
      }
      if (spots.size < size) continue

      for (const combo of combinations([...spots.keys()], size)) {
        const cellSet = new Set<number>()
        for (const n of combo) for (const i of spots.get(n)!) cellSet.add(i)
        if (cellSet.size !== size) continue

        const cells = [...cellSet].sort((a, b) => a - b)
        const keepMask = combo.reduce((m, n) => m | bit(n), 0)

        const eliminated: { index: number; value: number }[] = []
        for (const i of cells) {
          const extra = ctx.masks[i] & ~keepMask
          for (const v of maskToNumbers(extra)) eliminated.push({ index: i, value: v })
        }
        if (eliminated.length === 0) continue

        return buildHiddenHint(technique, sizeLabel, unit, cells, combo, eliminated)
      }
    }
    return null
  }
}

const buildHiddenHint = (
  technique: TechniqueId,
  sizeLabel: string,
  unit: Unit,
  cells: number[],
  values: number[],
  eliminated: { index: number; value: number }[],
): Hint => {
  const eliminations = eliminationsOf(eliminated)
  const noun = unitNoun(unit)
  const label = unitLabel(unit)

  return makeHint({
    technique,
    relatedCells: [...cells, ...eliminated.map((e) => e.index)],
    explanation:
      `${label}では、${joinNumbers(values)} を置ける場所が ${joinIds(cells)} の${cells.length}マスしかありません。` +
      `この${cells.length}マスに${values.length}個の数字がすべて収まるため、` +
      `これらのマスには ${joinNumbers(values)} 以外は入りません。` +
      `${describeEliminations(eliminations)}を消去できます。`,
    eliminations,
    units: [unit],
    candidateMarks: [...focusMarks(cells, values), ...eliminateMarks(eliminations)],
    steps: [
      {
        title: '考え方',
        body:
          `${label}で「${joinNumbers(values)}」に注目してみましょう。\n\n` +
          `${noun}の中で、これらの数字を置ける場所がどこにあるか探してみてください。`,
      },
      {
        title: 'もう少しヒント',
        body:
          `${joinNumbers(values)} を置けるのは ${joinIds(cells)} の${cells.length}マスだけです。\n\n` +
          `${cells.length}マスに${values.length}個の数字が入るということは、\n` +
          'このマスたちには他の数字は入りません。',
      },
      {
        title: '答え',
        body:
          `${describeEliminations(eliminations)} を候補から消せます。\n\n` +
          `これは「Hidden ${sizeLabel === 'ペア' ? 'Pair' : 'Triple'}」という推論です。\n` +
          '他の候補に隠れている組を見つけて、余分な候補を取り除きます。',
      },
    ],
  })
}
