/**
 * X-Wing（仕様書 9章 Lv.3 / 13.5）
 *
 * ある数字について、2つの行で候補が「まったく同じ2つの列」にしか無い場合、
 * その2列の他の行からその数字を消せる（行と列を入れ替えた形も同様）。
 *
 *   R2C2 ───────── R2C8
 *     │              │
 *   R7C2 ───────── R7C8
 *
 * Swordfish（3つ）・Jellyfish（4つ）と同じ構造なので、実装は fish.ts に共通化してある。
 */
import { makeFishRule } from './fish'
import type { HintRule } from './types'

export const xWing: HintRule = makeFishRule(2, 'X_WING')
