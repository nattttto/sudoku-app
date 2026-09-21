'use client'

/**
 * 記録画面（仕様書 24章）。
 *
 * 「何問解いたか」よりも **どの定石が苦手か** を主役にする。
 * このアプリは解き方を教えるアプリなので、記録もその役に立つ形で見せる。
 */
import Link from 'next/link'
import { useMemo, useState, useSyncExternalStore } from 'react'
import { ThemeToggle } from '@/components/ThemeToggle'
import { DIFFICULTY_LABEL } from '@/features/sudoku/board/types'
import { TECHNIQUE_MAP } from '@/features/sudoku/hints/types'
import { formatDateLabel } from '@/features/sudoku/stats/daily'
import {
  formatDuration,
  summarize,
  weakestTechniques,
} from '@/features/sudoku/stats/stats'
import {
  clearRecords,
  getRecords,
  getRecordsServer,
  subscribeRecords,
} from '@/features/sudoku/stats/storage'

export default function StatsPage() {
  const records = useSyncExternalStore(subscribeRecords, getRecords, getRecordsServer)
  const stats = useMemo(() => summarize(records), [records])
  const weakest = useMemo(() => weakestTechniques(stats.byTechnique), [stats.byTechnique])
  const [confirmingClear, setConfirmingClear] = useState(false)

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-5">
      <header className="mb-5 flex items-center justify-between gap-2">
        <Link href="/" className="text-sm" style={{ color: 'var(--muted)' }}>
          ← ホーム
        </Link>
        <h1 className="text-base font-semibold">記録</h1>
        <ThemeToggle />
      </header>

      {stats.totalPlayed === 0 ? (
        <Card>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            まだ記録がありません。1問解くとここに残ります。
          </p>
          <Link
            href="/"
            className="mt-3 inline-block rounded-lg px-4 py-2 text-sm font-medium"
            style={{ background: 'var(--input)', color: 'var(--surface)' }}
          >
            数独を始める
          </Link>
        </Card>
      ) : (
        <div className="flex flex-col gap-5">
          {/* 全体 */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="解いた問題" value={`${stats.totalPlayed}`} />
            <Stat label="連続日数" value={`${stats.dailyStreak} 日`} />
            <Stat
              label="ノーヒント"
              value={`${stats.byDifficulty.reduce((sum, d) => sum + d.noHintCount, 0)} 問`}
            />
            <Stat
              label="ミス合計"
              value={`${stats.byDifficulty.reduce((sum, d) => sum + d.totalMistakes, 0)} 回`}
            />
          </div>

          {/* 苦手な定石 */}
          <Card>
            <h2 className="text-sm font-semibold">定石の習熟度</h2>
            <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
              その定石が必要だった問題のうち、ヒントに頼った割合です。高いほど苦手です。
            </p>

            {weakest.length > 0 && (
              <p className="mt-3 text-xs">
                いま一番の伸びしろは{' '}
                <span className="font-semibold">{TECHNIQUE_MAP[weakest[0].id].name}</span> です。
              </p>
            )}

            <ul className="mt-3 space-y-2.5">
              {stats.byTechnique
                .filter((t) => t.requiredIn > 0)
                .map((t) => {
                  const meta = TECHNIQUE_MAP[t.id]
                  const ratio = t.requiredIn > 0 ? t.hintedIn / t.requiredIn : 0
                  return (
                    <li key={t.id}>
                      <div className="flex items-baseline justify-between gap-2 text-xs">
                        <span className="font-medium">{meta.name}</span>
                        <span className="tabular shrink-0" style={{ color: 'var(--muted)' }}>
                          {t.requiredIn} 問中 {t.hintedIn} 問でヒント
                        </span>
                      </div>
                      <div
                        className="mt-1 h-1.5 w-full overflow-hidden rounded-full"
                        style={{ background: 'var(--peer)' }}
                        role="img"
                        aria-label={`${meta.name} のヒント依存度 ${Math.round(ratio * 100)}パーセント`}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.max(ratio * 100, ratio > 0 ? 4 : 0)}%`,
                            background: ratio > 0.5 ? 'var(--danger)' : 'var(--hint-keep)',
                          }}
                        />
                      </div>
                    </li>
                  )
                })}
            </ul>

            {stats.byTechnique.every((t) => t.requiredIn === 0) && (
              <p className="mt-3 text-xs" style={{ color: 'var(--muted)' }}>
                まだ集計できる定石がありません。
              </p>
            )}
          </Card>

          {/* 難易度別 */}
          <Card>
            <h2 className="text-sm font-semibold">難易度別</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ color: 'var(--muted)' }}>
                    <th className="pb-2 text-left font-normal">難易度</th>
                    <th className="pb-2 text-right font-normal">問題数</th>
                    <th className="pb-2 text-right font-normal">最速</th>
                    <th className="pb-2 text-right font-normal">平均</th>
                    <th className="pb-2 text-right font-normal">ノーヒント</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.byDifficulty.map((row) => (
                    <tr key={row.difficulty} style={{ borderTop: '1px solid var(--line)' }}>
                      <td className="py-2">{DIFFICULTY_LABEL[row.difficulty]}</td>
                      <td className="tabular py-2 text-right">{row.played}</td>
                      <td className="tabular py-2 text-right">
                        {row.bestMs === null ? '—' : formatDuration(row.bestMs)}
                      </td>
                      <td className="tabular py-2 text-right">
                        {row.averageMs === null ? '—' : formatDuration(row.averageMs)}
                      </td>
                      <td className="tabular py-2 text-right">{row.noHintCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* 直近30日 */}
          <Card>
            <h2 className="text-sm font-semibold">直近30日</h2>
            <div className="mt-3 flex items-end gap-[3px]" style={{ height: 56 }}>
              {stats.dailyCounts.map((day) => {
                const max = Math.max(...stats.dailyCounts.map((d) => d.count), 1)
                return (
                  <div
                    key={day.date}
                    className="flex-1 rounded-sm"
                    title={`${day.date} : ${day.count}問`}
                    style={{
                      height: `${Math.max((day.count / max) * 100, 3)}%`,
                      background: day.count > 0 ? 'var(--input)' : 'var(--peer)',
                    }}
                  />
                )
              })}
            </div>
            <div
              className="mt-1 flex justify-between text-[11px]"
              style={{ color: 'var(--muted)' }}
            >
              <span>{formatDateLabel(stats.dailyCounts[0].date)}</span>
              <span>{formatDateLabel(stats.dailyCounts.at(-1)!.date)}</span>
            </div>
          </Card>

          {/* 履歴 */}
          <Card>
            <h2 className="text-sm font-semibold">最近の記録</h2>
            <ul className="mt-3 divide-y" style={{ borderColor: 'var(--line)' }}>
              {stats.recent.map((record) => (
                <li key={record.id} className="flex items-baseline justify-between gap-2 py-2">
                  <span className="text-xs">
                    {record.daily ? '今日の数独' : DIFFICULTY_LABEL[record.difficulty]}
                    <span className="ml-2" style={{ color: 'var(--muted)' }}>
                      {new Date(record.completedAt).toLocaleString('ja-JP', {
                        month: 'numeric',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </span>
                  <span className="tabular shrink-0 text-xs" style={{ color: 'var(--muted)' }}>
                    {formatDuration(record.elapsedMs)}・ヒント {record.hintCount}・ミス{' '}
                    {record.mistakes}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          {/* 記録の削除 */}
          <div className="text-center text-xs">
            {confirmingClear ? (
              <span className="flex items-center justify-center gap-2">
                <span style={{ color: 'var(--danger)' }}>記録をすべて消しますか？</span>
                <button
                  type="button"
                  onClick={() => {
                    clearRecords()
                    setConfirmingClear(false)
                  }}
                  className="rounded border px-2 py-1"
                  style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
                >
                  消す
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingClear(false)}
                  className="rounded border px-2 py-1"
                  style={{ borderColor: 'var(--line)' }}
                >
                  やめる
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingClear(true)}
                style={{ color: 'var(--muted)' }}
              >
                記録をすべて消す
              </button>
            )}
          </div>
        </div>
      )}
    </main>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section
      className="rounded-xl border p-4"
      style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}
    >
      {children}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-xl border p-3 text-center"
      style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}
    >
      <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
        {label}
      </p>
      <p className="tabular mt-1 text-lg font-semibold">{value}</p>
    </div>
  )
}
