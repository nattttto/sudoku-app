/**
 * 盤面の基本データ型。仕様書 5章。
 */

/** セル1つ分の状態 */
export type Cell = {
  /** 現在入っている数字。未入力は null */
  value: number | null
  /** ユーザーが入力した候補メモ */
  candidates: number[]
  /** 問題生成時から配置されている数字か */
  isGiven: boolean
  /** ルール違反（行・列・ブロックの重複）か */
  isError: boolean
}

/** 81セルの盤面。index = row * 9 + col */
export type Board = Cell[]

/** 数字のみの盤面表現。0 = 空。エンジン内部で使う */
export type Grid = number[]

/** 難易度 */
export type Difficulty = 'easy' | 'normal' | 'hard' | 'expert'

export const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard', 'expert']

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'かんたん',
  normal: 'ふつう',
  hard: 'むずかしい',
  expert: 'エキスパート',
}

/** 行・列・ブロックのいずれか（ユニット） */
export type UnitType = 'row' | 'col' | 'box'

/** ヒント可視化で強調するユニット */
export type Unit = {
  type: UnitType
  /** 0-8 */
  index: number
}

/** 1問分の問題データ */
export type Puzzle = {
  /** 81文字。1-9 と '.'（空マス） */
  givens: string
  /** 81文字の解答 */
  solution: string
  difficulty: Difficulty
  /** 難易度判定の根拠（使用したテクニック） */
  techniques?: string[]
}
