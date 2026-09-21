/**
 * Jellyfish（仕様書 9章 Lv.4「その他の高度な数独テクニック」）
 *
 * Swordfish を4つに広げた形。
 * 4つの行で候補が同じ4つの列に収まっている場合、その4列の他の行から消せる。
 */
import { makeFishRule } from './fish'
import type { HintRule } from './types'

export const jellyfish: HintRule = makeFishRule(4, 'JELLYFISH')
