/**
 * ① Naked Single（仕様書 8.1）
 * あるセルに残っている候補が1つだけの場合、その数字が確定する。
 */
import { CELL_COUNT, PEERS, cellId, unitsOf } from '../board/board'
import { maskToNumbers, popCount } from '../candidates/candidateEngine'
import { focusMarks, joinNumbers, makeHint } from './util'
import type { HintRule } from './types'

export const nakedSingle: HintRule = ({ grid, masks }) => {
  for (let i = 0; i < CELL_COUNT; i++) {
    if (grid[i] !== 0) continue
    if (popCount(masks[i]) !== 1) continue

    const value = maskToNumbers(masks[i])[0]
    const id = cellId(i)

    // 除外の根拠になっているセル（同じ行・列・ブロックで数字が入っているセル）
    const filledPeers = PEERS[i].filter((p) => grid[p] !== 0)
    const excluded = [...new Set(filledPeers.map((p) => grid[p]))].sort((a, b) => a - b)

    return makeHint({
      technique: 'NAKED_SINGLE',
      targetCell: i,
      value,
      relatedCells: [i, ...filledPeers],
      explanation:
        `${id}と同じ行・列・3×3ブロックには ${joinNumbers(excluded)} が入っています。` +
        `これらを1〜9から除外すると、残る候補は${value}だけです。よって ${id} = ${value} です。`,
      units: unitsOf(i),
      candidateMarks: focusMarks([i], [value]),
      steps: [
        {
          title: '考え方',
          body:
            `${id} のマスに注目してみましょう。\n\n` +
            'このマスと同じ行・同じ列・同じ3×3ブロックに、すでにどの数字があるか書き出してみてください。',
        },
        {
          title: 'もう少しヒント',
          body:
            `${id} のまわりには ${joinNumbers(excluded)} があります。\n\n` +
            '1〜9からこれらを取り除くと、入れられる数字はたった1つしか残りません。',
        },
        {
          title: '答え',
          body:
            `${id} = ${value}\n\n` +
            'これは「Naked Single」という推論です。\n' +
            '候補が1つしか残っていないマスを見つける、最も基本的な定石です。',
        },
      ],
    })
  }
  return null
}
