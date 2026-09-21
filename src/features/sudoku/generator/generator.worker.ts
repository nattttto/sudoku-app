/**
 * 問題生成用の Web Worker。
 * 生成には数百ミリ秒かかることがあるため、UIスレッドを止めないように別スレッドで動かす。
 */
import { generatePuzzle } from './generator'
import type { Difficulty, Puzzle } from '../board/types'

export type GeneratorRequest = { id: number; difficulty: Difficulty }
export type GeneratorResponse = { id: number; puzzle: Puzzle | null }

self.addEventListener('message', (event: MessageEvent<GeneratorRequest>) => {
  const { id, difficulty } = event.data
  let puzzle: Puzzle | null = null
  try {
    puzzle = generatePuzzle(difficulty)
  } catch {
    puzzle = null
  }
  const response: GeneratorResponse = { id, puzzle }
  self.postMessage(response)
})
