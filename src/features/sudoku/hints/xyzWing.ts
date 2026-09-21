/**
 * XYZ-Wing（仕様書 9章 Lv.4）
 *
 * XY-Wing の親戚。ピボットの候補が3つある形。
 *   ピボット  = {x, y, z}（3候補）
 *   ピンサー1 = {x, z}（ピボットと同じ行・列・ブロック）
 *   ピンサー2 = {y, z}（ピボットと同じ行・列・ブロック）
 *
 * この3マスのどれかには必ず z が入る。
 * XY-Wing と違い、ピボット自身も z になりうるので、
 * 消せるのは「3マスすべてから見えるマス」だけになる。
 */
import { CELL_COUNT, PEERS, cellId, isPeer, unitsOf } from '../board/board'
import { bit, maskToNumbers, popCount } from '../candidates/candidateEngine'
import type { Unit } from '../board/types'
import {
  describeEliminations,
  eliminateMarks,
  eliminationsOf,
  focusMarks,
  joinIds,
  makeHint,
} from './util'
import type { HintRule } from './types'

export const xyzWing: HintRule = ({ grid, masks }) => {
  for (let pivot = 0; pivot < CELL_COUNT; pivot++) {
    if (grid[pivot] !== 0 || popCount(masks[pivot]) !== 3) continue
    const pivotMask = masks[pivot]

    // ピボットの候補の一部だけを持つ、2候補のピア
    const wings = PEERS[pivot].filter(
      (p) =>
        grid[p] === 0 &&
        popCount(masks[p]) === 2 &&
        (masks[p] & ~pivotMask) === 0,
    )

    for (let a = 0; a < wings.length; a++) {
      for (let b = a + 1; b < wings.length; b++) {
        const pincerA = wings[a]
        const pincerB = wings[b]

        // 2つのピンサーで、ピボットの3候補をすべて覆っていること
        if ((masks[pincerA] | masks[pincerB]) !== pivotMask) continue

        // 共通する数字がちょうど1つ。それが消せる候補になる
        const shared = masks[pincerA] & masks[pincerB]
        if (popCount(shared) !== 1) continue
        const z = maskToNumbers(shared)[0]
        const zBit = bit(z)

        const eliminated: { index: number; value: number }[] = []
        for (let i = 0; i < CELL_COUNT; i++) {
          if (i === pivot || i === pincerA || i === pincerB) continue
          if (grid[i] !== 0) continue
          if ((masks[i] & zBit) === 0) continue
          // ピボットも z になりうるので、3マスすべてから見えるマスだけが対象
          if (!isPeer(i, pivot) || !isPeer(i, pincerA) || !isPeer(i, pincerB)) continue
          eliminated.push({ index: i, value: z })
        }
        if (eliminated.length === 0) continue

        const eliminations = eliminationsOf(eliminated)
        const pivotId = cellId(pivot)
        const aId = cellId(pincerA)
        const bId = cellId(pincerB)
        const [x] = maskToNumbers(masks[pincerA] & ~shared)
        const [y] = maskToNumbers(masks[pincerB] & ~shared)
        const units: Unit[] = unitsOf(pivot)

        return makeHint({
          technique: 'XYZ_WING',
          value: z,
          relatedCells: [pivot, pincerA, pincerB, ...eliminated.map((e) => e.index)],
          explanation:
            `${pivotId} = {${x},${y},${z}}、${aId} = {${x},${z}}、${bId} = {${y},${z}} の3マスに注目します。` +
            `${pivotId}が${x}なら${aId}は${z}、${y}なら${bId}は${z}、${z}なら${pivotId}自身が${z}です。` +
            `つまりこの3マスのどれかには必ず${z}が入ります。` +
            `したがって、3マスすべてから見えるマスに${z}は入りません。` +
            `${describeEliminations(eliminations)}を消去できます。`,
          eliminations,
          units,
          candidateMarks: [
            ...focusMarks([pivot], [x, y, z]),
            ...focusMarks([pincerA], [x, z]),
            ...focusMarks([pincerB], [y, z]),
            ...eliminateMarks(eliminations),
          ],
          steps: [
            {
              title: '考え方',
              body:
                `${pivotId}、${aId}、${bId} の3マスに注目してみましょう。\n\n` +
                `${pivotId} = {${x},${y},${z}}\n${aId} = {${x},${z}}\n${bId} = {${y},${z}}\n\n` +
                `${pivotId}に何が入るかで場合分けすると、どうなるでしょうか。`,
            },
            {
              title: 'もう少しヒント',
              body:
                `${pivotId}が${x} → ${aId}は${z}\n` +
                `${pivotId}が${y} → ${bId}は${z}\n` +
                `${pivotId}が${z} → ${pivotId}自身が${z}\n\n` +
                `どの場合でも、この3マスのどれかが${z}になります。\n\n` +
                `では、3マスすべてと同じ行・列・ブロックにあるマス（${joinIds(
                  eliminated.map((e) => e.index),
                )}）は？`,
            },
            {
              title: '答え',
              body:
                `${describeEliminations(eliminations)} を候補から消せます。\n\n` +
                'これは「XYZ-Wing」という推論です。\n' +
                'XY-Wingと違いピボット自身も候補になるため、\n' +
                '3マスすべてから見えるマスしか消せない点に注意します。',
            },
          ],
        })
      }
    }
  }
  return null
}
