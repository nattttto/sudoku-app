'use client'

/**
 * 盤面の1マス。
 * 数字・候補・各種ハイライトの表示だけを担当する。
 */
import { memo } from 'react'
import { colOf, rowOf } from '@/features/sudoku/board/board'
import { isFocusCandidate, isRemoveCandidate } from '@/features/sudoku/hints/hintView'
import type { HintView } from '@/features/sudoku/hints/hintView'

export type CellProps = {
  index: number
  value: number
  isGiven: boolean
  isError: boolean
  isSelected: boolean
  /** 選択中のマスと同じ行・列・ブロック */
  isPeer: boolean
  /** 選択中のマスと同じ数字 */
  isSameValue: boolean
  /** 表示する候補（自動候補 or 手書きメモ） */
  candidates: number[]
  /** 手書きメモの候補（自動候補と区別して表示する） */
  noteCandidates: number[]
  hintView: HintView
  /** ヒント表示中で、このマスが推論に関係しないか */
  dimmed: boolean
  onSelect: (index: number) => void
}

const cellBackground = (p: CellProps): string => {
  if (p.hintView.targetCell === p.index) return 'var(--hint-target)'
  if (p.hintView.relatedCells.has(p.index)) return 'var(--hint-related)'
  if (p.hintView.unitCells.has(p.index)) return 'var(--hint-unit)'
  if (p.isSelected) return 'var(--selected)'
  if (p.isError) return 'var(--danger-bg)'
  if (p.isSameValue) return 'var(--same)'
  if (p.isPeer) return 'var(--peer)'
  return 'var(--surface)'
}

function SudokuCellBase(props: CellProps) {
  const { index, value, isGiven, isError, candidates, noteCandidates, hintView } = props
  const row = rowOf(index)
  const col = colOf(index)
  const noteSet = new Set(noteCandidates)

  // 3x3ブロックの境界だけ線を太くする
  const borderStyle = {
    borderTopWidth: row % 3 === 0 ? 2 : 1,
    borderLeftWidth: col % 3 === 0 ? 2 : 1,
    borderRightWidth: col === 8 ? 2 : 0,
    borderBottomWidth: row === 8 ? 2 : 0,
    borderTopColor: row % 3 === 0 ? 'var(--line-strong)' : 'var(--line)',
    borderLeftColor: col % 3 === 0 ? 'var(--line-strong)' : 'var(--line)',
    borderRightColor: 'var(--line-strong)',
    borderBottomColor: 'var(--line-strong)',
  }

  const color = isError ? 'var(--danger)' : isGiven ? 'var(--foreground)' : 'var(--input)'

  return (
    <button
      type="button"
      aria-label={`R${row + 1}C${col + 1}${value ? ` = ${value}` : ' 空きマス'}`}
      onClick={() => props.onSelect(index)}
      className="relative flex aspect-square items-center justify-center border-solid transition-colors select-none"
      style={{
        ...borderStyle,
        background: cellBackground(props),
        opacity: props.dimmed ? 0.35 : 1,
      }}
    >
      {value !== 0 ? (
        <span
          className="tabular leading-none"
          style={{
            color,
            fontSize: 'clamp(1.1rem, 5.2vw, 1.75rem)',
            fontWeight: isGiven ? 600 : 500,
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
            return (
              <span
                key={n}
                className="tabular flex items-center justify-center leading-none"
                style={{
                  fontSize: 'clamp(0.45rem, 1.9vw, 0.66rem)',
                  color: remove
                    ? 'var(--hint-remove)'
                    : focus
                      ? 'var(--hint-keep)'
                      : noteSet.has(n)
                        ? 'var(--input)'
                        : 'var(--muted)',
                  fontWeight: focus || remove ? 700 : 400,
                  textDecoration: remove ? 'line-through' : 'none',
                  opacity: shown ? 1 : 0,
                }}
              >
                {n}
              </span>
            )
          })}
        </span>
      ) : null}
    </button>
  )
}

export const SudokuCell = memo(SudokuCellBase)
