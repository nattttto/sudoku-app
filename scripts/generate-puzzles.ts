/**
 * 事前生成の問題プールを作る（仕様書 4.2 ②）。
 * ビルド時に用意しておき、アプリ起動直後でも待たずに遊べるようにする。
 *
 * npx tsx scripts/generate-puzzles.ts [1難易度あたりの問題数]
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { DIFFICULTIES } from '../src/features/sudoku/board/types'
import { generatePuzzle } from '../src/features/sudoku/generator/generator'
import type { Puzzle } from '../src/features/sudoku/board/types'

const COUNT = Number(process.argv[2] ?? 40)
const OUT_DIR = join(process.cwd(), 'src', 'data', 'puzzles')

for (const difficulty of DIFFICULTIES) {
  const puzzles: Puzzle[] = []
  const seen = new Set<string>()
  const start = Date.now()

  while (puzzles.length < COUNT) {
    const puzzle = generatePuzzle(difficulty)
    if (!puzzle || seen.has(puzzle.givens)) continue
    seen.add(puzzle.givens)
    puzzles.push(puzzle)
  }

  const file = join(OUT_DIR, `${difficulty}.json`)
  writeFileSync(file, JSON.stringify(puzzles, null, 0) + '\n', 'utf8')
  console.log(`${difficulty}: ${puzzles.length}問 (${Date.now() - start}ms) → ${file}`)
}
