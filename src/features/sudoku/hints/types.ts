/**
 * ヒントの型定義。仕様書 11章。
 * ヒントは「答え」ではなく「推論情報」を返す。
 */
import type { Grid, Unit } from '../board/types'

export type TechniqueId =
  | 'NAKED_SINGLE'
  | 'HIDDEN_SINGLE'
  | 'LOCKED_CANDIDATES'
  | 'NAKED_PAIR'
  | 'HIDDEN_PAIR'
  | 'NAKED_TRIPLE'
  | 'HIDDEN_TRIPLE'
  | 'X_WING'
  | 'XY_WING'
  | 'XYZ_WING'
  | 'SWORDFISH'
  | 'JELLYFISH'

/** テクニックのメタ情報。難易度判定（仕様書14章）にも使う */
export type TechniqueMeta = {
  id: TechniqueId
  /** 表示名（英語の定石名） */
  name: string
  /** 日本語の短い説明 */
  summary: string
  /** 仕様書9章の実装優先度レベル。1 = MVP */
  level: 1 | 2 | 3 | 4
  /** 難易度スコア。大きいほど難しい */
  weight: number
}

/** 検索順＝やさしい順（仕様書 10章） */
export const TECHNIQUES: TechniqueMeta[] = [
  {
    id: 'NAKED_SINGLE',
    name: 'Naked Single',
    summary: 'そのセルに入る候補が1つしか残っていない',
    level: 1,
    weight: 1,
  },
  {
    id: 'HIDDEN_SINGLE',
    name: 'Hidden Single',
    summary: 'その数字を置けるセルがユニット内に1つしかない',
    level: 1,
    weight: 2,
  },
  {
    id: 'LOCKED_CANDIDATES',
    name: 'Locked Candidates',
    summary: 'ブロックと行・列の重なりから候補を絞り込む',
    level: 1,
    weight: 4,
  },
  {
    id: 'NAKED_PAIR',
    name: 'Naked Pair',
    summary: '2セルが同じ2候補だけを持つ',
    level: 1,
    weight: 5,
  },
  {
    id: 'HIDDEN_PAIR',
    name: 'Hidden Pair',
    summary: '2つの数字がユニット内の2セルにしか入らない',
    level: 2,
    weight: 7,
  },
  {
    id: 'NAKED_TRIPLE',
    name: 'Naked Triple',
    summary: '3セルが同じ3候補だけを共有する',
    level: 2,
    weight: 8,
  },
  {
    id: 'HIDDEN_TRIPLE',
    name: 'Hidden Triple',
    summary: '3つの数字がユニット内の3セルにしか入らない',
    level: 2,
    weight: 9,
  },
  {
    id: 'X_WING',
    name: 'X-Wing',
    summary: '2行2列の長方形の関係で候補を消す',
    level: 3,
    weight: 12,
  },
  {
    id: 'XY_WING',
    name: 'XY-Wing',
    summary: '3つの2候補セルの連鎖で候補を消す',
    level: 3,
    weight: 14,
  },
  {
    id: 'XYZ_WING',
    name: 'XYZ-Wing',
    summary: '3候補のセルを軸にした連鎖で候補を消す',
    level: 4,
    weight: 16,
  },
  {
    id: 'SWORDFISH',
    name: 'Swordfish',
    summary: '3行3列の対応で候補を消す',
    level: 4,
    weight: 18,
  },
  {
    id: 'JELLYFISH',
    name: 'Jellyfish',
    summary: '4行4列の対応で候補を消す',
    level: 4,
    weight: 20,
  },
]

export const TECHNIQUE_MAP: Record<TechniqueId, TechniqueMeta> = Object.fromEntries(
  TECHNIQUES.map((t) => [t.id, t]),
) as Record<TechniqueId, TechniqueMeta>

/** 消去される候補 */
export type Elimination = {
  /** "R4C7" */
  cell: string
  value: number
}

/** ヒント可視化用の候補マーク（仕様書 13章） */
export type CandidateMark = {
  cell: string
  value: number
  /** focus = 推論の根拠になる候補 / eliminate = 消える候補 */
  kind: 'focus' | 'eliminate'
}

/** 段階的ヒントの1ステップ（仕様書 12章） */
export type HintStep = {
  title: string
  body: string
}

export type Hint = {
  technique: TechniqueId
  /** 定石の表示名 */
  techniqueName: string
  /** 数字が確定する場合の対象セル "R4C7" */
  targetCell?: string
  /** 確定する数字 */
  value?: number
  /** 推論に関係するセル */
  relatedCells: string[]
  /** 理由の説明文 */
  explanation: string
  /** 消去される候補 */
  eliminations: Elimination[]
  /** 強調するユニット（行・列・ブロック） */
  units: Unit[]
  /** 候補の強調表示 */
  candidateMarks: CandidateMark[]
  /** STEP1 考え方 / STEP2 対象を提示 / STEP3 答えと理論 */
  steps: [HintStep, HintStep, HintStep]
}

/** ヒントルールが参照する盤面の状態 */
export type HintContext = {
  /** 現在の数字配置 */
  grid: Grid
  /**
   * 候補マスク。
   * 盤面から計算した候補から、すでに適用済みの消去を引いた状態。
   */
  masks: number[]
}

/** ヒントルール本体。見つからなければ null */
export type HintRule = (ctx: HintContext) => Hint | null
