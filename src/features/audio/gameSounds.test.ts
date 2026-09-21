import { describe, expect, it } from 'vitest'
import { parseGrid, unitIndices, unitsOf } from '../sudoku/board/board'
import { computeCandidates } from '../sudoku/candidates/candidateEngine'
import { createGame, gameReducer } from '../sudoku/game/gameState'
import type { GameAction, GameState } from '../sudoku/game/gameState'
import type { Puzzle, Unit } from '../sudoku/board/types'
import { soundForTransition } from './gameSounds'
import easyPool from '../../data/puzzles/easy.json'

const PUZZLE = (easyPool as Puzzle[])[0]
const SOLUTION = parseGrid(PUZZLE.solution)

/** 一連の操作を流して、最後の操作で鳴る音を取り出す */
const soundOf = (state: GameState, action: GameAction) =>
  soundForTransition(action, state, gameReducer(state, action))

const run = (state: GameState, ...actions: GameAction[]): GameState =>
  actions.reduce(gameReducer, state)

const put = (state: GameState, index: number, value: number) =>
  run(state, { type: 'select', index }, { type: 'input', value })

/** そのマスを埋めても、行・列・ブロックのどれも完成しないか（演出の音に化けないように） */
const completesNothing = (state: GameState, index: number) =>
  unitsOf(index).every(
    (unit) => unitIndices(unit).filter((i) => state.grid[i] === 0).length >= 2,
  )

/** 指定したマス以外の、そのユニットの空きマスを正解で埋める */
const fillExcept = (state: GameState, unit: Unit, except: number) =>
  unitIndices(unit)
    .filter((i) => i !== except && state.grid[i] === 0)
    .reduce((s, i) => put(s, i, SOLUTION[i]), state)

describe('効果音の選び方', () => {
  const base = createGame(PUZZLE)

  /** 候補が2つ以上あり、ルール上は置けるが不正解の数字を作れるマス（何も完成させない） */
  const flexible = (() => {
    for (let i = 0; i < 81; i++) {
      if (base.grid[i] !== 0 || !completesNothing(base, i)) continue
      const candidates = computeCandidates(base.grid, i)
      const wrong = candidates.find((n) => n !== SOLUTION[i])
      if (wrong !== undefined) return { index: i, wrong, candidates }
    }
    throw new Error('条件に合うマスが見つかりません')
  })()

  it('マスを選ぶだけなら控えめな音', () => {
    expect(soundOf(base, { type: 'tapCell', index: flexible.index })).toBe('select')
  })

  it('正解を置いたら置いた音', () => {
    const selected = run(base, { type: 'select', index: flexible.index })
    expect(soundOf(selected, { type: 'input', value: SOLUTION[flexible.index] })).toBe('place')
  })

  it('不正解を置いたら、重複していなくても間違いの音（答え合わせあり）', () => {
    const selected = run(base, { type: 'select', index: flexible.index })
    expect(soundOf(selected, { type: 'input', value: flexible.wrong })).toBe('error')
  })

  it('重複を作ったら間違いの音', () => {
    const row = Math.floor(flexible.index / 9)
    const existing = base.grid.find((v, i) => v !== 0 && Math.floor(i / 9) === row)!
    const selected = run(base, { type: 'select', index: flexible.index })
    expect(soundOf(selected, { type: 'input', value: existing })).toBe('error')
  })

  it('正解なら、以前に置いた不正解と重なっても置いた音', () => {
    // B に正解 s を置く。その前に、同じ行の A に s を（不正解として）置いておく
    for (let b = 0; b < 81; b++) {
      if (base.grid[b] !== 0) continue
      const s = SOLUTION[b]
      const a = unitIndices({ type: 'row', index: Math.floor(b / 9) }).find(
        (i) => i !== b && base.grid[i] === 0 && computeCandidates(base.grid, i).includes(s),
      )
      if (a === undefined) continue
      const withWrong = put(base, a, s)
      if (!completesNothing(withWrong, b)) continue
      const selected = run(withWrong, { type: 'select', index: b })
      expect(soundOf(selected, { type: 'input', value: s })).toBe('place')
      return
    }
    throw new Error('条件に合うマスが見つかりません')
  })

  it('間違えた数字を消したら消した音', () => {
    const placed = put(base, flexible.index, flexible.wrong)
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

  it('書けないメモは受け付けない音', () => {
    const impossible = [1, 2, 3, 4, 5, 6, 7, 8, 9].find(
      (n) => !flexible.candidates.includes(n),
    )!
    const digitNote = run(
      base,
      { type: 'setInputStyle', style: 'digit' },
      { type: 'setMode', mode: 'note' },
      { type: 'selectDigit', digit: impossible },
    )
    expect(soundOf(digitNote, { type: 'tapCell', index: flexible.index })).toBe('deny')
  })

  it('数字優先で盤面の数字をタップして選んだら控えめな音', () => {
    const digitFirst = gameReducer(base, { type: 'setInputStyle', style: 'digit' })
    const given = base.grid.findIndex((v) => v !== 0)
    expect(soundOf(digitFirst, { type: 'tapCell', index: given })).toBe('select')
  })

  it('1つだけ完成したらブロック完成の音楽', () => {
    // ブロックだけが完成し、行・列は完成しないマスを探す
    for (let target = 0; target < 81; target++) {
      if (base.grid[target] !== 0) continue
      const [row, col, box] = unitsOf(target)
      const almost = fillExcept(base, box, target)
      const lineDone = [row, col].some((unit) =>
        unitIndices(unit).every((i) => i === target || almost.grid[i] !== 0),
      )
      if (lineDone) continue
      const selected = run(almost, { type: 'select', index: target })
      expect(soundOf(selected, { type: 'input', value: SOLUTION[target] })).toBe('block')
      return
    }
    throw new Error('条件に合うマスが見つかりません')
  })

  it('2つ以上同時に完成したら、さらに豪華な音楽', () => {
    const target = base.grid.findIndex((v) => v === 0)
    const [row, , box] = unitsOf(target)
    const almost = fillExcept(fillExcept(base, box, target), row, target)
    const selected = run(almost, { type: 'select', index: target })
    expect(soundOf(selected, { type: 'input', value: SOLUTION[target] })).toBe('combo')
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
    for (const i of empties.slice(0, -1)) state = put(state, i, SOLUTION[i])
    const ready = run(state, { type: 'select', index: last })
    expect(soundOf(ready, { type: 'input', value: SOLUTION[last] })).toBe('complete')
  })

  it('リスタートは消した音', () => {
    const played = put(base, flexible.index, flexible.wrong)
    expect(soundOf(played, { type: 'restart' })).toBe('erase')
  })
})
