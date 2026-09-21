/**
 * デイリー数独（仕様書 24章）。
 *
 * サーバーを持たないので、日付から決定的に問題を選ぶ。
 * 同じ日なら誰が開いても同じ問題になり、端末を変えても同じ問題が出る。
 */
import easyPool from '../../../data/puzzles/easy.json'
import normalPool from '../../../data/puzzles/normal.json'
import hardPool from '../../../data/puzzles/hard.json'
import expertPool from '../../../data/puzzles/expert.json'
import type { Difficulty, Puzzle } from '../board/types'
import { dateKey } from './stats'

const POOLS: Record<Difficulty, Puzzle[]> = {
  easy: easyPool as Puzzle[],
  normal: normalPool as Puzzle[],
  hard: hardPool as Puzzle[],
  expert: expertPool as Puzzle[],
}

/**
 * 曜日で難易度を決める。
 * 週の前半はやさしく、後半に向けて難しくする。
 */
const WEEKDAY_DIFFICULTY: Difficulty[] = [
  'expert', // 日
  'easy', // 月
  'easy', // 火
  'normal', // 水
  'normal', // 木
  'hard', // 金
  'hard', // 土
]

/** 文字列から安定した数値を作る（FNV-1a） */
const hash = (text: string): number => {
  let value = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    value ^= text.charCodeAt(i)
    value = Math.imul(value, 0x01000193)
  }
  return value >>> 0
}

/** YYYY-MM-DD から曜日（0=日）を求める */
const weekdayOf = (key: string): number => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

export const dailyDifficulty = (key: string): Difficulty =>
  WEEKDAY_DIFFICULTY[weekdayOf(key)]

/** その日の問題。同じ日付なら必ず同じ問題を返す */
export const dailyPuzzle = (key: string = dateKey()): Puzzle => {
  const difficulty = dailyDifficulty(key)
  const pool = POOLS[difficulty]
  return pool[hash(key) % pool.length]
}

/** 「9月21日（日）」のような表示 */
export const formatDateLabel = (key: string): string => {
  const [y, m, d] = key.split('-').map(Number)
  const weekday = '日月火水木金土'[new Date(y, m - 1, d).getDay()]
  return `${m}月${d}日（${weekday}）`
}

export { dateKey }
