/**
 * 問題の供給元。
 *
 * 事前生成プール（src/data/puzzles）から即座に1問取り出しつつ、
 * 裏では Web Worker で新しい問題を生成して在庫を補充する。
 * これにより「開始まで待たされない」「同じ問題ばかり出ない」を両立する。
 */
import easyPool from '../../../data/puzzles/easy.json'
import normalPool from '../../../data/puzzles/normal.json'
import hardPool from '../../../data/puzzles/hard.json'
import expertPool from '../../../data/puzzles/expert.json'
import type { Difficulty, Puzzle } from '../board/types'
import type { GeneratorRequest, GeneratorResponse } from './generator.worker'

const POOLS: Record<Difficulty, Puzzle[]> = {
  easy: easyPool as Puzzle[],
  normal: normalPool as Puzzle[],
  hard: hardPool as Puzzle[],
  expert: expertPool as Puzzle[],
}

/** Worker が生成した問題の在庫 */
const stock: Record<Difficulty, Puzzle[]> = {
  easy: [],
  normal: [],
  hard: [],
  expert: [],
}

/** 直近に出した問題。連続で同じものを出さないための記録 */
const recent = new Set<string>()

const STOCK_TARGET = 2

let worker: Worker | null = null
let requestId = 0
const pending = new Map<number, (puzzle: Puzzle | null) => void>()

const getWorker = (): Worker | null => {
  if (typeof window === 'undefined' || typeof Worker === 'undefined') return null
  if (worker) return worker
  try {
    worker = new Worker(new URL('./generator.worker.ts', import.meta.url))
    worker.addEventListener('message', (event: MessageEvent<GeneratorResponse>) => {
      const resolve = pending.get(event.data.id)
      if (resolve) {
        pending.delete(event.data.id)
        resolve(event.data.puzzle)
      }
    })
  } catch {
    worker = null
  }
  return worker
}

/** Worker に1問頼む */
const requestFromWorker = (difficulty: Difficulty): Promise<Puzzle | null> => {
  const w = getWorker()
  if (!w) return Promise.resolve(null)
  const id = ++requestId
  return new Promise((resolve) => {
    pending.set(id, resolve)
    const message: GeneratorRequest = { id, difficulty }
    w.postMessage(message)
  })
}

/** 在庫が目標数に満たなければ裏で補充する */
export const prefetch = (difficulty: Difficulty): void => {
  if (stock[difficulty].length >= STOCK_TARGET) return
  void requestFromWorker(difficulty).then((puzzle) => {
    if (puzzle) stock[difficulty].push(puzzle)
  })
}

const pickFromPool = (difficulty: Difficulty): Puzzle => {
  const pool = POOLS[difficulty]
  const fresh = pool.filter((p) => !recent.has(p.givens))
  const candidates = fresh.length > 0 ? fresh : pool
  return candidates[Math.floor(Math.random() * candidates.length)]
}

/**
 * 次の問題を返す。
 * Worker の在庫があればそれを、なければ事前生成プールから取り出す。
 */
export const nextPuzzle = (difficulty: Difficulty): Puzzle => {
  const puzzle = stock[difficulty].shift() ?? pickFromPool(difficulty)
  recent.add(puzzle.givens)
  if (recent.size > 40) {
    const first = recent.values().next().value
    if (first !== undefined) recent.delete(first)
  }
  prefetch(difficulty)
  return puzzle
}

/** プールの問題数（デバッグ・表示用） */
export const poolSize = (difficulty: Difficulty): number => POOLS[difficulty].length
