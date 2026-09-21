/**
 * ゲーム状態のテスト（Phase 1: 入力・Undo/Redo・リスタート）。
 */
import { describe, expect, it } from 'vitest'
import { parseCellId, parseGrid } from '../board/board'
import { maskToNumbers } from '../candidates/candidateEngine'
import { findHint } from '../hints/hintEngine'
import type { Puzzle } from '../board/types'
import { createGame, gameReducer } from './gameState'
import type { GameAction, GameState } from './gameState'
import easyPool from '../../../data/puzzles/easy.json'

const PUZZLE = (easyPool as Puzzle[])[0]

const run = (state: GameState, ...actions: GameAction[]): GameState =>
  actions.reduce(gameReducer, state)

/** 空いているマスを1つ探す */
const firstEmpty = (state: GameState): number => state.grid.findIndex((v) => v === 0)

describe('数字の入力', () => {
  const base = createGame(PUZZLE)

  it('選択したマスに数字を入れられる', () => {
    const index = firstEmpty(base)
    const next = run(base, { type: 'select', index }, { type: 'input', value: 5 })
    expect(next.grid[index]).toBe(5)
  })

  it('同じ数字をもう一度入れると消える', () => {
    const index = firstEmpty(base)
    const next = run(
      base,
      { type: 'select', index },
      { type: 'input', value: 5 },
      { type: 'input', value: 5 },
    )
    expect(next.grid[index]).toBe(0)
  })

  it('問題の初期数字は変更できない', () => {
    const index = base.grid.findIndex((v) => v !== 0)
    const next = run(base, { type: 'select', index }, { type: 'input', value: 1 })
    expect(next.grid[index]).toBe(base.grid[index])
  })

  it('マスを選んでいなければ何も起きない', () => {
    const next = gameReducer(base, { type: 'input', value: 1 })
    expect(next).toBe(base)
  })
})

describe('候補メモ', () => {
  const base = createGame(PUZZLE)

  it('メモモードでは候補として記録される', () => {
    const index = firstEmpty(base)
    const next = run(
      base,
      { type: 'select', index },
      { type: 'setMode', mode: 'note' },
      { type: 'input', value: 3 },
      { type: 'input', value: 7 },
    )
    expect(next.grid[index]).toBe(0)
    expect(maskToNumbers(next.notes[index])).toEqual([3, 7])
  })

  it('同じ数字をもう一度押すとメモが外れる', () => {
    const index = firstEmpty(base)
    const next = run(
      base,
      { type: 'select', index },
      { type: 'setMode', mode: 'note' },
      { type: 'input', value: 3 },
      { type: 'input', value: 3 },
    )
    expect(maskToNumbers(next.notes[index])).toEqual([])
  })

  it('数字を確定すると、同じ行・列・ブロックのメモから自動で消える', () => {
    const index = firstEmpty(base)
    // 同じ行の別の空きマスにメモを書いてから、index に数字を入れる
    const peer = base.grid.findIndex(
      (v, i) => v === 0 && i !== index && Math.floor(i / 9) === Math.floor(index / 9),
    )
    const next = run(
      base,
      { type: 'select', index: peer },
      { type: 'setMode', mode: 'note' },
      { type: 'input', value: 4 },
      { type: 'setMode', mode: 'value' },
      { type: 'select', index },
      { type: 'input', value: 4 },
    )
    expect(maskToNumbers(next.notes[peer])).toEqual([])
  })
})

describe('Undo / Redo', () => {
  const base = createGame(PUZZLE)
  const index = firstEmpty(base)

  it('入力を取り消せる', () => {
    const after = run(base, { type: 'select', index }, { type: 'input', value: 5 })
    const undone = gameReducer(after, { type: 'undo' })
    expect(undone.grid[index]).toBe(0)
  })

  it('取り消した入力をやり直せる', () => {
    const after = run(base, { type: 'select', index }, { type: 'input', value: 5 })
    const redone = run(after, { type: 'undo' }, { type: 'redo' })
    expect(redone.grid[index]).toBe(5)
  })

  it('履歴がなければ何も起きない', () => {
    expect(gameReducer(base, { type: 'undo' })).toBe(base)
    expect(gameReducer(base, { type: 'redo' })).toBe(base)
  })

  it('新しい入力をすると redo 履歴は破棄される', () => {
    const after = run(
      base,
      { type: 'select', index },
      { type: 'input', value: 5 },
      { type: 'undo' },
      { type: 'input', value: 6 },
    )
    expect(after.future).toHaveLength(0)
    expect(after.grid[index]).toBe(6)
  })

  it('複数回の入力を順に戻せる', () => {
    const second = base.grid.findIndex((v, i) => v === 0 && i !== index)
    const after = run(
      base,
      { type: 'select', index },
      { type: 'input', value: 5 },
      { type: 'select', index: second },
      { type: 'input', value: 6 },
      { type: 'undo' },
      { type: 'undo' },
    )
    expect(after.grid[index]).toBe(0)
    expect(after.grid[second]).toBe(0)
  })
})

describe('消去とリスタート', () => {
  const base = createGame(PUZZLE)
  const index = firstEmpty(base)

  it('入力した数字を消せる', () => {
    const after = run(
      base,
      { type: 'select', index },
      { type: 'input', value: 5 },
      { type: 'erase' },
    )
    expect(after.grid[index]).toBe(0)
  })

  it('リスタートで初期状態に戻る', () => {
    const after = run(
      base,
      { type: 'select', index },
      { type: 'input', value: 5 },
      { type: 'tick', deltaMs: 5000 },
      { type: 'restart' },
    )
    expect(after.grid).toEqual(base.givens)
    expect(after.elapsedMs).toBe(0)
    expect(after.past).toHaveLength(0)
  })
})

describe('クリア判定', () => {
  it('解答どおりに埋めると solved になる', () => {
    const solution = parseGrid(PUZZLE.solution)
    let state = createGame(PUZZLE)
    for (let i = 0; i < 81; i++) {
      if (state.grid[i] !== 0) continue
      state = run(state, { type: 'select', index: i }, { type: 'input', value: solution[i] })
    }
    expect(state.status).toBe('solved')
  })

  it('途中では playing のまま', () => {
    expect(createGame(PUZZLE).status).toBe('playing')
  })
})

describe('ヒントの適用', () => {
  it('数字が確定するヒントを盤面に反映できる', () => {
    const base = createGame(PUZZLE)
    const hint = findHint(base.grid, base.eliminated)
    expect(hint).not.toBeNull()
    expect(hint!.targetCell).toBeDefined()

    const after = gameReducer(base, { type: 'applyHint', hint: hint! })
    const index = parseCellId(hint!.targetCell!)
    expect(after.grid[index]).toBe(hint!.value)
    expect(after.selected).toBe(index)
  })

  it('候補消去のヒントは eliminated に反映される', () => {
    // 消去型のヒントが出る盤面まで、ヒントを適用しながら進める
    let state = createGame(PUZZLE)
    for (let i = 0; i < 100; i++) {
      const hint = findHint(state.grid, state.eliminated)
      if (!hint) break
      if (!hint.targetCell) {
        const after = gameReducer(state, { type: 'applyHint', hint })
        const index = parseCellId(hint.eliminations[0].cell)
        expect(after.eliminated[index]).not.toBe(0)
        return
      }
      state = gameReducer(state, { type: 'applyHint', hint })
    }
    // easy の問題では消去型が出ないこともある。その場合はここまで到達してよい
    expect(state.status).toBe('solved')
  })
})
