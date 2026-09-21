/**
 * XY-Wing（仕様書 9章 Lv.3）
 *
 * 候補が2つだけのセルを3つ使う推論。
 *   ピボット  = {x, y}
 *   ピンサー1 = {x, z}（ピボットと同じ行・列・ブロック）
 *   ピンサー2 = {y, z}（ピボットと同じ行・列・ブロック）
 *
 * ピボットには x か y が入るので、どちらの場合でもピンサーのどちらかが z になる。
 * したがって、両方のピンサーから見えるマスに z は入らない。
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

export const xyWing: HintRule = ({ grid, masks }) => {
  const biValue: number[] = []
  for (let i = 0; i < CELL_COUNT; i++) {
    if (grid[i] === 0 && popCount(masks[i]) === 2) biValue.push(i)
  }

  for (const pivot of biValue) {
    const [x, y] = maskToNumbers(masks[pivot])
    const peers = PEERS[pivot].filter((p) => biValue.includes(p))

    for (const pincerA of peers) {
      const aValues = maskToNumbers(masks[pincerA])
      // ピンサーA は x を含み、y は含まない
      if (!aValues.includes(x) || aValues.includes(y)) continue
      const z = aValues.find((v) => v !== x)
      if (z === undefined) continue

      for (const pincerB of peers) {
        if (pincerB === pincerA) continue
        const bValues = maskToNumbers(masks[pincerB])
        // ピンサーB は y と z を持つ
        if (!bValues.includes(y) || !bValues.includes(z)) continue
        if (bValues.includes(x)) continue

        const zBit = bit(z)
        const eliminated: { index: number; value: number }[] = []
        for (let i = 0; i < CELL_COUNT; i++) {
          if (i === pivot || i === pincerA || i === pincerB) continue
          if (grid[i] !== 0) continue
          if ((masks[i] & zBit) === 0) continue
          if (!isPeer(i, pincerA) || !isPeer(i, pincerB)) continue
          eliminated.push({ index: i, value: z })
        }
        if (eliminated.length === 0) continue

        const eliminations = eliminationsOf(eliminated)
        const pivotId = cellId(pivot)
        const aId = cellId(pincerA)
        const bId = cellId(pincerB)
        const units: Unit[] = [...unitsOf(pivot)]

        return makeHint({
          technique: 'XY_WING',
          value: z,
          relatedCells: [pivot, pincerA, pincerB, ...eliminated.map((e) => e.index)],
          explanation:
            `${pivotId} = {${x},${y}}、${aId} = {${x},${z}}、${bId} = {${y},${z}} の3マスに注目します。` +
            `${pivotId}には${x}か${y}が入ります。` +
            `${x}なら${aId}は${z}に、${y}なら${bId}は${z}になります。` +
            `つまりどちらに転んでも、${aId}か${bId}のどちらかは必ず${z}です。` +
            `したがって、この2マスの両方から見えるマスに${z}は入りません。` +
            `${describeEliminations(eliminations)}を消去できます。`,
          eliminations,
          units,
          candidateMarks: [
            ...focusMarks([pivot], [x, y]),
            ...focusMarks([pincerA], [x, z]),
            ...focusMarks([pincerB], [y, z]),
            ...eliminateMarks(eliminations),
          ],
          steps: [
            {
              title: '考え方',
              body:
                `候補が2つだけのマス ${pivotId}、${aId}、${bId} に注目してみましょう。\n\n` +
                `${pivotId} = {${x},${y}}\n${aId} = {${x},${z}}\n${bId} = {${y},${z}}\n\n` +
                `${pivotId}に${x}が入るとき、${aId}はどうなるでしょうか。`,
            },
            {
              title: 'もう少しヒント',
              body:
                `${pivotId}が${x}なら → ${aId}は${z}\n` +
                `${pivotId}が${y}なら → ${bId}は${z}\n\n` +
                `${pivotId}には${x}か${y}しか入らないので、\n` +
                `${aId}と${bId}のどちらかは必ず${z}になります。\n\n` +
                `では、その両方と同じ行・列・ブロックにあるマス（${joinIds(eliminated.map((e) => e.index))}）は？`,
            },
            {
              title: '答え',
              body:
                `${describeEliminations(eliminations)} を候補から消せます。\n\n` +
                'これは「XY-Wing」という推論です。\n' +
                '2候補のマス3つを連鎖させて、「どちらに転んでも消える候補」を見つけます。',
            },
          ],
        })
      }
    }
  }
  return null
}
