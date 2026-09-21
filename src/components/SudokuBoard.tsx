'use client'

/**
 * 9×9盤面。
 * どのマスをどう強調するかを組み立てて SudokuCell に渡す。
 */
import { useMemo } from 'react'
import { CELL_COUNT, boxOf, colOf, rowOf, unitIndices } from '@/features/sudoku/board/board'
import { maskToNumbers } from '@/features/sudoku/candidates/candidateEngine'
import type { HintView } from '@/features/sudoku/hints/hintView'
import type { GameState } from '@/features/sudoku/game/gameState'
import { SudokuCell } from './SudokuCell'
import { UnitCelebration } from './UnitCelebration'

type Props = {
  state: GameState
  /** 盤面から計算した候補（ヒントで消した分は除外済み） */
  autoCandidates: number[]
  /** 不正解の数字が入っているマス。赤く表示する */
  wrongCells: Set<number>
  hintView: HintView
  /** ヒント表示中か（関係ないマスを薄くする） */
  hintActive: boolean
  onSelect: (index: number) => void
}

/** 演出が完成マスから波のように広がる間隔（ミリ秒） */
const WAVE_STEP_MS = 70

export function SudokuBoard({
  state,
  autoCandidates,
  wrongCells,
  hintView,
  hintActive,
  onSelect,
}: Props) {
  const isDigitFirst = state.inputStyle === 'digit'
  // 数字優先では「どのマスを選んだか」に意味が無いので、選択の強調は出さない
  const selected = isDigitFirst ? null : state.selected

  /**
   * 盤面で強調する数字。
   * 数字優先では選んでいる数字、マス優先では選択中のマスの数字。
   * 数字だけでなく、メモの中の同じ数字も強調する。
   */
  const focusValue = isDigitFirst
    ? typeof state.activeDigit === 'number'
      ? state.activeDigit
      : 0
    : selected !== null
      ? state.grid[selected]
      : 0

  const celebration = state.celebration
  const rejection = state.rejection

  /** 完成したユニットに含まれるマス */
  const celebratedCells = useMemo(() => {
    const cells = new Set<number>()
    for (const unit of celebration?.units ?? []) {
      for (const i of unitIndices(unit)) cells.add(i)
    }
    return cells
  }, [celebration])

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

      const related = selected !== null && selected !== index
      // 十字（行・列）とブロックを塗り分ける。十字が見えないと選択位置を追えない
      const isPeerLine =
        related && (rowOf(selected!) === rowOf(index) || colOf(selected!) === colOf(index))
      const isPeerBox = related && !isPeerLine && boxOf(selected!) === boxOf(index)

      // 完成した行・列・ブロックは、最後に置いたマスからの距離に応じて少しずつ遅らせて光らせる
      const celebrateDelay =
        celebration && celebratedCells.has(index)
          ? Math.max(
              Math.abs(rowOf(index) - rowOf(celebration.origin)),
              Math.abs(colOf(index) - colOf(celebration.origin)),
            ) * WAVE_STEP_MS
          : null

      return {
        index,
        value,
        isGiven: state.givens[index] !== 0,
        isError: wrongCells.has(index),
        isSelected: selected === index,
        isPeerLine,
        isPeerBox,
        isHighlighted: focusValue !== 0 && value === focusValue && selected !== index,
        focusDigit: focusValue,
        candidates,
        noteCandidates: notes,
        dimmed: hintActive && !hintView.inScope.has(index),
        celebrateDelay,
        rejectKey: rejection && rejection.index === index ? rejection.id : null,
      }
    })
  }, [
    state,
    autoCandidates,
    wrongCells,
    selected,
    focusValue,
    hintActive,
    hintView,
    celebration,
    celebratedCells,
    rejection,
  ])

  return (
    <div
      className="relative grid w-full grid-cols-9 overflow-hidden rounded-md"
      style={{ background: 'var(--surface)' }}
    >
      {cells.map((cell) => (
        <SudokuCell key={cell.index} {...cell} hintView={hintView} onSelect={onSelect} />
      ))}
      {celebration && (
        <UnitCelebration
          // key は「どの完成か」だけで決める。他の操作のたびに作り直すと演出が再生し直されてしまう。
          // 同じユニットが再び完成するのは Undo で一度 null を経た後だけなので、これで足りる
          key={`${celebration.units.map((u) => `${u.type}${u.index}`).join('-')}@${celebration.origin}`}
          units={celebration.units}
          origin={celebration.origin}
        />
      )}
    </div>
  )
}
