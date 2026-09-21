/**
 * ④ Naked Pair（仕様書 8.1）
 * 同じ行・列・ブロック内の2セルが、同じ2候補だけを持つ場合。
 */
import { makeNakedSubsetRule } from './subsets'
import type { HintRule } from './types'

export const nakedPair: HintRule = makeNakedSubsetRule(2, 'NAKED_PAIR')
