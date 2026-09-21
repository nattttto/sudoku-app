'use client'

/**
 * プレイ画面本体（仕様書 18.2）。
 * 盤面を最優先し、装飾は最小限にする。
 * 広い画面では盤面と操作を左右に分けて、スクロールなしで完結させる。
 */
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { GameControls } from '@/components/GameControls'
import { HintPanel } from '@/components/HintPanel'
import { NumberPad } from '@/components/NumberPad'
import { RestartButton } from '@/components/RestartButton'
import { SoundToggle } from '@/components/SoundToggle'
import { SudokuBoard } from '@/components/SudokuBoard'
import { ThemeToggle } from '@/components/ThemeToggle'
import { DIFFICULTIES, DIFFICULTY_LABEL } from '@/features/sudoku/board/types'
import type { Difficulty } from '@/features/sudoku/board/types'
import { canAddNote, createGame, isSettled } from '@/features/sudoku/game/gameState'
import type { GameState } from '@/features/sudoku/game/gameState'
import { clearSavedGame, loadSavedGame } from '@/features/sudoku/game/storage'
import { useSudokuGame } from '@/features/sudoku/game/useSudokuGame'
import { TECHNIQUE_MAP } from '@/features/sudoku/hints/types'
import { nextPuzzle } from '@/features/sudoku/generator/puzzleSource'
import { dailyPuzzle, dateKey, formatDateLabel } from '@/features/sudoku/stats/daily'
import { addRecord } from '@/features/sudoku/stats/storage'

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

type StartMode =
  | { kind: 'new'; difficulty: Difficulty }
  | { kind: 'resume' }
  | { kind: 'daily'; date: string }

/** 続きからの保存データがあればそれを、無ければ新しい問題を用意する */
const decideInitialGame = (mode: StartMode): GameState => {
  if (mode.kind === 'daily') {
    return createGame(dailyPuzzle(mode.date), mode.date)
  }
  if (mode.kind === 'resume') {
    const saved = loadSavedGame()
    if (saved) {
      const base = createGame(saved.puzzle, saved.dailyDate)
      return {
        ...base,
        grid: saved.grid,
        notes: saved.notes,
        eliminated: saved.eliminated,
        elapsedMs: saved.elapsedMs,
        hintCount: saved.hintCount,
        hintTechniques: saved.hintTechniques ?? {},
        mistakes: saved.mistakes ?? 0,
      }
    }
    return createGame(nextPuzzle('easy'))
  }
  return createGame(nextPuzzle(mode.difficulty))
}

export function PlayScreen() {
  const params = useSearchParams()

  const mode: StartMode = params.get('daily')
    ? { kind: 'daily', date: dateKey() }
    : params.get('resume') === '1'
      ? { kind: 'resume' }
      : {
          kind: 'new',
          difficulty: isDifficulty(params.get('difficulty'))
            ? (params.get('difficulty') as Difficulty)
            : 'easy',
        }

  // URL が変わったら作り直したいので、パラメータを key にして作り直させる
  const key =
    mode.kind === 'daily' ? `daily:${mode.date}` : mode.kind === 'resume' ? 'resume' : mode.difficulty

  return <PlayScreenLoader key={key} mode={mode} />
}

function PlayScreenLoader({ mode }: { mode: StartMode }) {
  // 問題の決定は最初の1回だけ。以降は再描画しても同じ問題を使い続ける
  const [initial] = useState<GameState>(() => decideInitialGame(mode))

  return <PlayScreenInner key={initial.puzzle.givens} initial={initial} />
}

function PlayScreenInner({ initial }: { initial: GameState }) {
  const {
    state,
    dispatch,
    autoCandidates,
    wrongCells,
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

  // マス優先で選んでいるマスについて、確定済みか・どの数字がメモできないかを出す
  const selectedSettled = state.selected !== null && isSettled(state, state.selected)
  const blockedNotes = useMemo(() => {
    const blocked = new Set<number>()
    const index = state.selected
    if (index === null || state.grid[index] !== 0) return blocked
    for (let n = 1; n <= 9; n++) {
      const alreadyNoted = (state.notes[index] & (1 << (n - 1))) !== 0
      // すでに書いてあるメモは外せるように、押せるままにしておく
      if (!alreadyNoted && !canAddNote(state, index, n)) blocked.add(n)
    }
    return blocked
  }, [state])

  // クリアしたら記録を1回だけ残す
  const recorded = useRef(false)
  useEffect(() => {
    if (!solved || recorded.current) return
    recorded.current = true
    clearSavedGame()
    addRecord({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      difficulty: state.puzzle.difficulty,
      givens: state.puzzle.givens,
      elapsedMs: state.elapsedMs,
      hintCount: state.hintCount,
      hintTechniques: state.hintTechniques,
      mistakes: state.mistakes,
      requiredTechniques: requiredTechniques,
      completedAt: Date.now(),
      daily: state.dailyDate,
    })
  }, [solved, state, requiredTechniques])

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
          <span className="text-sm font-medium">
            {state.dailyDate
              ? `今日の数独・${DIFFICULTY_LABEL[state.puzzle.difficulty]}`
              : DIFFICULTY_LABEL[state.puzzle.difficulty]}
          </span>
          <span className="tabular text-sm" style={{ color: 'var(--muted)' }}>
            {formatTime(state.elapsedMs)}
          </span>
          <SoundToggle />
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
                wrongCells={wrongCells}
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
                残り {emptyCount} マス・ヒント {state.hintCount} 回・ミス {state.mistakes} 回
                {wrongCells.size > 0 && (
                  <span style={{ color: 'var(--danger)' }}>・間違い {wrongCells.size} マス</span>
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
              selectedSettled={selectedSettled}
              blockedNotes={blockedNotes}
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
        {state.dailyDate
          ? `今日の数独 ${formatDateLabel(state.dailyDate)}・`
          : `${DIFFICULTY_LABEL[state.puzzle.difficulty]}・`}
        {elapsed}
      </p>

      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        {[
          ['タイム', elapsed],
          ['ヒント', `${state.hintCount} 回`],
          ['ミス', `${state.mistakes} 回`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border p-2" style={{ borderColor: 'var(--line)' }}>
            <dt className="text-[11px]" style={{ color: 'var(--muted)' }}>
              {label}
            </dt>
            <dd className="tabular mt-0.5 text-sm font-medium">{value}</dd>
          </div>
        ))}
      </dl>

      {techniques.length > 0 && (
        <div className="mt-4 text-left">
          <p className="text-sm font-medium">この問題に必要だった定石</p>
          <ul className="mt-2 space-y-1.5">
            {techniques.map((id) => {
              const meta = TECHNIQUE_MAP[id as keyof typeof TECHNIQUE_MAP]
              if (!meta) return null
              const hinted = state.hintTechniques[id as keyof typeof TECHNIQUE_MAP] ?? 0
              return (
                <li key={id} className="flex items-baseline justify-between gap-2 text-xs">
                  <span>
                    <span className="font-medium">{meta.name}</span>
                    <span className="ml-2" style={{ color: 'var(--muted)' }}>
                      {meta.summary}
                    </span>
                  </span>
                  <span
                    className="shrink-0"
                    style={{ color: hinted > 0 ? 'var(--danger)' : 'var(--hint-keep)' }}
                  >
                    {hinted > 0 ? `ヒント${hinted}回` : '自力'}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Link
          href={`/sudoku?difficulty=${state.puzzle.difficulty}`}
          className="rounded-lg px-4 py-2 text-sm font-medium"
          style={{ background: 'var(--input)', color: 'var(--surface)' }}
        >
          次の問題
        </Link>
        <Link
          href="/stats"
          className="rounded-lg border px-4 py-2 text-sm"
          style={{ borderColor: 'var(--line)' }}
        >
          記録を見る
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
