/**
 * ヒントの可視化（仕様書 13章）。
 * Hint を「どのセルをどう強調するか」に変換する。
 *
 * 段階的ヒント（仕様書12章）に合わせて、step が進むほど情報を増やす。
 *   step 0（考え方）      : 関係するユニットだけを示す
 *   step 1（対象を提示）  : 対象セル・根拠セルを示す
 *   step 2（答えと理論）  : 消える候補まで示す
 */
import { parseCellId, unitIndices } from '../board/board'
import type { Unit } from '../board/types'
import type { Hint } from './types'

export type HintView = {
  /** 薄く表示せず通常表示するセル（＝推論に関係するセル） */
  inScope: Set<number>
  /** ユニットの淡い強調 */
  unitCells: Set<number>
  /** 根拠として強調するセル */
  relatedCells: Set<number>
  /** 数字が確定する対象セル */
  targetCell: number | null
  /** 強調する候補 "index:value" */
  focusCandidates: Set<string>
  /** 消去される候補 "index:value" */
  removeCandidates: Set<string>
  /** 注目している数字 */
  value: number | null
}

export const emptyHintView = (): HintView => ({
  inScope: new Set(),
  unitCells: new Set(),
  relatedCells: new Set(),
  targetCell: null,
  focusCandidates: new Set(),
  removeCandidates: new Set(),
  value: null,
})

const key = (index: number, value: number): string => `${index}:${value}`

export const buildHintView = (hint: Hint | null, step: number): HintView => {
  const view = emptyHintView()
  if (!hint) return view

  view.value = hint.value ?? null

  const unitCells = new Set<number>()
  for (const unit of hint.units as Unit[]) {
    for (const i of unitIndices(unit)) unitCells.add(i)
  }
  view.unitCells = unitCells

  if (step >= 1) {
    view.targetCell = hint.targetCell ? parseCellId(hint.targetCell) : null
    for (const id of hint.relatedCells) {
      const index = parseCellId(id)
      if (index >= 0) view.relatedCells.add(index)
    }
    for (const mark of hint.candidateMarks) {
      const index = parseCellId(mark.cell)
      if (index < 0) continue
      if (mark.kind === 'focus') view.focusCandidates.add(key(index, mark.value))
    }
  }

  if (step >= 2) {
    for (const e of hint.eliminations) {
      const index = parseCellId(e.cell)
      if (index < 0) continue
      view.removeCandidates.add(key(index, e.value))
      view.relatedCells.add(index)
    }
  }

  view.inScope = new Set([...unitCells, ...view.relatedCells])
  if (view.targetCell !== null) view.inScope.add(view.targetCell)

  return view
}

export const isFocusCandidate = (view: HintView, index: number, value: number): boolean =>
  view.focusCandidates.has(key(index, value))

export const isRemoveCandidate = (view: HintView, index: number, value: number): boolean =>
  view.removeCandidates.has(key(index, value))
