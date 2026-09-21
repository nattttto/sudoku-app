/**
 * Naked Triple（仕様書 9章 Lv.2）
 * 3セルが合計3種類の候補しか持たない場合。
 */
import { makeNakedSubsetRule } from './subsets'
import type { HintRule } from './types'

export const nakedTriple: HintRule = makeNakedSubsetRule(3, 'NAKED_TRIPLE')
