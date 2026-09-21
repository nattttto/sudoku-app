'use client'

/** ホーム画面（仕様書 18.1）。難易度を選んで開始するだけのシンプルな構成。 */
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { DIFFICULTIES, DIFFICULTY_LABEL } from '@/features/sudoku/board/types'
import type { Difficulty } from '@/features/sudoku/board/types'
import { loadSavedGame } from '@/features/sudoku/game/storage'
import { prefetch } from '@/features/sudoku/generator/puzzleSource'

const formatTime = (ms: number): string => {
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

export default function HomePage() {
  const [saved, setSaved] = useState<{ difficulty: Difficulty; elapsedMs: number } | null>(null)

  useEffect(() => {
    const game = loadSavedGame()
    if (game) {
      setSaved({ difficulty: game.puzzle.difficulty, elapsedMs: game.elapsedMs })
    }
    // よく使う難易度を先に1問作っておく
    for (const difficulty of DIFFICULTIES) prefetch(difficulty)
  }, [])

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-5 py-12">
      <header className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Sudoku</h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>
          答えではなく、解き方を教える数独
        </p>
      </header>

      <nav className="flex flex-col gap-2">
        {DIFFICULTIES.map((difficulty) => (
          <Link
            key={difficulty}
            href={`/sudoku?difficulty=${difficulty}`}
            className="rounded-xl border px-4 py-3.5 text-center text-base font-medium transition-colors"
            style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}
          >
            {DIFFICULTY_LABEL[difficulty]}
          </Link>
        ))}
      </nav>

      {saved && (
        <div className="flex flex-col gap-2">
          <div className="h-px w-full" style={{ background: 'var(--line)' }} />
          <Link
            href="/sudoku?resume=1"
            className="rounded-xl border px-4 py-3.5 text-center text-base font-medium"
            style={{ borderColor: 'var(--input)', color: 'var(--input)' }}
          >
            続きから
            <span className="ml-2 text-xs" style={{ color: 'var(--muted)' }}>
              {DIFFICULTY_LABEL[saved.difficulty]}・{formatTime(saved.elapsedMs)}
            </span>
          </Link>
        </div>
      )}
    </main>
  )
}
