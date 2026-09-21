'use client'

/**
 * プレイ画面本体（仕様書 18.2）。
 * 盤面を最優先し、装飾は最小限にする。
 */
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { GameControls } from '@/components/GameControls'
import { HintPanel } from '@/components/HintPanel'
import { NumberPad } from '@/components/NumberPad'
import { SudokuBoard } from '@/components/SudokuBoard'
import { DIFFICULTIES, DIFFICULTY_LABEL } from '@/features/sudoku/board/types'
import type { Difficulty } from '@/features/sudoku/board/types'
import { createGame } from '@/features/sudoku/game/gameState'
import type { GameState } from '@/features/sudoku/game/gameState'
import { clearSavedGame, loadSavedGame } from '@/features/sudoku/game/storage'
import { useSudokuGame } from '@/features/sudoku/game/useSudokuGame'
import { nextPuzzle } from '@/features/sudoku/generator/puzzleSource'

const formatTime = (ms: number): string => {
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

const isDifficulty = (value: string | null): value is Difficulty =>
  value !== null && (DIFFICULTIES as string[]).includes(value)

export function PlayScreen() {
  const params = useSearchParams()
  const difficulty: Difficulty = isDifficulty(params.get('difficulty'))
    ? (params.get('difficulty') as Difficulty)
    : 'easy'
  const wantsResume = params.get('resume') === '1'

  // 問題の決定はクライアント側で行う（保存データと乱数を使うため）
  const [initial, setInitial] = useState<GameState | null>(null)

  useEffect(() => {
    if (wantsResume) {
      const saved = loadSavedGame()
      if (saved) {
        const base = createGame(saved.puzzle)
        setInitial({
          ...base,
          grid: saved.grid,
          notes: saved.notes,
          eliminated: saved.eliminated,
          elapsedMs: saved.elapsedMs,
          hintCount: saved.hintCount,
        })
        return
      }
    }
    setInitial(createGame(nextPuzzle(difficulty)))
  }, [difficulty, wantsResume])

  if (!initial) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md items-center justify-center px-5">
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          問題を準備しています…
        </p>
      </main>
    )
  }

  return <PlayScreenInner key={initial.puzzle.givens} initial={initial} />
}

function PlayScreenInner({ initial }: { initial: GameState }) {
  const {
    state,
    dispatch,
    autoCandidates,
    conflicts,
    remaining,
    hint,
    hintStep,
    hintView,
    notice,
    requestHint,
    nextHintStep,
    applyHint,
    closeHint,
    restart,
  } = useSudokuGame(initial)

  const solved = state.status === 'solved'
  const hintActive = hint !== null

  const emptyCount = useMemo(
    () => state.grid.filter((value) => value === 0).length,
    [state.grid],
  )

  useEffect(() => {
    if (solved) clearSavedGame()
  }, [solved])

  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-3 px-3 py-4 sm:px-5"
      // ヒントのシートが開いているときは、下の操作が隠れないように余白を足す
      style={{ paddingBottom: hintActive || notice ? '18rem' : undefined }}
    >
      <header className="flex items-center justify-between">
        <Link href="/" className="text-sm" style={{ color: 'var(--muted)' }}>
          ← ホーム
        </Link>
        <span className="text-sm font-medium">{DIFFICULTY_LABEL[state.puzzle.difficulty]}</span>
        <span className="tabular text-sm" style={{ color: 'var(--muted)' }}>
          {formatTime(state.elapsedMs)}
        </span>
      </header>

      <SudokuBoard
        state={state}
        autoCandidates={autoCandidates}
        conflicts={conflicts}
        hintView={hintView}
        hintActive={hintActive}
        onSelect={(index) => dispatch({ type: 'select', index })}
      />

      <div className="flex items-center justify-between text-xs" style={{ color: 'var(--muted)' }}>
        <span>残り {emptyCount} マス</span>
        <span>
          ヒント {state.hintCount} 回
          {conflicts.size > 0 && (
            <span style={{ color: 'var(--danger)' }}>・重複 {conflicts.size} マス</span>
          )}
        </span>
      </div>

      {solved ? (
        <section
          className="rounded-xl border p-4 text-center"
          style={{ borderColor: 'var(--input)', background: 'var(--surface)' }}
        >
          <p className="text-lg font-semibold">クリア！</p>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
            {DIFFICULTY_LABEL[state.puzzle.difficulty]}・{formatTime(state.elapsedMs)}・ヒント{' '}
            {state.hintCount} 回
          </p>
          <div className="mt-3 flex justify-center gap-2">
            <Link
              href={`/sudoku?difficulty=${state.puzzle.difficulty}`}
              className="rounded-lg px-4 py-2 text-sm font-medium"
              style={{ background: 'var(--input)', color: '#fff' }}
            >
              次の問題
            </Link>
            <Link
              href="/"
              className="rounded-lg border px-4 py-2 text-sm"
              style={{ borderColor: 'var(--line)' }}
            >
              ホームへ
            </Link>
          </div>
        </section>
      ) : (
        <>
          <NumberPad
            mode={state.mode}
            remaining={remaining}
            disabled={state.selected === null}
            onInput={(value) => dispatch({ type: 'input', value })}
            onErase={() => dispatch({ type: 'erase' })}
            onToggleMode={() => dispatch({ type: 'toggleMode' })}
          />

          <GameControls
            canUndo={state.past.length > 0}
            canRedo={state.future.length > 0}
            showCandidates={state.showCandidates}
            onUndo={() => dispatch({ type: 'undo' })}
            onRedo={() => dispatch({ type: 'redo' })}
            onToggleCandidates={() => dispatch({ type: 'toggleCandidates' })}
            onRestart={restart}
          />

          <button
            type="button"
            onClick={requestHint}
            className="rounded-xl px-4 py-3 text-base font-medium"
            style={{ background: 'var(--input)', color: '#fff' }}
          >
            💡 ヒント
          </button>

          <HintPanel
            hint={hint}
            step={hintStep}
            notice={notice}
            onNext={nextHintStep}
            onApply={applyHint}
            onClose={closeHint}
          />
        </>
      )}
    </main>
  )
}
