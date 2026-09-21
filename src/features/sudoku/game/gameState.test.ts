/**
 * ゲーム状態のテスト（入力・メモ・Undo/Redo・リスタート・確定マス・ブロック完成）。
 */
import { describe, expect, it } from 'vitest'
import { parseCellId, parseGrid, unitIndices } from '../board/board'
import { bit, computeCandidates, maskToNumbers } from '../candidates/candidateEngine'
import { findHint } from '../hints/hintEngine'
import type { Puzzle } from '../board/types'
import {
  autoFillTargets,
  canAddNote,
  canAutoFill,
  correctCount,
  createGame,
  gameReducer,
  isDigitComplete,
  isSettled,
  isWrongAt,
} from './gameState'
import type { GameAction, GameState } from './gameState'
import easyPool from '../../../data/puzzles/easy.json'

const PUZZLE = (easyPool as Puzzle[])[0]
const SOLUTION = parseGrid(PUZZLE.solution)

const run = (state: GameState, ...actions: GameAction[]): GameState =>
  actions.reduce(gameReducer, state)

/** 空いているマスを1つ探す */
const firstEmpty = (state: GameState): number => state.grid.findIndex((v) => v === 0)

/**
 * 候補が2つ以上あるマス。
 * ここなら「ルール上は置けるが不正解」の数字と、メモに書ける数字が2つ以上取れる。
 */
const flexibleCell = (state: GameState) => {
  for (let index = 0; index < 81; index++) {
    if (state.grid[index] !== 0) continue
    const candidates = computeCandidates(state.grid, index)
    const wrong = candidates.find((n) => n !== SOLUTION[index])
    if (wrong !== undefined) {
      return { index, wrong, correct: SOLUTION[index], candidates }
    }
  }
  throw new Error('候補が2つ以上あるマスが見つかりません')
}

describe('数字の入力', () => {
  const base = createGame(PUZZLE)
  const { index, wrong } = flexibleCell(base)

  it('選択したマスに数字を入れられる', () => {
    const next = run(base, { type: 'select', index }, { type: 'input', value: wrong })
    expect(next.grid[index]).toBe(wrong)
  })

  it('間違えた数字は、同じ数字をもう一度入れると消える', () => {
    const next = run(
      base,
      { type: 'select', index },
      { type: 'input', value: wrong },
      { type: 'input', value: wrong },
    )
    expect(next.grid[index]).toBe(0)
  })

  it('問題の初期数字は変更できない', () => {
    const given = base.grid.findIndex((v) => v !== 0)
    const next = run(base, { type: 'select', index: given }, { type: 'input', value: 1 })
    expect(next.grid[given]).toBe(base.grid[given])
  })

  it('マスを選んでいなければ何も起きない', () => {
    const next = gameReducer(base, { type: 'input', value: 1 })
    expect(next).toBe(base)
  })
})

describe('正解を入れたマスの確定', () => {
  const base = createGame(PUZZLE)
  const { index, wrong, correct } = flexibleCell(base)
  const placed = run(base, { type: 'select', index }, { type: 'input', value: correct })

  it('正解を入れたマスは確定扱いになる', () => {
    expect(isSettled(placed, index)).toBe(true)
  })

  it('確定したマスには別の数字を入れられない', () => {
    const next = gameReducer(placed, { type: 'input', value: wrong })
    expect(next.grid[index]).toBe(correct)
  })

  it('確定したマスは同じ数字を押しても消えない', () => {
    const next = gameReducer(placed, { type: 'input', value: correct })
    expect(next.grid[index]).toBe(correct)
  })

  it('確定したマスは消しゴムでも消えない', () => {
    expect(gameReducer(placed, { type: 'erase' }).grid[index]).toBe(correct)

    const digitFirst = run(
      placed,
      { type: 'setInputStyle', style: 'digit' },
      { type: 'selectDigit', digit: 'erase' },
      { type: 'tapCell', index },
    )
    expect(digitFirst.grid[index]).toBe(correct)
  })

  it('間違えた数字のマスは確定しない（書き直せる）', () => {
    const mistaken = run(base, { type: 'select', index }, { type: 'input', value: wrong })
    expect(isSettled(mistaken, index)).toBe(false)
    const fixed = gameReducer(mistaken, { type: 'input', value: correct })
    expect(fixed.grid[index]).toBe(correct)
  })

  it('Undo なら正解の入力も取り消せる', () => {
    expect(gameReducer(placed, { type: 'undo' }).grid[index]).toBe(0)
  })
})

describe('候補メモ', () => {
  const base = createGame(PUZZLE)
  const { index, candidates } = flexibleCell(base)
  const [first, second] = candidates

  it('メモモードでは候補として記録される', () => {
    const next = run(
      base,
      { type: 'select', index },
      { type: 'setMode', mode: 'note' },
      { type: 'input', value: first },
      { type: 'input', value: second },
    )
    expect(next.grid[index]).toBe(0)
    expect(maskToNumbers(next.notes[index])).toEqual([first, second].sort((a, b) => a - b))
  })

  it('同じ数字をもう一度押すとメモが外れる', () => {
    const next = run(
      base,
      { type: 'select', index },
      { type: 'setMode', mode: 'note' },
      { type: 'input', value: first },
      { type: 'input', value: first },
    )
    expect(maskToNumbers(next.notes[index])).toEqual([])
  })

  it('同じ行・列・ブロックにある数字はメモできない', () => {
    const impossible = [1, 2, 3, 4, 5, 6, 7, 8, 9].find((n) => !candidates.includes(n))!
    expect(canAddNote(base, index, impossible)).toBe(false)

    const next = run(
      base,
      { type: 'select', index },
      { type: 'setMode', mode: 'note' },
      { type: 'input', value: impossible },
    )
    expect(next.notes[index]).toBe(0)
  })

  it('数字優先でも、ありえないメモは書けない', () => {
    const impossible = [1, 2, 3, 4, 5, 6, 7, 8, 9].find((n) => !candidates.includes(n))!
    const next = run(
      base,
      { type: 'setInputStyle', style: 'digit' },
      { type: 'setMode', mode: 'note' },
      { type: 'selectDigit', digit: impossible },
      { type: 'tapCell', index },
    )
    expect(next.notes[index]).toBe(0)
  })

  it('何らかの理由で残ったありえないメモは、外すことはできる', () => {
    const impossible = [1, 2, 3, 4, 5, 6, 7, 8, 9].find((n) => !candidates.includes(n))!
    // 古い保存データなどで、ありえないメモが残っている状況を作る
    const notes = base.notes.slice()
    notes[index] = bit(impossible)
    const stale: GameState = { ...base, notes, selected: index, mode: 'note' }

    const next = gameReducer(stale, { type: 'input', value: impossible })
    expect(next.notes[index]).toBe(0)
  })

  it('数字を確定すると、同じ行・列・ブロックのメモから自動で消える', () => {
    const { index: target, correct } = flexibleCell(base)
    // 同じ行・列・ブロックで、その数字をメモできる別のマス
    const peer = base.grid.findIndex(
      (v, i) =>
        v === 0 &&
        i !== target &&
        (Math.floor(i / 9) === Math.floor(target / 9) || i % 9 === target % 9) &&
        canAddNote(base, i, correct),
    )
    expect(peer).toBeGreaterThanOrEqual(0)

    const noted = run(
      base,
      { type: 'select', index: peer },
      { type: 'setMode', mode: 'note' },
      { type: 'input', value: correct },
    )
    expect(maskToNumbers(noted.notes[peer])).toContain(correct)

    const next = run(
      noted,
      { type: 'setMode', mode: 'value' },
      { type: 'select', index: target },
      { type: 'input', value: correct },
    )
    expect(maskToNumbers(next.notes[peer])).not.toContain(correct)
  })
})

describe('Undo / Redo', () => {
  const base = createGame(PUZZLE)
  const { index, wrong } = flexibleCell(base)
  const second = base.grid.findIndex((v, i) => v === 0 && i !== index)

  it('入力を取り消せる', () => {
    const after = run(base, { type: 'select', index }, { type: 'input', value: wrong })
    expect(gameReducer(after, { type: 'undo' }).grid[index]).toBe(0)
  })

  it('取り消した入力をやり直せる', () => {
    const after = run(base, { type: 'select', index }, { type: 'input', value: wrong })
    const redone = run(after, { type: 'undo' }, { type: 'redo' })
    expect(redone.grid[index]).toBe(wrong)
  })

  it('履歴がなければ何も起きない', () => {
    expect(gameReducer(base, { type: 'undo' })).toBe(base)
    expect(gameReducer(base, { type: 'redo' })).toBe(base)
  })

  it('新しい入力をすると redo 履歴は破棄される', () => {
    const after = run(
      base,
      { type: 'select', index },
      { type: 'input', value: wrong },
      { type: 'undo' },
      { type: 'input', value: SOLUTION[index] },
    )
    expect(after.future).toHaveLength(0)
    expect(after.grid[index]).toBe(SOLUTION[index])
  })

  it('複数回の入力を順に戻せる', () => {
    const after = run(
      base,
      { type: 'select', index },
      { type: 'input', value: wrong },
      { type: 'select', index: second },
      { type: 'input', value: SOLUTION[second] },
      { type: 'undo' },
      { type: 'undo' },
    )
    expect(after.grid[index]).toBe(0)
    expect(after.grid[second]).toBe(0)
  })
})

describe('消去とリスタート', () => {
  const base = createGame(PUZZLE)
  const { index, wrong } = flexibleCell(base)

  it('間違えて入れた数字を消せる', () => {
    const after = run(
      base,
      { type: 'select', index },
      { type: 'input', value: wrong },
      { type: 'erase' },
    )
    expect(after.grid[index]).toBe(0)
  })

  it('リスタートで初期状態に戻る', () => {
    const after = run(
      base,
      { type: 'select', index },
      { type: 'input', value: wrong },
      { type: 'tick', deltaMs: 5000 },
      { type: 'restart' },
    )
    expect(after.grid).toEqual(base.givens)
    expect(after.elapsedMs).toBe(0)
    expect(after.past).toHaveLength(0)
    expect(after.celebration).toBeNull()
  })
})

describe('クリア判定', () => {
  it('解答どおりに埋めると solved になる', () => {
    let state = createGame(PUZZLE)
    for (let i = 0; i < 81; i++) {
      if (state.grid[i] !== 0) continue
      state = run(state, { type: 'select', index: i }, { type: 'input', value: SOLUTION[i] })
    }
    expect(state.status).toBe('solved')
  })

  it('途中では playing のまま', () => {
    expect(createGame(PUZZLE).status).toBe('playing')
  })
})

describe('ブロック完成', () => {
  const base = createGame(PUZZLE)
  // 空きマスが2つ以上あるブロック（最後の1マスの前後を比べたいため）
  const block = [0, 1, 2, 3, 4, 5, 6, 7, 8].find(
    (b) => unitIndices({ type: 'box', index: b }).filter((i) => base.grid[i] === 0).length >= 2,
  )!
  const empties = unitIndices({ type: 'box', index: block }).filter((i) => base.grid[i] === 0)
  const last = empties.at(-1)!

  /** 最後の1マスを残して、そのブロックを正解で埋める */
  const almost = empties
    .slice(0, -1)
    .reduce(
      (state, i) =>
        run(state, { type: 'select', index: i }, { type: 'input', value: SOLUTION[i] }),
      base,
    )

  it('埋め切るまでは演出しない', () => {
    expect(almost.celebration).toBeNull()
  })

  it('正解で埋め切ると、そのブロックと最後のマスを記録する', () => {
    const done = run(almost, { type: 'select', index: last }, { type: 'input', value: SOLUTION[last] })
    expect(done.celebration?.origin).toBe(last)
    // ブロックが先頭。同時に行・列が揃えばそれも含む
    expect(done.celebration?.units[0]).toEqual({ type: 'box', index: block })
  })

  it('間違えた数字で埋めても演出しない', () => {
    const wrong = [1, 2, 3, 4, 5, 6, 7, 8, 9].find(
      (n) => n !== SOLUTION[last] && computeCandidates(almost.grid, last).includes(n),
    )
    if (wrong === undefined) return // 候補が正解しか無いマスなら、この確認は成立しない
    const done = run(almost, { type: 'select', index: last }, { type: 'input', value: wrong })
    expect(done.celebration).toBeNull()
  })

  it('ヒントで埋め切っても演出する', () => {
    const hint = {
      technique: 'NAKED_SINGLE' as const,
      techniqueName: 'Naked Single',
      targetCell: `R${Math.floor(last / 9) + 1}C${(last % 9) + 1}`,
      value: SOLUTION[last],
      relatedCells: [],
      explanation: '',
      eliminations: [],
      units: [],
      candidateMarks: [],
      steps: [
        { title: '', body: '' },
        { title: '', body: '' },
        { title: '', body: '' },
      ] as [
        { title: string; body: string },
        { title: string; body: string },
        { title: string; body: string },
      ],
    }
    const done = gameReducer(almost, { type: 'applyHint', hint })
    expect(done.celebration?.units[0]).toEqual({ type: 'box', index: block })
  })

  it('Undo すると演出は消える', () => {
    const done = run(almost, { type: 'select', index: last }, { type: 'input', value: SOLUTION[last] })
    expect(gameReducer(done, { type: 'undo' }).celebration).toBeNull()
  })

  it('タイマーが進んでも演出は消えない（途中で途切れないように）', () => {
    const done = run(almost, { type: 'select', index: last }, { type: 'input', value: SOLUTION[last] })
    expect(gameReducer(done, { type: 'tick', deltaMs: 1000 }).celebration).toBe(done.celebration)
  })

  it('最後の1手でクリアしたときは、ブロックではなくクリアの演出にする', () => {
    let state = createGame(PUZZLE)
    const all = state.grid.flatMap((v, i) => (v === 0 ? [i] : []))
    for (const i of all.slice(0, -1)) {
      state = run(state, { type: 'select', index: i }, { type: 'input', value: SOLUTION[i] })
    }
    const final = all.at(-1)!
    state = run(state, { type: 'select', index: final }, { type: 'input', value: SOLUTION[final] })
    expect(state.status).toBe('solved')
    expect(state.celebration?.origin).not.toBe(final)
  })
})

describe('数字優先の入力方式', () => {
  const base = createGame(PUZZLE)
  const { index, wrong, candidates } = flexibleCell(base)

  const digitFirst = (s: GameState) => gameReducer(s, { type: 'setInputStyle', style: 'digit' })

  it('数字を選んでからマスをタップすると入力される', () => {
    const after = run(
      digitFirst(base),
      { type: 'selectDigit', digit: wrong },
      { type: 'tapCell', index },
    )
    expect(after.grid[index]).toBe(wrong)
    // 数字は選ばれたままで、続けて他のマスにも置ける
    expect(after.activeDigit).toBe(wrong)
  })

  it('数字を選んでいなければタップしても入力されない', () => {
    const after = gameReducer(digitFirst(base), { type: 'tapCell', index })
    expect(after.grid[index]).toBe(0)
  })

  it('同じ数字をもう一度押すと選択が解除される', () => {
    const after = run(
      digitFirst(base),
      { type: 'selectDigit', digit: 5 },
      { type: 'selectDigit', digit: 5 },
    )
    expect(after.activeDigit).toBeNull()
  })

  it('消しゴムを選んでマスをタップすると消える', () => {
    const after = run(
      digitFirst(base),
      { type: 'selectDigit', digit: wrong },
      { type: 'tapCell', index },
      { type: 'selectDigit', digit: 'erase' },
      { type: 'tapCell', index },
    )
    expect(after.grid[index]).toBe(0)
  })

  it('メモモードと組み合わせるとメモが入る', () => {
    const after = run(
      digitFirst(base),
      { type: 'setMode', mode: 'note' },
      { type: 'selectDigit', digit: candidates[0] },
      { type: 'tapCell', index },
    )
    expect(after.grid[index]).toBe(0)
    expect(maskToNumbers(after.notes[index])).toEqual([candidates[0]])
  })

  it('問題の初期数字はタップしても変わらない', () => {
    const givenIndex = base.grid.findIndex((v) => v !== 0)
    const after = run(
      digitFirst(base),
      { type: 'selectDigit', digit: 5 },
      { type: 'tapCell', index: givenIndex },
    )
    expect(after.grid[givenIndex]).toBe(base.grid[givenIndex])
  })

  it('マス優先ではタップしても数字は入らない', () => {
    const after = run(base, { type: 'selectDigit', digit: 5 }, { type: 'tapCell', index })
    expect(after.grid[index]).toBe(0)
    expect(after.selected).toBe(index)
  })

  it('方式を戻すと選択中の数字は解除される', () => {
    const after = run(
      digitFirst(base),
      { type: 'selectDigit', digit: 5 },
      { type: 'setInputStyle', style: 'cell' },
    )
    expect(after.activeDigit).toBeNull()
  })
})

describe('メモの一括操作', () => {
  const base = createGame(PUZZLE)

  it('すべての空きマスに計算した候補を書き込む', () => {
    const after = gameReducer(base, { type: 'fillAllNotes' })
    for (let i = 0; i < 81; i++) {
      if (base.grid[i] !== 0) continue
      const notes = maskToNumbers(after.notes[i])
      expect(notes.length).toBeGreaterThan(0)
      // 書き込まれた候補は、その盤面で実際に置ける数字であること
      for (const value of notes) {
        expect(computeCandidates(base.grid, i)).toContain(value)
      }
    }
  })

  it('数字が入っているマスにはメモを書かない', () => {
    const after = gameReducer(base, { type: 'fillAllNotes' })
    for (let i = 0; i < 81; i++) {
      if (base.grid[i] !== 0) expect(after.notes[i]).toBe(0)
    }
  })

  it('Undo で一括入力前に戻せる', () => {
    const after = run(base, { type: 'fillAllNotes' }, { type: 'undo' })
    expect(after.notes.every((n) => n === 0)).toBe(true)
  })

  it('メモを全消去できる', () => {
    const after = run(base, { type: 'fillAllNotes' }, { type: 'clearAllNotes' })
    expect(after.notes.every((n) => n === 0)).toBe(true)
  })

  it('メモが無いときの全消去は何も起きない', () => {
    expect(gameReducer(base, { type: 'clearAllNotes' })).toBe(base)
  })
})

describe('一時停止', () => {
  const base = createGame(PUZZLE)
  const index = firstEmpty(base)

  it('停止中はタイマーが進まない', () => {
    const after = run(base, { type: 'togglePause' }, { type: 'tick', deltaMs: 5000 })
    expect(after.elapsedMs).toBe(0)
  })

  it('停止中は入力を受け付けない', () => {
    const after = run(
      base,
      { type: 'togglePause' },
      { type: 'select', index },
      { type: 'input', value: 5 },
    )
    expect(after.grid[index]).toBe(0)
  })

  it('再開するとタイマーが進む', () => {
    const after = run(
      base,
      { type: 'togglePause' },
      { type: 'togglePause' },
      { type: 'tick', deltaMs: 5000 },
    )
    expect(after.elapsedMs).toBe(5000)
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

describe('答え合わせ', () => {
  const base = createGame(PUZZLE)
  const { index, wrong, correct } = flexibleCell(base)

  it('不正解の数字が入ったマスを判定できる', () => {
    const mistaken = run(base, { type: 'select', index }, { type: 'input', value: wrong })
    expect(isWrongAt(mistaken, index)).toBe(true)
    const fixed = gameReducer(mistaken, { type: 'input', value: correct })
    expect(isWrongAt(fixed, index)).toBe(false)
  })

  it('問題の初期数字や空きマスは不正解扱いしない', () => {
    const given = base.grid.findIndex((v) => v !== 0)
    expect(isWrongAt(base, given)).toBe(false)
    expect(isWrongAt(base, index)).toBe(false)
  })

  it('正しく置けた個数には不正解を数えない', () => {
    const before = correctCount(base, wrong)
    const mistaken = run(base, { type: 'select', index }, { type: 'input', value: wrong })
    expect(correctCount(mistaken, wrong)).toBe(before)
  })
})

describe('数字優先：盤面の数字をタップして選ぶ', () => {
  const base = gameReducer(createGame(PUZZLE), { type: 'setInputStyle', style: 'digit' })
  const given = base.grid.findIndex((v, i) => v !== 0 && !isDigitComplete(base, base.grid[i]))
  const { index, wrong, correct } = flexibleCell(base)

  it('数字を選んでいないとき、数字のマスをタップするとその数字が選ばれる', () => {
    const after = gameReducer(base, { type: 'tapCell', index: given })
    expect(after.activeDigit).toBe(base.grid[given])
  })

  it('別の数字を選んでいても、確定したマスをタップすればその数字に切り替わる', () => {
    const other = base.grid[given] === 1 ? 2 : 1
    const after = run(base, { type: 'selectDigit', digit: other }, { type: 'tapCell', index: given })
    expect(after.activeDigit).toBe(base.grid[given])
    expect(after.grid[given]).toBe(base.grid[given])
  })

  it('間違えたマスは、数字を選んでいれば書き直しになる', () => {
    const after = run(
      base,
      { type: 'selectDigit', digit: wrong },
      { type: 'tapCell', index },
      { type: 'selectDigit', digit: correct },
      { type: 'tapCell', index },
    )
    expect(after.grid[index]).toBe(correct)
  })

  it('消しゴムを選んでいるときは、数字のマスをタップしても数字は選ばない', () => {
    const after = run(base, { type: 'selectDigit', digit: 'erase' }, { type: 'tapCell', index: given })
    expect(after.activeDigit).toBe('erase')
  })
})

describe('置き終えた数字', () => {
  const base = gameReducer(createGame(PUZZLE), { type: 'setInputStyle', style: 'digit' })
  // 残りが一番少ない数字を選ぶ（置き終えるまでの手数を減らすため）
  const digit = [1, 2, 3, 4, 5, 6, 7, 8, 9]
    .filter((n) => !isDigitComplete(base, n))
    .sort((a, b) => correctCount(base, b) - correctCount(base, a))[0]
  const spots = base.grid.flatMap((v, i) => (v === 0 && SOLUTION[i] === digit ? [i] : []))

  /** 数字優先で、その数字を選んだまま、最後の1つを残して置く */
  const almost = spots
    .slice(0, -1)
    .reduce(
      (state, i) => gameReducer(state, { type: 'tapCell', index: i }),
      gameReducer(base, { type: 'selectDigit', digit }),
    )

  it('9個とも正しく置き終えると、数字の選択が自動で外れる', () => {
    expect(almost.activeDigit).toBe(digit)
    const done = gameReducer(almost, { type: 'tapCell', index: spots.at(-1)! })
    expect(isDigitComplete(done, digit)).toBe(true)
    expect(done.activeDigit).toBeNull()
  })

  it('置き終えた数字は選べない', () => {
    const done = gameReducer(almost, { type: 'tapCell', index: spots.at(-1)! })
    expect(gameReducer(done, { type: 'selectDigit', digit }).activeDigit).toBeNull()
  })

  it('置き終えた数字のマスをタップしても選ばれない', () => {
    const done = gameReducer(almost, { type: 'tapCell', index: spots.at(-1)! })
    expect(gameReducer(done, { type: 'tapCell', index: spots[0] }).activeDigit).toBeNull()
  })
})

describe('受け付けない操作', () => {
  const base = createGame(PUZZLE)
  const { index, candidates } = flexibleCell(base)
  const impossible = [1, 2, 3, 4, 5, 6, 7, 8, 9].find((n) => !candidates.includes(n))!

  const tapImpossible = (state: GameState) =>
    run(
      state,
      { type: 'setInputStyle', style: 'digit' },
      { type: 'setMode', mode: 'note' },
      { type: 'selectDigit', digit: impossible },
      { type: 'tapCell', index },
    )

  it('ありえないメモをタップすると、そのマスを記録する', () => {
    const after = tapImpossible(base)
    expect(after.rejection?.index).toBe(index)
    expect(after.notes[index]).toBe(0)
  })

  it('続けて起きても、毎回別の番号になる（演出をやり直すため）', () => {
    const first = tapImpossible(base)
    const second = gameReducer(first, { type: 'tapCell', index })
    expect(second.rejection?.id).not.toBe(first.rejection?.id)
  })

  it('書けるメモでは記録しない', () => {
    const after = run(
      base,
      { type: 'setInputStyle', style: 'digit' },
      { type: 'setMode', mode: 'note' },
      { type: 'selectDigit', digit: candidates[0] },
      { type: 'tapCell', index },
    )
    expect(after.rejection).toBeNull()
  })
})

describe('行・列の完成', () => {
  const base = createGame(PUZZLE)

  /** 指定したマス以外の、そのユニットの空きマスを正解で埋める */
  const fillExcept = (state: GameState, indices: number[], except: number) =>
    indices
      .filter((i) => i !== except && state.grid[i] === 0)
      .reduce(
        (s, i) => run(s, { type: 'select', index: i }, { type: 'input', value: SOLUTION[i] }),
        state,
      )

  it('行を正解で埋め切ると、その行を記録する', () => {
    const row = [0, 1, 2, 3, 4, 5, 6, 7, 8].find((r) =>
      unitIndices({ type: 'row', index: r }).some((i) => base.grid[i] === 0),
    )!
    const cells = unitIndices({ type: 'row', index: row })
    const last = cells.filter((i) => base.grid[i] === 0).at(-1)!
    const almost = fillExcept(base, cells, last)
    const done = run(almost, { type: 'select', index: last }, { type: 'input', value: SOLUTION[last] })
    expect(done.celebration?.units).toContainEqual({ type: 'row', index: row })
  })

  it('列を正解で埋め切ると、その列を記録する', () => {
    const col = [0, 1, 2, 3, 4, 5, 6, 7, 8].find((c) =>
      unitIndices({ type: 'col', index: c }).some((i) => base.grid[i] === 0),
    )!
    const cells = unitIndices({ type: 'col', index: col })
    const last = cells.filter((i) => base.grid[i] === 0).at(-1)!
    const almost = fillExcept(base, cells, last)
    const done = run(almost, { type: 'select', index: last }, { type: 'input', value: SOLUTION[last] })
    expect(done.celebration?.units).toContainEqual({ type: 'col', index: col })
  })

  it('1手でブロックと行が同時に揃えば、両方を記録する（ブロックが先頭）', () => {
    const target = firstEmpty(base)
    const box = { type: 'box' as const, index: Math.floor(Math.floor(target / 9) / 3) * 3 + Math.floor((target % 9) / 3) }
    const row = { type: 'row' as const, index: Math.floor(target / 9) }
    let state = fillExcept(base, unitIndices(box), target)
    state = fillExcept(state, unitIndices(row), target)
    const done = run(state, { type: 'select', index: target }, { type: 'input', value: SOLUTION[target] })
    expect(done.celebration?.units[0]).toEqual(box)
    expect(done.celebration?.units).toContainEqual(row)
  })
})

describe('数字のコンプリート', () => {
  const base = createGame(PUZZLE)
  // 空きが2つ以上ある数字（最後の1つの前後を比べたいため）
  const digit = [1, 2, 3, 4, 5, 6, 7, 8, 9].find(
    (n) => SOLUTION.filter((v, i) => v === n && base.grid[i] === 0).length >= 2,
  )!
  const cells = SOLUTION.flatMap((v, i) => (v === digit && base.grid[i] === 0 ? [i] : []))
  const last = cells.at(-1)!
  const almost = cells
    .slice(0, -1)
    .reduce(
      (state, i) => run(state, { type: 'select', index: i }, { type: 'input', value: digit }),
      base,
    )

  it('9個そろうまでは数字の演出をしない', () => {
    expect(almost.celebration?.digit ?? null).toBeNull()
  })

  it('9個目を正しく置くと、その数字を記録する', () => {
    const done = run(almost, { type: 'select', index: last }, { type: 'input', value: digit })
    expect(done.celebration?.digit).toBe(digit)
    expect(done.celebration?.origin).toBe(last)
  })

  it('Undo すると演出は消える', () => {
    const done = run(almost, { type: 'select', index: last }, { type: 'input', value: digit })
    expect(gameReducer(done, { type: 'undo' }).celebration).toBeNull()
  })
})

describe('終盤の自動入力', () => {
  const base = createGame(PUZZLE)
  const empties = base.grid.flatMap((v, i) => (v === 0 ? [i] : []))

  /** 空きマスが n 個になるまで正解で埋める */
  const leave = (n: number) =>
    empties
      .slice(0, empties.length - n)
      .reduce((state, i) => gameReducer(state, { type: 'autoFill', index: i }), base)

  it('設定がオフ（0）なら使えない', () => {
    expect(canAutoFill(leave(3), 0)).toBe(false)
  })

  it('空きマスがしきい値より多いうちは使えない', () => {
    expect(canAutoFill(leave(11), 10)).toBe(false)
    expect(canAutoFill(leave(10), 10)).toBe(true)
  })

  it('不正解が残っていると使えない', () => {
    const state = leave(10)
    const index = state.grid.findIndex((v) => v === 0)
    const wrong = [1, 2, 3, 4, 5, 6, 7, 8, 9].find((n) => n !== SOLUTION[index])!
    const withWrong = run(state, { type: 'select', index }, { type: 'input', value: wrong })
    expect(canAutoFill(withWrong, 10)).toBe(false)
  })

  it('選択に関係なく、指定のマスに正解を置く', () => {
    const index = empties[0]
    const next = gameReducer(base, { type: 'autoFill', index })
    expect(next.grid[index]).toBe(SOLUTION[index])
    expect(next.selected).toBeNull()
    expect(next.mistakes).toBe(0)
  })

  it('埋まっているマスには何もしない', () => {
    const filled = base.grid.findIndex((v) => v !== 0)
    expect(gameReducer(base, { type: 'autoFill', index: filled })).toBe(base)
  })

  it('空きマスを順に埋めるとクリアになる', () => {
    let state = leave(5)
    for (const index of autoFillTargets(state)) {
      state = gameReducer(state, { type: 'autoFill', index })
    }
    expect(state.status).toBe('solved')
  })
})
