/**
 * ② Hidden Single（仕様書 8.1）
 * ある行・列・3×3ブロックの中で、特定の数字を置けるセルが1つしかない場合。
 *
 * 探索順はブロック → 行 → 列。ブロックのほうが人間には見つけやすいため。
 */
import { ALL_UNITS, cellId, unitIndices, unitLabel } from '../board/board'
import { bit } from '../candidates/candidateEngine'
import type { Unit, UnitType } from '../board/types'
import { focusMarks, joinIds, makeHint, unitNoun } from './util'
import type { HintRule } from './types'

const SEARCH_ORDER: UnitType[] = ['box', 'row', 'col']

const orderedUnits = (): Unit[] =>
  SEARCH_ORDER.flatMap((type) => ALL_UNITS.filter((u) => u.type === type))

export const hiddenSingle: HintRule = ({ grid, masks }) => {
  for (const unit of orderedUnits()) {
    const indices = unitIndices(unit)
    for (let n = 1; n <= 9; n++) {
      const b = bit(n)
      if (indices.some((i) => grid[i] === n)) continue // すでに置かれている

      const spots = indices.filter((i) => grid[i] === 0 && (masks[i] & b) !== 0)
      if (spots.length !== 1) continue

      const target = spots[0]
      const id = cellId(target)
      const emptyCells = indices.filter((i) => grid[i] === 0)
      const noun = unitNoun(unit)
      const label = unitLabel(unit)

      // 「他のマスがなぜダメか」＝候補に n を持たない空きマス
      const rejected = emptyCells.filter((i) => i !== target)

      return makeHint({
        technique: 'HIDDEN_SINGLE',
        targetCell: target,
        value: n,
        relatedCells: indices,
        explanation:
          `${label}にはまだ${n}がありません。` +
          `${noun}の空いているマスのうち、${n}を入れられるのは ${id} だけです` +
          (rejected.length > 0
            ? `（${joinIds(rejected)} は行・列・ブロックのどこかに、すでに${n}があるため入れられません）。`
            : '。') +
          `よって ${id} = ${n} です。`,
        units: [unit],
        candidateMarks: focusMarks([target], [n]),
        steps: [
          {
            title: '考え方',
            body:
              `「${n}」に注目してみましょう。\n\n` +
              `${label}の中には、まだ${n}がありません。\n` +
              `${noun}のどこに${n}を入れられるか、1マスずつ確かめてみてください。`,
          },
          {
            title: 'もう少しヒント',
            body:
              `${noun}で${n}を入れられる場所は、1か所だけです。\n\n` +
              `→ ${id}`,
          },
          {
            title: '答え',
            body:
              `${id} = ${n}\n\n` +
              'これは「Hidden Single」という推論です。\n' +
              'マスの候補ではなく「数字の置き場所」から攻める定石です。',
          },
        ],
      })
    }
  }
  return null
}
