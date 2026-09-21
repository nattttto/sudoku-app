/**
 * Hidden Pair（仕様書 9章 Lv.2）
 * 2つの数字が、ユニット内の同じ2セルにしか入らない場合。
 */
import { makeHiddenSubsetRule } from './subsets'
import type { HintRule } from './types'

export const hiddenPair: HintRule = makeHiddenSubsetRule(2, 'HIDDEN_PAIR')
