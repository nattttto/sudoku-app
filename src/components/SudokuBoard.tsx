'use client'

/**
 * 9×9盤面。
 * どのマスをどう強調するかを組み立てて SudokuCell に渡す。
 */
import { useMemo } from 'react'
import { CELL_COUNT, boxOf, colOf, rowOf } from '@/features/sudoku/board/board'
import { maskToNumbers } from '@/features/sudoku/candidates/candidateEngine'
import type { HintView } from '@/features/sudoku/hints/hintView'
import type { GameState } from '@/features/sudoku/game/gameState'
import { SudokuCell } from './SudokuCell'

type Props = {
  state: GameState
  /** 盤面から計算した候補（ヒントで消した分は除外済み） */
  autoCandidates: number[]
  conflicts: Set<number>
  hintView: HintView
  /** ヒント表示中か（関係ないマスを薄くする） */
  hintActive: boolean
  onSelect: (index: number) => void
}

export function SudokuBoard({
  state,
  autoCandidates,
  conflicts,
  hintView,
  hintActive,
  onSelect,
}: Props) {
  const selected = state.selected
  const selectedValue = selected === null ? 0 : state.grid[selected]

  const cells = useMemo(() => {
    return Array.from({ length: CELL_COUNT }, (_, index) => {
      const value = state.grid[index]
      const notes = maskToNumbers(state.notes[index])
      // 手書きメモがあればそれを優先し、無ければ（表示ONのとき）自動候補を出す
      const candidates =
        value !== 0
          ? []
          : notes.length > 0
            ? notes
            : state.showCandidates
              ? maskToNumbers(autoCandidates[index])
              : []

      const isPeer =
        selected !== null &&
        selected !== index &&
        (rowOf(selected) === rowOf(index) ||
          colOf(selected) === colOf(index) ||
          boxOf(selected) === boxOf(index))

      return {
        index,
        value,
        isGiven: state.givens[index] !== 0,
        isError: conflicts.has(index),
        isSelected: selected === index,
        isPeer,
        isSameValue: selectedValue !== 0 && value === selectedValue && selected !== index,
        candidates,
        noteCandidates: notes,
        dimmed: hintActive && !hintView.inScope.has(index),
      }
    })
  }, [state, autoCandidates, conflicts, selected, selectedValue, hintActive, hintView])

  return (
    <div
      className="grid w-full grid-cols-9 overflow-hidden rounded-sm"
      style={{ borderColor: 'var(--line-strong)' }}
    >
      {cells.map((cell) => (
        <SudokuCell key={cell.index} {...cell} hintView={hintView} onSelect={onSelect} />
      ))}
    </div>
  )
}
