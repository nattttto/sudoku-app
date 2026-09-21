/**
 * ヒントルール共通のヘルパー。
 * 各ルールが「推論情報つきのヒント」を組み立てやすくする。
 */
import { cellId, unitLabel } from '../board/board'
import type { Unit } from '../board/types'
import type { CandidateMark, Elimination, Hint, HintStep, TechniqueId } from './types'
import { TECHNIQUE_MAP } from './types'

/** index 配列 → "R4C7" 配列 */
export const toIds = (indices: readonly number[]): string[] => indices.map(cellId)

/** "R4C7、R4C9" のような読み上げ用の列挙 */
export const joinIds = (indices: readonly number[]): string => toIds(indices).join('、')

/** "2と7" / "2・5・8" のような数字の列挙 */
export const joinNumbers = (numbers: readonly number[]): string => {
  if (numbers.length === 2) return `${numbers[0]}と${numbers[1]}`
  return numbers.join('・')
}

export const eliminationsOf = (
  pairs: readonly { index: number; value: number }[],
): Elimination[] => pairs.map(({ index, value }) => ({ cell: cellId(index), value }))

export const focusMarks = (
  indices: readonly number[],
  values: readonly number[],
): CandidateMark[] =>
  indices.flatMap((index) =>
    values.map<CandidateMark>((value) => ({ cell: cellId(index), value, kind: 'focus' })),
  )

export const eliminateMarks = (eliminations: readonly Elimination[]): CandidateMark[] =>
  eliminations.map((e) => ({ cell: e.cell, value: e.value, kind: 'eliminate' }))

/** ユニットの説明。"この行" / "この列" / "この3×3ブロック" */
export const unitNoun = (unit: Unit): string =>
  unit.type === 'row' ? 'この行' : unit.type === 'col' ? 'この列' : 'この3×3ブロック'

export { unitLabel }

type HintInput = {
  technique: TechniqueId
  targetCell?: number
  value?: number
  relatedCells: readonly number[]
  explanation: string
  eliminations?: Elimination[]
  units: Unit[]
  candidateMarks?: CandidateMark[]
  steps: [HintStep, HintStep, HintStep]
}

export const makeHint = (input: HintInput): Hint => {
  const meta = TECHNIQUE_MAP[input.technique]
  const eliminations = input.eliminations ?? []
  return {
    technique: input.technique,
    techniqueName: meta.name,
    targetCell: input.targetCell === undefined ? undefined : cellId(input.targetCell),
    value: input.value,
    relatedCells: toIds(input.relatedCells),
    explanation: input.explanation,
    eliminations,
    units: input.units,
    candidateMarks: input.candidateMarks ?? eliminateMarks(eliminations),
    steps: input.steps,
  }
}

/** 消去内容を日本語でまとめる。"R2C1から2、R2C5から2と7" */
export const describeEliminations = (eliminations: readonly Elimination[]): string => {
  const byCell = new Map<string, number[]>()
  for (const e of eliminations) {
    const list = byCell.get(e.cell)
    if (list) list.push(e.value)
    else byCell.set(e.cell, [e.value])
  }
  return [...byCell.entries()]
    .map(([cell, values]) => `${cell}から${joinNumbers(values.sort((a, b) => a - b))}`)
    .join('、')
}

/** 配列から k 個を選ぶ組み合わせ */
export const combinations = <T>(items: readonly T[], k: number): T[][] => {
  const result: T[][] = []
  const pick = (start: number, current: T[]): void => {
    if (current.length === k) {
      result.push(current.slice())
      return
    }
    for (let i = start; i < items.length; i++) {
      current.push(items[i])
      pick(i + 1, current)
      current.pop()
    }
  }
  pick(0, [])
  return result
}
