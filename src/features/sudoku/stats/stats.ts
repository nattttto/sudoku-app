/**
 * プレイ記録の集計。
 * 保存形式に依存しない純粋な関数だけを置く（テストしやすくするため）。
 */
import { DIFFICULTIES } from '../board/types'
import { TECHNIQUES } from '../hints/types'
import type { TechniqueId } from '../hints/types'
import type {
  DailyCount,
  DifficultySummary,
  GameRecord,
  StatsSummary,
  TechniqueSummary,
} from './types'

/** ローカル時間での YYYY-MM-DD */
export const dateKey = (date: Date = new Date()): string => {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** date から days 日前の YYYY-MM-DD */
export const shiftDateKey = (key: string, days: number): string => {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + days)
  return dateKey(date)
}

const summarizeDifficulty = (records: GameRecord[]): DifficultySummary[] =>
  DIFFICULTIES.map((difficulty) => {
    const rows = records.filter((r) => r.difficulty === difficulty)
    const times = rows.map((r) => r.elapsedMs)
    return {
      difficulty,
      played: rows.length,
      bestMs: times.length > 0 ? Math.min(...times) : null,
      averageMs:
        times.length > 0
          ? Math.round(times.reduce((sum, t) => sum + t, 0) / times.length)
          : null,
      noHintCount: rows.filter((r) => r.hintCount === 0).length,
      totalMistakes: rows.reduce((sum, r) => sum + r.mistakes, 0),
    }
  })

/**
 * 定石ごとの集計。
 * 「必要だった問題数」に対して「ヒントに頼った問題数」を並べることで、
 * どの定石が身についていないかを見えるようにする。
 */
const summarizeTechniques = (records: GameRecord[]): TechniqueSummary[] =>
  TECHNIQUES.map(({ id }) => {
    const required = records.filter((r) => r.requiredTechniques.includes(id))
    const hinted = required.filter((r) => (r.hintTechniques[id] ?? 0) > 0)
    return {
      id,
      requiredIn: required.length,
      hintedIn: hinted.length,
      hintCount: records.reduce((sum, r) => sum + (r.hintTechniques[id] ?? 0), 0),
    }
  })

/** 直近 days 日分の、日別プレイ数（古い順） */
const summarizeDaily = (records: GameRecord[], days: number, today: string): DailyCount[] => {
  const counts = new Map<string, number>()
  for (const record of records) {
    const key = dateKey(new Date(record.completedAt))
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return Array.from({ length: days }, (_, i) => {
    const date = shiftDateKey(today, -(days - 1 - i))
    return { date, count: counts.get(date) ?? 0 }
  })
}

/**
 * デイリー数独の連続日数。
 * 今日まだ解いていなくても、昨日まで続いていれば途切れていないものとして数える。
 */
export const dailyStreakOf = (records: GameRecord[], today: string): number => {
  const solved = new Set(records.filter((r) => r.daily).map((r) => r.daily as string))
  if (solved.size === 0) return 0

  let cursor = solved.has(today) ? today : shiftDateKey(today, -1)
  if (!solved.has(cursor)) return 0

  let streak = 0
  while (solved.has(cursor)) {
    streak++
    cursor = shiftDateKey(cursor, -1)
  }
  return streak
}

export const summarize = (
  records: GameRecord[],
  options: { today?: string; recentLimit?: number; dailyDays?: number } = {},
): StatsSummary => {
  const today = options.today ?? dateKey()
  const recentLimit = options.recentLimit ?? 20
  const dailyDays = options.dailyDays ?? 30

  const sorted = [...records].sort((a, b) => b.completedAt - a.completedAt)

  return {
    totalPlayed: records.length,
    byDifficulty: summarizeDifficulty(records),
    byTechnique: summarizeTechniques(records),
    recent: sorted.slice(0, recentLimit),
    dailyCounts: summarizeDaily(records, dailyDays, today),
    dailyStreak: dailyStreakOf(records, today),
  }
}

/** 苦手な定石を、ヒント依存度が高い順に返す */
export const weakestTechniques = (
  summaries: TechniqueSummary[],
  minRequired = 2,
): TechniqueSummary[] =>
  summaries
    .filter((s) => s.requiredIn >= minRequired && s.hintedIn > 0)
    .sort((a, b) => b.hintedIn / b.requiredIn - a.hintedIn / a.requiredIn)

export const formatDuration = (ms: number): string => {
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

export type { TechniqueId }
