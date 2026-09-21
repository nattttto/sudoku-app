/**
 * Hidden Triple（仕様書 9章 Lv.2）
 * 3つの数字が、ユニット内の同じ3セルにしか入らない場合。
 */
import { makeHiddenSubsetRule } from './subsets'
import type { HintRule } from './types'

export const hiddenTriple: HintRule = makeHiddenSubsetRule(3, 'HIDDEN_TRIPLE')
