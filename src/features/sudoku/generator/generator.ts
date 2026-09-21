/**
 * 問題生成（仕様書 4章・15章）。
 *
 *   完成盤面を生成
 *     ↓
 *   数字をランダムに削除
 *     ↓
 *   一意解かチェック
 *     ↓
 *   ヒントエンジンで論理的に解けるか確認
 *     ↓
 *   使用する解法から難易度判定
 *     ↓
 *   条件に合わなければ破棄
 */
import { CELL_COUNT, cloneGrid, gridToString } from '../board/board'
import { analyze } from '../hints/hintEngine'
import { generateSolvedGrid, hasUniqueSolution, shuffleArray } from '../solver/solver'
import type { Difficulty, Grid, Puzzle } from '../board/types'
import { bandOf, difficultyOf, hardestWeight } from './difficulty'

export type GenerateOptions = {
  /** 乱数（テストで固定したい場合に差し替える） */
  random?: () => number
  /** 1問あたりの試行回数の上限 */
  maxAttempts?: number
  /** 打ち切りまでの時間（ミリ秒） */
  timeBudgetMs?: number
}

/**
 * 1回の試行が目標の難易度に当たる確率は高くない。
 * 数字を削り切った問題の難易度はほぼ運で決まり、
 * 特に Hard 帯（最難が Hidden Pair / Triple 系）に落ちるのは 2 割程度しかない。
 * 1試行が数十ミリ秒と軽いので、試行回数を多めに取って確実に当てる。
 */
const DEFAULT_MAX_ATTEMPTS = 150
const DEFAULT_TIME_BUDGET_MS = 8000

/**
 * これ以上は数字を減らさない下限。
 * 一意解を持つ標準数独の理論上の最小ヒント数は17個だが、
 * そこまで削ると生成に時間がかかりすぎるため余裕を持たせる。
 */
export const ABSOLUTE_MIN_GIVENS = 21

/**
 * 指定した難易度の問題を1問生成する。
 * 条件を満たせなかった場合は null。
 */
export const generatePuzzle = (
  difficulty: Difficulty,
  options: GenerateOptions = {},
): Puzzle | null => {
  const random = options.random ?? Math.random
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
  const deadline = Date.now() + (options.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS)
  const band = bandOf(difficulty)

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (Date.now() > deadline) break

    const solution = generateSolvedGrid(random)
    const puzzle = cloneGrid(solution)
    let givens = CELL_COUNT
    let weight = 0

    // 削除順をランダムにする。対称性は問わず、難易度を優先する
    for (const index of shuffleArray(
      Array.from({ length: CELL_COUNT }, (_, i) => i),
      random,
    )) {
      // 目標の個数まで減り、かつ目標の難しさに届いていれば終了。
      // まだ簡単すぎる場合は、下限まで削り続けて難易度を上げる。
      if (givens <= band.minGivens && weight >= band.minWeight) break
      if (givens <= ABSOLUTE_MIN_GIVENS) break
      if (puzzle[index] === 0) continue

      const backup = puzzle[index]
      puzzle[index] = 0

      // 一意解でなくなったら戻す
      if (!hasUniqueSolution(puzzle)) {
        puzzle[index] = backup
        continue
      }

      // 目標より難しくなりすぎたら戻す（論理的に解けない場合も戻す）
      const analysis = analyze(puzzle)
      if (!analysis.solved || hardestWeight(analysis) > band.maxWeight) {
        puzzle[index] = backup
        continue
      }

      givens--
      weight = hardestWeight(analysis)
    }

    const analysis = analyze(puzzle)
    if (difficultyOf(analysis) !== difficulty) continue

    return {
      givens: gridToString(puzzle),
      solution: gridToString(solution),
      difficulty,
      techniques: analysis.techniques,
    }
  }

  return null
}

/**
 * 難易度を問わず1問生成し、判定された難易度を返す。
 * プール生成で「とりあえず作って振り分ける」用途に使う。
 */
export const generateAnyPuzzle = (options: GenerateOptions = {}): Puzzle | null => {
  const random = options.random ?? Math.random
  const solution = generateSolvedGrid(random)
  const puzzle = cloneGrid(solution)

  for (const index of shuffleArray(
    Array.from({ length: CELL_COUNT }, (_, i) => i),
    random,
  )) {
    if (puzzle[index] === 0) continue
    const backup = puzzle[index]
    puzzle[index] = 0
    if (!hasUniqueSolution(puzzle)) {
      puzzle[index] = backup
      continue
    }
    const check = analyze(puzzle)
    if (!check.solved) {
      puzzle[index] = backup
    }
  }

  const analysis = analyze(puzzle)
  const difficulty = difficultyOf(analysis)
  if (!difficulty) return null

  return {
    givens: gridToString(puzzle),
    solution: gridToString(solution),
    difficulty,
    techniques: analysis.techniques,
  }
}

/** 問題の妥当性チェック（テスト・プール検証用） */
export const validatePuzzle = (puzzle: Puzzle): boolean => {
  const grid: Grid = puzzle.givens
    .split('')
    .map((ch) => (ch >= '1' && ch <= '9' ? Number(ch) : 0))
  if (!hasUniqueSolution(grid)) return false
  const analysis = analyze(grid)
  return analysis.solved && difficultyOf(analysis) === puzzle.difficulty
}
