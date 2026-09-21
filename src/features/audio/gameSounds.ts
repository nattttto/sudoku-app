/**
 * 盤面の変化から、鳴らすべき効果音を決める。
 *
 * 副作用を持たない純粋な関数にしてある（音の選び方をテストで固定するため）。
 *
 * このアプリは答え合わせありなので、置いた数字が不正解ならその場で間違いの音を鳴らす。
 * 判断は「置いた数字そのもの」の正誤で行う。重複の有無では判断しない
 * （以前に置いた不正解と重なっただけの正解に、間違いの音を鳴らさないため）。
 */
import type { GameAction, GameState } from '../sudoku/game/gameState'
import type { SoundName } from './sounds'

const solutionAt = (state: GameState, index: number): number =>
  state.puzzle.solution.charCodeAt(index) - 48

/** 数字が置かれたなら正誤で、消えたなら消した音で */
const soundForGridChange = (prev: GameState, next: GameState): SoundName => {
  const index = next.grid.findIndex((value, i) => value !== prev.grid[i])
  if (index < 0) return 'select'
  const value = next.grid[index]
  if (value === 0) return 'erase'
  return value === solutionAt(next, index) ? 'place' : 'error'
}

/**
 * 今回の変化で置かれた数字（効果音の高さを決めるのに使う）。
 * 数字のコンプリートなら、その数字を返す。置かれていなければ undefined
 */
export const placedDigit = (prev: GameState, next: GameState): number | undefined => {
  if (next.celebration && next.celebration !== prev.celebration && next.celebration.digit) {
    return next.celebration.digit
  }
  const index = next.grid.findIndex((value, i) => value !== prev.grid[i])
  return index >= 0 && next.grid[index] !== 0 ? next.grid[index] : undefined
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

  // ブロック・行・列を埋め切ったら、置いた音の代わりにごほうびの音楽。
  // 数字のコンプリートが一番まれなので最優先。2つ以上同時の完成はさらに豪華にする
  if (next.celebration && next.celebration !== prev.celebration) {
    if (next.celebration.digit !== null) return 'digit'
    return next.celebration.units.length >= 2 ? 'combo' : 'block'
  }

  // 受け付けられなかった操作
  if (next.rejection && next.rejection !== prev.rejection) return 'deny'

  switch (action.type) {
    case 'tapCell':
    case 'input':
    case 'erase':
    case 'undo':
    case 'redo':
      if (next.grid !== prev.grid) return soundForGridChange(prev, next)
      if (next.notes !== prev.notes) return 'note'
      if (next.selected !== prev.selected || next.activeDigit !== prev.activeDigit) {
        return 'select'
      }
      return null

    case 'autoFill':
      if (next.grid !== prev.grid) return soundForGridChange(prev, next)
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
