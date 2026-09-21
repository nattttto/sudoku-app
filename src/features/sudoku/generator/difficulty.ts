/**
 * 難易度判定（仕様書 14章）。
 *
 * 初期数字の数ではなく「解くのにどの解法が必要だったか」で判定する。
 *
 *   Easy   : Naked Single / Hidden Single だけで解ける
 *   Normal : Locked Candidates / Naked Pair が必要
 *   Hard   : Hidden Pair / Triple系 が必要
 *   Expert : X-Wing / XY-Wing が必要
 */
import type { Difficulty } from '../board/types'
import { TECHNIQUE_MAP } from '../hints/types'
import type { AnalysisResult } from '../hints/hintEngine'

export type DifficultyBand = {
  difficulty: Difficulty
  /** 最も難しいテクニックの weight がこの範囲なら該当 */
  minWeight: number
  maxWeight: number
  /** 生成時にこれ以上は数字を減らさない */
  minGivens: number
}

export const DIFFICULTY_BANDS: DifficultyBand[] = [
  { difficulty: 'easy', minWeight: 0, maxWeight: 2, minGivens: 32 },
  { difficulty: 'normal', minWeight: 3, maxWeight: 5, minGivens: 28 },
  { difficulty: 'hard', minWeight: 6, maxWeight: 9, minGivens: 24 },
  { difficulty: 'expert', minWeight: 10, maxWeight: Infinity, minGivens: 22 },
]

export const bandOf = (difficulty: Difficulty): DifficultyBand =>
  DIFFICULTY_BANDS.find((b) => b.difficulty === difficulty)!

/** 解析結果に含まれる最難テクニックの重み */
export const hardestWeight = (analysis: AnalysisResult): number =>
  analysis.hardest ? TECHNIQUE_MAP[analysis.hardest].weight : 0

/**
 * 解析結果から難易度を決める。
 * 論理的に解けなかった場合は null（問題として採用しない）。
 */
export const difficultyOf = (analysis: AnalysisResult): Difficulty | null => {
  if (!analysis.solved) return null
  const weight = hardestWeight(analysis)
  const band = DIFFICULTY_BANDS.find((b) => weight >= b.minWeight && weight <= b.maxWeight)
  return band ? band.difficulty : 'expert'
}

/** 人間向けの難易度スコア（参考値）。手数とテクニックの重みから算出 */
export const difficultyScore = (analysis: AnalysisResult): number => {
  let score = 0
  for (const [id, count] of Object.entries(analysis.counts)) {
    const meta = TECHNIQUE_MAP[id as keyof typeof TECHNIQUE_MAP]
    if (meta) score += meta.weight * (count ?? 0)
  }
  return score
}
