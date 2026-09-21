/**
 * プレイ記録（仕様書 24章）。
 *
 * 記録の目的は「何問解いたか」よりも、
 * **どの定石が苦手なのか**を本人に見せることに置く。
 * そのため、必要だった定石とヒントを使った定石の両方を残す。
 */
import type { Difficulty } from '../board/types'
import type { TechniqueId } from '../hints/types'

export type GameRecord = {
  /** 完了時刻をもとにした一意なID */
  id: string
  difficulty: Difficulty
  /** 問題の初期配置（81文字）。同じ問題を再現するために持つ */
  givens: string
  elapsedMs: number
  /** ヒントを開いた回数 */
  hintCount: number
  /** ヒントで見た定石とその回数 */
  hintTechniques: Partial<Record<TechniqueId, number>>
  /** 解答と違う数字を入れた回数 */
  mistakes: number
  /** この問題を解くのに必要だった定石 */
  requiredTechniques: TechniqueId[]
  /** 完了時刻（epoch ms） */
  completedAt: number
  /** デイリー数独として解いた場合の日付（YYYY-MM-DD） */
  daily?: string
}

/** 難易度ごとの集計 */
export type DifficultySummary = {
  difficulty: Difficulty
  played: number
  bestMs: number | null
  averageMs: number | null
  /** ヒントを1回も使わずに解いた回数 */
  noHintCount: number
  totalMistakes: number
}

/**
 * 定石ごとの集計。
 * requiredIn に対して hintedIn が多いほど、その定石が身についていない。
 */
export type TechniqueSummary = {
  id: TechniqueId
  /** その定石が必要だった問題数 */
  requiredIn: number
  /** そのうちヒントに頼った問題数 */
  hintedIn: number
  /** ヒントで見た合計回数 */
  hintCount: number
}

/** 日別のプレイ数 */
export type DailyCount = {
  /** YYYY-MM-DD */
  date: string
  count: number
}

export type StatsSummary = {
  totalPlayed: number
  byDifficulty: DifficultySummary[]
  byTechnique: TechniqueSummary[]
  recent: GameRecord[]
  dailyCounts: DailyCount[]
  /** デイリー数独の連続日数 */
  dailyStreak: number
}
