/**
 * テスト用固定問題の生成（仕様書 4.2 ③ / 20章）。
 *
 * 生成した問題をヒントエンジンで解き進める途中の盤面から、
 * 「そのテクニックが最初に発見される盤面」を1つずつ取り出して保存する。
 *
 * npx tsx scripts/make-test-puzzles.ts
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { gridToString, parseCellId, parseGrid } from '../src/features/sudoku/board/board'
import {
  applyEliminations,
  emptyEliminated,
  findHint,
} from '../src/features/sudoku/hints/hintEngine'
import { RULES } from '../src/features/sudoku/hints/hintEngine'
import { maskToNumbers } from '../src/features/sudoku/candidates/candidateEngine'
import { generateAnyPuzzle } from '../src/features/sudoku/generator/generator'
import type { TechniqueId } from '../src/features/sudoku/hints/types'

type Fixture = {
  technique: TechniqueId
  /** 盤面（81文字） */
  grid: string
  /** ヒント適用前に消去済みの候補（"R1C1:3" 形式） */
  eliminatedBefore: string[]
  expected: {
    targetCell?: string
    value?: number
    eliminations: { cell: string; value: number }[]
    relatedCells: string[]
  }
}

const OUT_DIR = join(process.cwd(), 'src', 'data', 'test-puzzles')

const FILE_NAME: Record<TechniqueId, string> = {
  NAKED_SINGLE: 'naked-single.json',
  HIDDEN_SINGLE: 'hidden-single.json',
  LOCKED_CANDIDATES: 'locked-candidate.json',
  NAKED_PAIR: 'naked-pair.json',
  HIDDEN_PAIR: 'hidden-pair.json',
  NAKED_TRIPLE: 'naked-triple.json',
  HIDDEN_TRIPLE: 'hidden-triple.json',
  X_WING: 'x-wing.json',
  XY_WING: 'xy-wing.json',
  XYZ_WING: 'xyz-wing.json',
  SWORDFISH: 'swordfish.json',
  JELLYFISH: 'jellyfish.json',
}

const found = new Map<TechniqueId, Fixture>()
const wanted = RULES.map((r) => r.id)

const serializeEliminated = (eliminated: number[]): string[] => {
  const out: string[] = []
  for (let i = 0; i < eliminated.length; i++) {
    for (const v of maskToNumbers(eliminated[i])) {
      out.push(`R${Math.floor(i / 9) + 1}C${(i % 9) + 1}:${v}`)
    }
  }
  return out
}

for (let attempt = 0; attempt < 400 && found.size < wanted.length; attempt++) {
  const puzzle = generateAnyPuzzle()
  if (!puzzle) continue

  const grid = parseGrid(puzzle.givens)
  let eliminated = emptyEliminated()

  for (let step = 0; step < 300; step++) {
    if (grid.every((v) => v !== 0)) break
    const hint = findHint(grid, eliminated)
    if (!hint) break

    if (!found.has(hint.technique)) {
      found.set(hint.technique, {
        technique: hint.technique,
        grid: gridToString(grid),
        eliminatedBefore: serializeEliminated(eliminated),
        expected: {
          targetCell: hint.targetCell,
          value: hint.value,
          eliminations: hint.eliminations,
          relatedCells: hint.relatedCells,
        },
      })
      console.log(`found ${hint.technique} (attempt ${attempt}, step ${step})`)
    }

    if (hint.targetCell && hint.value !== undefined) {
      grid[parseCellId(hint.targetCell)] = hint.value
    } else {
      eliminated = applyEliminations(eliminated, hint)
    }
  }
}

for (const id of wanted) {
  const fixture = found.get(id)
  if (!fixture) {
    console.warn(`!! ${id} の固定問題が見つかりませんでした`)
    continue
  }
  writeFileSync(join(OUT_DIR, FILE_NAME[id]), JSON.stringify(fixture, null, 2) + '\n', 'utf8')
  console.log(`wrote ${FILE_NAME[id]}`)
}
