/**
 * 盤面の変化から、鳴らすべき効果音を決める。
 *
 * 副作用を持たない純粋な関数にしてある（音の選び方をテストで固定するため）。
 *
 * ひとつだけ意図的な判断がある。
 * **間違いの音は「重複したとき」だけ鳴らし、「解答と違う数字」では鳴らさない。**
 * 重複は盤面を見れば分かる情報なので音にしても何も漏れないが、
 * 解答と違うことを即座に音で教えると、数独として成立しなくなるため。
 */
import { findConflicts } from '../sudoku/board/board'
import type { GameAction, GameState } from '../sudoku/game/gameState'
import type { SoundName } from './sounds'

const filledCount = (grid: readonly number[]): number =>
  grid.reduce((count, value) => (value !== 0 ? count + 1 : count), 0)

/** 数字が増えたか減ったかで、置いた音と消した音を分ける */
const soundForGridChange = (prev: GameState, next: GameState): SoundName => {
  if (findConflicts(next.grid).size > findConflicts(prev.grid).size) return 'error'
  return filledCount(next.grid) > filledCount(prev.grid) ? 'place' : 'erase'
}

export const soundForTransition = (
  action: GameAction,
  prev: GameState,
  next: GameState,
): SoundName | null => {
  // 何も起きていないなら鳴らさない
  if (prev === next) return null

  // クリアは他のどの音よりも優先する
  if (next.status === 'solved' && prev.status !== 'solved') return 'complete'

  switch (action.type) {
    case 'tapCell':
    case 'input':
    case 'erase':
    case 'undo':
    case 'redo':
      if (next.grid !== prev.grid) return soundForGridChange(prev, next)
      if (next.notes !== prev.notes) return 'note'
      if (next.selected !== prev.selected) return 'select'
      return null

    case 'applyHint':
      if (next.grid !== prev.grid) return soundForGridChange(prev, next)
      return 'note'

    case 'countHint':
      return 'hint'

    case 'fillAllNotes':
    case 'clearAllNotes':
      return 'note'

    case 'restart':
      return 'erase'

    // ボタンの手応え。控えめな音にしてある
    case 'select':
    case 'selectDigit':
    case 'setMode':
    case 'toggleMode':
    case 'setInputStyle':
    case 'toggleInputStyle':
    case 'toggleCandidates':
    case 'togglePause':
      return 'select'

    default:
      return null
  }
}
