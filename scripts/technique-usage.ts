/**
 * 実際に生成した問題で、どの定石がどれだけ使われるかを数える（開発者向け）。
 * 高度な解法が本当に出番を持つかの確認に使う。
 *
 * npx tsx scripts/technique-usage.ts [難易度] [問題数]
 */
import { parseGrid } from '../src/features/sudoku/board/board'
import type { Difficulty } from '../src/features/sudoku/board/types'
import { generatePuzzle } from '../src/features/sudoku/generator/generator'
import { analyze } from '../src/features/sudoku/hints/hintEngine'
import { TECHNIQUES } from '../src/features/sudoku/hints/types'
import type { TechniqueId } from '../src/features/sudoku/hints/types'

const difficulty = (process.argv[2] ?? 'expert') as Difficulty
const count = Number(process.argv[3] ?? 30)

const puzzlesUsing: Partial<Record<TechniqueId, number>> = {}
const hardestCount: Partial<Record<TechniqueId, number>> = {}
let generated = 0

const start = Date.now()
for (let i = 0; i < count; i++) {
  const puzzle = generatePuzzle(difficulty)
  if (!puzzle) continue
  generated++
  const analysis = analyze(parseGrid(puzzle.givens))
  for (const id of analysis.techniques) {
    puzzlesUsing[id] = (puzzlesUsing[id] ?? 0) + 1
  }
  if (analysis.hardest) {
    hardestCount[analysis.hardest] = (hardestCount[analysis.hardest] ?? 0) + 1
  }
}

console.log(`${difficulty}: ${generated}問 (${Date.now() - start}ms)\n`)
console.log('定石            使われた問題数  最難だった問題数')
for (const { id, name } of TECHNIQUES) {
  console.log(
    `${name.padEnd(18)} ${String(puzzlesUsing[id] ?? 0).padStart(6)} ${String(
      hardestCount[id] ?? 0,
    ).padStart(12)}`,
  )
}
