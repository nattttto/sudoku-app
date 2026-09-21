/**
 * ヒントエンジン（仕様書 7章・10章）。
 *
 *   現在の盤面 → 候補を計算 → 各種解法ルールを検索 →
 *   最初に発見した論理的な手をヒントとして返す
 *
 * ルールはやさしい順に検索する。AIは使わず、決定論的に動作する。
 */
import { CELL_COUNT, parseCellId } from '../board/board'
import { computeCandidateMasks, bit } from '../candidates/candidateEngine'
import type { Grid } from '../board/types'
import { hiddenPair } from './hiddenPair'
import { hiddenSingle } from './hiddenSingle'
import { hiddenTriple } from './hiddenTriple'
import { lockedCandidates } from './lockedCandidates'
import { nakedPair } from './nakedPair'
import { nakedSingle } from './nakedSingle'
import { nakedTriple } from './nakedTriple'
import { jellyfish } from './jellyfish'
import { swordfish } from './swordfish'
import { xWing } from './xWing'
import { xyWing } from './xyWing'
import { xyzWing } from './xyzWing'
import { TECHNIQUE_MAP } from './types'
import type { Hint, HintContext, HintRule, TechniqueId } from './types'

/** 検索順＝仕様書10章の優先順位 */
export const RULES: { id: TechniqueId; rule: HintRule }[] = [
  { id: 'NAKED_SINGLE', rule: nakedSingle },
  { id: 'HIDDEN_SINGLE', rule: hiddenSingle },
  { id: 'LOCKED_CANDIDATES', rule: lockedCandidates },
  { id: 'NAKED_PAIR', rule: nakedPair },
  { id: 'HIDDEN_PAIR', rule: hiddenPair },
  { id: 'NAKED_TRIPLE', rule: nakedTriple },
  { id: 'HIDDEN_TRIPLE', rule: hiddenTriple },
  { id: 'X_WING', rule: xWing },
  { id: 'XY_WING', rule: xyWing },
  { id: 'XYZ_WING', rule: xyzWing },
  { id: 'SWORDFISH', rule: swordfish },
  { id: 'JELLYFISH', rule: jellyfish },
]

/** 空の消去マスク（1セルにつき「消された候補」のビット） */
export const emptyEliminated = (): number[] => new Array<number>(CELL_COUNT).fill(0)

/**
 * 現在の盤面から候補マスクを作る。
 * @param eliminated すでに適用済みのヒントで消された候補
 */
export const buildContext = (grid: Grid, eliminated?: number[]): HintContext => {
  const masks = computeCandidateMasks(grid)
  if (eliminated) {
    for (let i = 0; i < CELL_COUNT; i++) masks[i] &= ~eliminated[i]
  }
  return { grid, masks }
}

/**
 * 次の一手を探す。
 * @param maxLevel このレベル以下のテクニックだけを使う（省略時は全部）
 */
export const findHint = (
  grid: Grid,
  eliminated?: number[],
  maxLevel = 4,
): Hint | null => {
  const ctx = buildContext(grid, eliminated)
  for (const { id, rule } of RULES) {
    if (TECHNIQUE_MAP[id].level > maxLevel) continue
    const hint = rule(ctx)
    if (hint) return hint
  }
  return null
}

/** ヒントの消去内容を eliminated マスクに反映した新しい配列を返す */
export const applyEliminations = (eliminated: number[], hint: Hint): number[] => {
  const next = eliminated.slice()
  for (const e of hint.eliminations) {
    const index = parseCellId(e.cell)
    if (index >= 0) next[index] |= bit(e.value)
  }
  return next
}

export type AnalysisResult = {
  /** 論理的に最後まで解けたか */
  solved: boolean
  /** 使用したテクニック（検索順） */
  techniques: TechniqueId[]
  /** テクニックごとの使用回数 */
  counts: Partial<Record<TechniqueId, number>>
  /** 最も難しかったテクニック */
  hardest: TechniqueId | null
  /** 手数 */
  moveCount: number
}

/**
 * ヒントエンジンだけで盤面を解き、どのテクニックが必要だったかを記録する。
 * 難易度判定（仕様書14章・15章）に使う。
 */
export const analyze = (input: Grid, maxLevel = 4): AnalysisResult => {
  const grid = input.slice()
  let eliminated = emptyEliminated()
  const counts: Partial<Record<TechniqueId, number>> = {}
  const order: TechniqueId[] = []
  let moveCount = 0

  // 81手あれば必ず埋まる。消去のみの手もあるので余裕を持たせる
  for (let guard = 0; guard < 500; guard++) {
    if (grid.every((v) => v !== 0)) {
      return {
        solved: true,
        techniques: order,
        counts,
        hardest: hardestOf(order),
        moveCount,
      }
    }

    const hint = findHint(grid, eliminated, maxLevel)
    if (!hint) break

    counts[hint.technique] = (counts[hint.technique] ?? 0) + 1
    if (!order.includes(hint.technique)) order.push(hint.technique)
    moveCount++

    if (hint.targetCell && hint.value !== undefined) {
      const index = parseCellId(hint.targetCell)
      if (index < 0) break
      grid[index] = hint.value
    } else if (hint.eliminations.length > 0) {
      eliminated = applyEliminations(eliminated, hint)
    } else {
      break
    }
  }

  return {
    solved: grid.every((v) => v !== 0),
    techniques: order,
    counts,
    hardest: hardestOf(order),
    moveCount,
  }
}

const hardestOf = (techniques: readonly TechniqueId[]): TechniqueId | null => {
  let hardest: TechniqueId | null = null
  for (const id of techniques) {
    if (!hardest || TECHNIQUE_MAP[id].weight > TECHNIQUE_MAP[hardest].weight) hardest = id
  }
  return hardest
}
