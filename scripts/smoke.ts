/** エンジンの動作確認用スクリプト（開発者向け）。npx tsx scripts/smoke.ts */
import { DIFFICULTIES } from '../src/features/sudoku/board/types'
import { parseGrid } from '../src/features/sudoku/board/board'
import { analyze, findHint } from '../src/features/sudoku/hints/hintEngine'
import { generatePuzzle } from '../src/features/sudoku/generator/generator'
import { hasUniqueSolution } from '../src/features/sudoku/solver/solver'

for (const difficulty of DIFFICULTIES) {
  const start = Date.now()
  const puzzle = generatePuzzle(difficulty)
  const ms = Date.now() - start
  if (!puzzle) {
    console.log(`${difficulty}: 生成失敗 (${ms}ms)`)
    continue
  }
  const grid = parseGrid(puzzle.givens)
  const givens = puzzle.givens.split('').filter((c) => c !== '.').length
  const analysis = analyze(grid)
  console.log(
    `${difficulty.padEnd(7)} givens=${givens} unique=${hasUniqueSolution(grid)} ` +
      `solved=${analysis.solved} moves=${analysis.moveCount} ${ms}ms`,
  )
  console.log(`  techniques: ${analysis.techniques.join(', ')}`)
  const hint = findHint(grid)
  console.log(`  first hint: ${hint?.techniqueName} ${hint?.targetCell ?? ''} ${hint?.value ?? ''}`)
  console.log(`  ${hint?.explanation}`)
}
