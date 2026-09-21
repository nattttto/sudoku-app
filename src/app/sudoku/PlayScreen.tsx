'use client'

/**
 * プレイ画面本体（仕様書 18.2）。
 * 盤面を最優先し、装飾は最小限にする。
 * 広い画面では盤面と操作を左右に分けて、スクロールなしで完結させる。
 */
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { GameControls } from '@/components/GameControls'
import { HintPanel } from '@/components/HintPanel'
import { NumberPad } from '@/components/NumberPad'
import { RestartButton } from '@/components/RestartButton'
import { SudokuBoard } from '@/components/SudokuBoard'
import { ThemeToggle } from '@/components/ThemeToggle'
import { DIFFICULTIES, DIFFICULTY_LABEL } from '@/features/sudoku/board/types'
import type { Difficulty } from '@/features/sudoku/board/types'
import { createGame } from '@/features/sudoku/game/gameState'
import type { GameState } from '@/features/sudoku/game/gameState'
import { clearSavedGame, loadSavedGame } from '@/features/sudoku/game/storage'
import { useSudokuGame } from '@/features/sudoku/game/useSudokuGame'
import { TECHNIQUE_MAP } from '@/features/sudoku/hints/types'
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

/** 続きからの保存データがあればそれを、無ければ新しい問題を用意する */
const decideInitialGame = (difficulty: Difficulty, wantsResume: boolean): GameState => {
  if (wantsResume) {
    const saved = loadSavedGame()
    if (saved) {
      const base = createGame(saved.puzzle)
      return {
        ...base,
        grid: saved.grid,
        notes: saved.notes,
        eliminated: saved.eliminated,
        elapsedMs: saved.elapsedMs,
        hintCount: saved.hintCount,
      }
    }
  }
  return createGame(nextPuzzle(difficulty))
}

export function PlayScreen() {
  const params = useSearchParams()
  const difficulty: Difficulty = isDifficulty(params.get('difficulty'))
    ? (params.get('difficulty') as Difficulty)
    : 'easy'
  const wantsResume = params.get('resume') === '1'

  // URL が変わったら作り直したいので、パラメータを key にして作り直させる
  return (
    <PlayScreenLoader
      key={`${difficulty}:${wantsResume}`}
      difficulty={difficulty}
      wantsResume={wantsResume}
    />
  )
}

function PlayScreenLoader({
  difficulty,
  wantsResume,
}: {
  difficulty: Difficulty
  wantsResume: boolean
}) {
  // 問題の決定は最初の1回だけ。以降は再描画しても同じ問題を使い続ける
  const [initial] = useState<GameState>(() => decideInitialGame(difficulty, wantsResume))

  return <PlayScreenInner key={initial.puzzle.givens} initial={initial} />
}

function PlayScreenInner({ initial }: { initial: GameState }) {
  const {
    state,
    dispatch,
    autoCandidates,
    conflicts,
    remaining,
    requiredTechniques,
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
  const hasNotes = useMemo(() => state.notes.some((n) => n !== 0), [state.notes])

  useEffect(() => {
    if (solved) clearSavedGame()
  }, [solved])

  return (
    <main
      className="mx-auto w-full max-w-md px-2 py-3 sm:px-4 lg:max-w-5xl lg:px-6"
      // ヒントのシートが開いているときは、下の操作が隠れないように余白を足す
      style={{ paddingBottom: (hintActive || notice) && !solved ? '19rem' : undefined }}
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <Link href="/" className="text-sm" style={{ color: 'var(--muted)' }}>
          ← ホーム
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">{DIFFICULTY_LABEL[state.puzzle.difficulty]}</span>
          <span className="tabular text-sm" style={{ color: 'var(--muted)' }}>
            {formatTime(state.elapsedMs)}
          </span>
          <ThemeToggle />
        </div>
      </header>

      {solved ? (
        <ClearPanel
          state={state}
          techniques={requiredTechniques}
          elapsed={formatTime(state.elapsedMs)}
        />
      ) : (
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-6">
          {/* 盤面 */}
          <div className="lg:mx-auto lg:w-full lg:max-w-[34rem]">
            <div className="relative">
              <SudokuBoard
                state={state}
                autoCandidates={autoCandidates}
                conflicts={conflicts}
                hintView={hintView}
                hintActive={hintActive}
                onSelect={(index) => dispatch({ type: 'tapCell', index })}
              />
              {state.paused && (
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-md"
                  style={{ background: 'var(--surface)' }}
                >
                  <p className="text-base font-medium">休憩中</p>
                  <p className="text-sm" style={{ color: 'var(--muted)' }}>
                    タイマーを止めています
                  </p>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'togglePause' })}
                    className="rounded-lg px-4 py-2 text-sm font-medium"
                    style={{ background: 'var(--input)', color: 'var(--surface)' }}
                  >
                    ▶ 再開する
                  </button>
                </div>
              )}
            </div>

            <div
              className="mt-2 flex items-center justify-between gap-2 text-xs"
              style={{ color: 'var(--muted)' }}
            >
              <span>
                残り {emptyCount} マス・ヒント {state.hintCount} 回
                {conflicts.size > 0 && (
                  <span style={{ color: 'var(--danger)' }}>・重複 {conflicts.size} マス</span>
                )}
              </span>
              <RestartButton onRestart={restart} />
            </div>
          </div>

          {/* 操作 */}
          <div className="mt-3 flex flex-col gap-3 lg:mt-0">
            <NumberPad
              inputStyle={state.inputStyle}
              mode={state.mode}
              activeDigit={state.activeDigit}
              remaining={remaining}
              noCellSelected={state.selected === null}
              disabled={state.paused}
              onSelectDigit={(digit) => dispatch({ type: 'selectDigit', digit })}
              onInput={(value) => dispatch({ type: 'input', value })}
              onErase={() => dispatch({ type: 'erase' })}
              onToggleMode={() => dispatch({ type: 'toggleMode' })}
              onSetInputStyle={(style) => dispatch({ type: 'setInputStyle', style })}
            />

            <GameControls
              canUndo={state.past.length > 0}
              canRedo={state.future.length > 0}
              showCandidates={state.showCandidates}
              hasNotes={hasNotes}
              paused={state.paused}
              disabled={state.paused}
              onUndo={() => dispatch({ type: 'undo' })}
              onRedo={() => dispatch({ type: 'redo' })}
              onToggleCandidates={() => dispatch({ type: 'toggleCandidates' })}
              onFillNotes={() => dispatch({ type: 'fillAllNotes' })}
              onClearNotes={() => dispatch({ type: 'clearAllNotes' })}
              onTogglePause={() => dispatch({ type: 'togglePause' })}
            />

            <button
              type="button"
              onClick={requestHint}
              disabled={state.paused}
              className="rounded-xl border px-4 py-2.5 text-sm font-medium disabled:opacity-40"
              style={{ borderColor: 'var(--input)', color: 'var(--input)' }}
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

            <KeyboardHelp />
          </div>
        </div>
      )}
    </main>
  )
}

/** PC でのキーボード操作の案内。狭い画面では出さない */
function KeyboardHelp() {
  return (
    <details className="hidden text-xs lg:block" style={{ color: 'var(--muted)' }}>
      <summary className="cursor-pointer">キーボードで操作する</summary>
      <ul className="mt-2 space-y-1 pl-4">
        <li>矢印キー … マスを移動</li>
        <li>1〜9 … 数字を入力（数字優先モードでは数字を選択）</li>
        <li>Enter … 選択中のマスに入力（数字優先モード）</li>
        <li>Backspace … 消す</li>
        <li>Space … メモ入力の切り替え</li>
        <li>Esc … 選択中の数字を解除</li>
        <li>Ctrl+Z / Ctrl+Shift+Z … 戻す / 進む</li>
      </ul>
    </details>
  )
}

/** クリア画面。この問題に必要だった定石を振り返れるようにする */
function ClearPanel({
  state,
  techniques,
  elapsed,
}: {
  state: GameState
  techniques: string[]
  elapsed: string
}) {
  return (
    <section
      className="mx-auto max-w-md rounded-2xl border p-5 text-center"
      style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}
    >
      <p className="text-xl font-semibold">クリア！</p>
      <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
        {DIFFICULTY_LABEL[state.puzzle.difficulty]}・{elapsed}・ヒント {state.hintCount} 回
      </p>

      {techniques.length > 0 && (
        <div className="mt-4 text-left">
          <p className="text-sm font-medium">この問題に必要だった定石</p>
          <ul className="mt-2 space-y-1.5">
            {techniques.map((id) => {
              const meta = TECHNIQUE_MAP[id as keyof typeof TECHNIQUE_MAP]
              if (!meta) return null
              return (
                <li key={id} className="text-xs">
                  <span className="font-medium">{meta.name}</span>
                  <span className="ml-2" style={{ color: 'var(--muted)' }}>
                    {meta.summary}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <div className="mt-5 flex justify-center gap-2">
        <Link
          href={`/sudoku?difficulty=${state.puzzle.difficulty}`}
          className="rounded-lg px-4 py-2 text-sm font-medium"
          style={{ background: 'var(--input)', color: 'var(--surface)' }}
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
  )
}
