'use client'

/**
 * 盤面の1マス。
 * 数字・候補・各種ハイライトの表示だけを担当する。
 */
import { memo } from 'react'
import { boxOf, colOf, rowOf } from '@/features/sudoku/board/board'
import { isFocusCandidate, isRemoveCandidate } from '@/features/sudoku/hints/hintView'
import type { HintView } from '@/features/sudoku/hints/hintView'

export type CellProps = {
  index: number
  value: number
  isGiven: boolean
  isError: boolean
  isSelected: boolean
  /** 選択中のマスと同じ行または列（十字） */
  isPeerLine: boolean
  /** 選択中のマスと同じブロック（十字の外） */
  isPeerBox: boolean
  /** 注目中の数字（選択マスの数字、または数字優先モードで選択中の数字）と同じ */
  isHighlighted: boolean
  /** 注目中の数字。メモの中の同じ数字を強調するのに使う。無ければ 0 */
  focusDigit: number
  /** ブロック完成の演出を始めるまでの遅れ（ミリ秒）。演出しないなら null */
  celebrateDelay: number | null
  /** 表示する候補（自動候補 or 手書きメモ） */
  candidates: number[]
  /** 手書きメモの候補（自動候補と区別して表示する） */
  noteCandidates: number[]
  hintView: HintView
  /** ヒント表示中で、このマスが推論に関係しないか */
  dimmed: boolean
  onSelect: (index: number) => void
}

/**
 * 背景色の優先順位。
 * 重複は最優先で見せる。見落とすと後の推論がすべて無駄になるため。
 * 選択中であることは背景ではなく枠線で示すので、ここでは扱わない。
 */
const cellBackground = (p: CellProps): string => {
  if (p.isError) return 'var(--danger-bg)'
  if (p.hintView.targetCell === p.index) return 'var(--hint-target)'
  if (p.hintView.relatedCells.has(p.index)) return 'var(--hint-related)'
  if (p.hintView.unitCells.has(p.index)) return 'var(--hint-unit)'
  if (p.isHighlighted) return 'var(--same)'
  if (p.isPeerLine) return 'var(--peer-line)'
  if (p.isPeerBox) return 'var(--peer-box)'
  // 3×3ブロックを市松に塗り分けて、まとまりを見えやすくする
  const box = boxOf(p.index)
  const checker = (Math.floor(box / 3) + (box % 3)) % 2 === 1
  return checker ? 'var(--surface-alt)' : 'var(--surface)'
}

function SudokuCellBase(props: CellProps) {
  const { index, value, isGiven, isError, candidates, noteCandidates, hintView } = props
  const row = rowOf(index)
  const col = colOf(index)
  const noteSet = new Set(noteCandidates)

  // 3×3ブロックの境界だけ線を太くする
  const borderStyle = {
    borderTopWidth: row % 3 === 0 ? 3 : 1,
    borderLeftWidth: col % 3 === 0 ? 3 : 1,
    borderRightWidth: col === 8 ? 3 : 0,
    borderBottomWidth: row === 8 ? 3 : 0,
    borderTopColor: row % 3 === 0 ? 'var(--line-strong)' : 'var(--line)',
    borderLeftColor: col % 3 === 0 ? 'var(--line-strong)' : 'var(--line)',
    borderRightColor: 'var(--line-strong)',
    borderBottomColor: 'var(--line-strong)',
  }

  const color = isError ? 'var(--danger)' : isGiven ? 'var(--foreground)' : 'var(--input)'

  return (
    <button
      type="button"
      aria-label={`R${row + 1}C${col + 1}${value ? ` = ${value}` : ' 空きマス'}${
        isError ? '、重複しています' : ''
      }`}
      onClick={() => props.onSelect(index)}
      className={`relative flex aspect-square items-center justify-center border-solid transition-colors select-none ${
        isError ? 'cell-error' : ''
      } ${props.celebrateDelay !== null ? 'cell-celebrate' : ''}`}
      style={{
        ...borderStyle,
        background: cellBackground(props),
        opacity: props.dimmed ? 0.3 : 1,
        animationDelay:
          props.celebrateDelay !== null ? `${props.celebrateDelay}ms` : undefined,
        // 選択中は内側の枠で示す。背景を奪わないので重複やヒントと共存できる
        boxShadow: props.isSelected ? 'inset 0 0 0 3px var(--ring)' : undefined,
        zIndex: props.isSelected ? 1 : undefined,
      }}
    >
      {value !== 0 ? (
        <span
          className="tabular leading-none"
          style={{
            color,
            fontSize: 'clamp(1.15rem, 5.4vw, 1.9rem)',
            fontWeight: isGiven ? 700 : 500,
          }}
        >
          {value}
        </span>
      ) : candidates.length > 0 ? (
        <span className="grid h-full w-full grid-cols-3 grid-rows-3 p-[2px]">
          {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => {
            const shown = candidates.includes(n)
            const focus = isFocusCandidate(hintView, index, n)
            const remove = isRemoveCandidate(hintView, index, n)
            // 注目中の数字と同じメモは、丸で囲んで目立たせる（ヒントの強調が優先）
            const matches = shown && !focus && !remove && n === props.focusDigit
            return (
              <span key={n} className="flex items-center justify-center">
                <span
                  className="tabular flex aspect-square h-[88%] items-center justify-center rounded-full leading-none"
                  style={{
                    fontSize: 'clamp(0.5rem, 2vw, 0.7rem)',
                    color: remove
                      ? 'var(--hint-remove)'
                      : focus
                        ? 'var(--hint-keep)'
                        : matches
                          ? 'var(--note-focus-ink)'
                          : noteSet.has(n)
                            ? 'var(--input)'
                            : 'var(--muted)',
                    background: matches ? 'var(--note-focus)' : undefined,
                    fontWeight: focus || remove || matches ? 700 : 500,
                    textDecoration: remove ? 'line-through' : 'none',
                    opacity: shown ? 1 : 0,
                  }}
                >
                  {n}
                </span>
              </span>
            )
          })}
        </span>
      ) : null}
    </button>
  )
}

export const SudokuCell = memo(SudokuCellBase)
