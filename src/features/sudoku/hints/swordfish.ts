/**
 * Swordfish（仕様書 9章 Lv.4）
 *
 * ある数字について、3つの行で候補が同じ3つの列に収まっている場合、
 * その3列の他の行からその数字を消せる。
 * 各行の候補は2個でも3個でもよく、3行の列の合計がちょうど3列であればよい。
 */
import { makeFishRule } from './fish'
import type { HintRule } from './types'

export const swordfish: HintRule = makeFishRule(3, 'SWORDFISH')
