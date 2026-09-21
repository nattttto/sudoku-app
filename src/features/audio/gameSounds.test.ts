import { describe, expect, it } from 'vitest'
import { parseGrid, unitIndices } from '../sudoku/board/board'
import { computeCandidates } from '../sudoku/candidates/candidateEngine'
import { createGame, gameReducer } from '../sudoku/game/gameState'
import type { GameAction, GameState } from '../sudoku/game/gameState'
import type { Puzzle } from '../sudoku/board/types'
import { soundForTransition } from './gameSounds'
import easyPool from '../../data/puzzles/easy.json'

const PUZZLE = (easyPool as Puzzle[])[0]

/** 一連の操作を流して、最後の操作で鳴る音を取り出す */
const soundOf = (state: GameState, action: GameAction) =>
  soundForTransition(action, state, gameReducer(state, action))

const run = (state: GameState, ...actions: GameAction[]): GameState =>
  actions.reduce(gameReducer, state)

const firstEmpty = (state: GameState): number => state.grid.findIndex((v) => v === 0)

describe('効果音の選び方', () => {
  const base = createGame(PUZZLE)
  const index = firstEmpty(base)
  const solution = parseGrid(PUZZLE.solution)

  it('マスを選ぶだけなら控えめな音', () => {
    expect(soundOf(base, { type: 'tapCell', index })).toBe('select')
  })

  /** 候補が2つ以上あり、ルール上は置けるが不正解の数字を作れるマス */
  const flexible = (() => {
    for (let i = 0; i < 81; i++) {
      if (base.grid[i] !== 0) continue
      const candidates = computeCandidates(base.grid, i)
      const wrong = candidates.find((n) => n !== solution[i])
      if (wrong !== undefined) return { index: i, wrong, candidates }
    }
    throw new Error('候補が2つ以上あるマスが見つかりません')
  })()

  it('数字を置いたら置いた音', () => {
    const selected = run(base, { type: 'select', index: flexible.index })
    expect(soundOf(selected, { type: 'input', value: flexible.wrong })).toBe('place')
  })

  it('数字を消したら消した音', () => {
    // 正解は確定して消せないので、間違えた数字を消す
    const placed = run(
      base,
      { type: 'select', index: flexible.index },
      { type: 'input', value: flexible.wrong },
    )
    expect(soundOf(placed, { type: 'erase' })).toBe('erase')
  })

  it('メモを書いたらメモの音', () => {
    const noteMode = run(
      base,
      { type: 'select', index: flexible.index },
      { type: 'setMode', mode: 'note' },
    )
    expect(soundOf(noteMode, { type: 'input', value: flexible.candidates[0] })).toBe('note')
  })

  it('書けないメモは何も起きないので鳴らさない', () => {
    const impossible = [1, 2, 3, 4, 5, 6, 7, 8, 9].find(
      (n) => !flexible.candidates.includes(n),
    )!
    const noteMode = run(
      base,
      { type: 'select', index: flexible.index },
      { type: 'setMode', mode: 'note' },
    )
    expect(soundOf(noteMode, { type: 'input', value: impossible })).toBeNull()
  })

  it('ブロックを埋め切ったらブロック完成の音楽', () => {
    const block = [0, 1, 2, 3, 4, 5, 6, 7, 8].find(
      (b) => unitIndices({ type: 'box', index: b }).some((i) => base.grid[i] === 0),
    )!
    const empties = unitIndices({ type: 'box', index: block }).filter((i) => base.grid[i] === 0)
    const last = empties.at(-1)!
    const almost = run(
      base,
      ...empties
        .slice(0, -1)
        .flatMap((i): GameAction[] => [
          { type: 'select', index: i },
          { type: 'input', value: solution[i] },
        ]),
      { type: 'select', index: last },
    )
    expect(soundOf(almost, { type: 'input', value: solution[last] })).toBe('block')
  })

  it('重複を作ったら間違いの音', () => {
    // すでに盤面にある数字を、同じ行の空きマスに置く
    const row = Math.floor(index / 9)
    const existing = base.grid.find((v, i) => v !== 0 && Math.floor(i / 9) === row)
    expect(existing).toBeDefined()
    const selected = run(base, { type: 'select', index })
    expect(soundOf(selected, { type: 'input', value: existing! })).toBe('error')
  })

  it('解答と違うだけで重複していなければ、間違いの音は鳴らさない', () => {
    // 候補が2つ以上あるマスを探す。そこなら「重複しないが不正解」を作れる
    let target = -1
    let wrong = 0
    for (let i = 0; i < 81; i++) {
      if (base.grid[i] !== 0) continue
      const candidate = computeCandidates(base.grid, i).find((n) => n !== solution[i])
      if (candidate !== undefined) {
        target = i
        wrong = candidate
        break
      }
    }
    expect(target).toBeGreaterThanOrEqual(0)

    const selected = run(base, { type: 'select', index: target })
    const next = gameReducer(selected, { type: 'input', value: wrong })
    // ミスとしては数えるが、音では教えない
    expect(next.mistakes).toBe(1)
    expect(soundForTransition({ type: 'input', value: wrong }, selected, next)).toBe('place')
  })

  it('何も変わらなければ鳴らさない', () => {
    // マスを選ばずに数字を押しても何も起きない
    expect(soundOf(base, { type: 'input', value: 1 })).toBeNull()
  })

  it('ヒントを開いたらヒントの音', () => {
    expect(soundOf(base, { type: 'countHint', technique: 'NAKED_SINGLE' })).toBe('hint')
  })

  it('メモの一括操作はメモの音', () => {
    expect(soundOf(base, { type: 'fillAllNotes' })).toBe('note')
    const filled = run(base, { type: 'fillAllNotes' })
    expect(soundOf(filled, { type: 'clearAllNotes' })).toBe('note')
  })

  it('クリアしたらクリアの音が最優先', () => {
    let state = createGame(PUZZLE)
    const empties = state.grid.flatMap((v, i) => (v === 0 ? [i] : []))
    const last = empties.at(-1)!
    // 最後の1マスを残して埋める
    for (const i of empties.slice(0, -1)) {
      state = run(state, { type: 'select', index: i }, { type: 'input', value: solution[i] })
    }
    const ready = run(state, { type: 'select', index: last })
    expect(soundOf(ready, { type: 'input', value: solution[last] })).toBe('complete')
  })

  it('リスタートは消した音', () => {
    const played = run(base, { type: 'select', index }, { type: 'input', value: solution[index] })
    expect(soundOf(played, { type: 'restart' })).toBe('erase')
  })
})
