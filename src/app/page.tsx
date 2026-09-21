'use client'

/** ホーム画面（仕様書 18.1）。難易度を選んで開始するだけのシンプルな構成。 */
import Link from 'next/link'
import { useEffect, useSyncExternalStore } from 'react'
import { ThemeToggle } from '@/components/ThemeToggle'
import { DIFFICULTIES, DIFFICULTY_LABEL } from '@/features/sudoku/board/types'
import {
  getSavedSummary,
  getSavedSummaryServer,
  subscribeSavedGame,
} from '@/features/sudoku/game/storage'
import { prefetch } from '@/features/sudoku/generator/puzzleSource'
import { dailyDifficulty, dateKey, formatDateLabel } from '@/features/sudoku/stats/daily'
import { dailyStreakOf } from '@/features/sudoku/stats/stats'
import { getRecords, getRecordsServer, subscribeRecords } from '@/features/sudoku/stats/storage'

const formatTime = (ms: number): string => {
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

export default function HomePage() {
  // 保存データはブラウザ側にしかないので、外部ストアとして読み取る
  const saved = useSyncExternalStore(subscribeSavedGame, getSavedSummary, getSavedSummaryServer)
  const records = useSyncExternalStore(subscribeRecords, getRecords, getRecordsServer)

  const today = dateKey()
  const streak = dailyStreakOf(records, today)
  const solvedToday = records.some((record) => record.daily === today)

  useEffect(() => {
    // よく使う難易度を先に1問作っておく
    for (const difficulty of DIFFICULTIES) prefetch(difficulty)
  }, [])

  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-5 py-12">
      <div className="absolute top-4 right-5">
        <ThemeToggle />
      </div>

      <header className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Sudoku</h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>
          答えではなく、解き方を教える数独
        </p>
      </header>

      {/* 今日の数独。日付から決まるので、いつ開いても同じ問題になる */}
      <Link
        href="/sudoku?daily=1"
        className="rounded-xl border px-4 py-3.5 text-center"
        style={{ borderColor: 'var(--input)', background: 'var(--surface)' }}
      >
        <span className="text-base font-medium" style={{ color: 'var(--input)' }}>
          今日の数独
        </span>
        <span className="mt-0.5 block text-xs" style={{ color: 'var(--muted)' }}>
          {formatDateLabel(today)}・{DIFFICULTY_LABEL[dailyDifficulty(today)]}
          {solvedToday ? '・クリア済み' : ''}
          {streak > 0 ? `・${streak}日連続` : ''}
        </span>
      </Link>

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

      <Link href="/stats" className="text-center text-sm" style={{ color: 'var(--muted)' }}>
        記録を見る
      </Link>
    </main>
  )
}
