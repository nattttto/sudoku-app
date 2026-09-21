/**
 * ゲーム状態の不変条件テスト（ランダム操作による総当たり）。
 *
 * 個別のテストは「想定した手順」しか確かめられない。ここでは
 * 実際の操作をランダムに大量に流し込み、どんな順番で押されても
 * 守られていなければならない約束（不変条件）が崩れないかを1手ごとに確かめる。
 *
 * 乱数は種（seed）から決まるので、失敗したら同じ種で必ず再現できる。
 */
import { describe, expect, it } from 'vitest'
import { CELL_COUNT, parseGrid, unitIndices } from '../board/board'
import type { Puzzle } from '../board/types'
import { bit, computeCandidates } from '../candidates/candidateEngine'
import { findHint } from '../hints/hintEngine'
import { placedDigit, soundForTransition } from '../../audio/gameSounds'
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
import normalPool from '../../../data/puzzles/normal.json'
import hardPool from '../../../data/puzzles/hard.json'
import expertPool from '../../../data/puzzles/expert.json'

/** 種から決まる乱数（mulberry32） */
const random = (seed: number) => {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Rand = () => number
const pick = <T,>(rand: Rand, items: readonly T[]): T => items[Math.floor(rand() * items.length)]
const digit = (rand: Rand) => 1 + Math.floor(rand() * 9)

/**
 * 次の操作を選ぶ。
 * 完全にでたらめだと盤面がほとんど進まないので、正解を置く操作を多めに混ぜて
 * 終盤（完成の演出・自動入力・クリア）まで届くようにしてある。
 */
const nextAction = (rand: Rand, state: GameState): GameAction => {
  const solution = parseGrid(state.puzzle.solution)
  const empties = state.grid.flatMap((v, i) => (v === 0 ? [i] : []))
  const anyCell = () => Math.floor(rand() * CELL_COUNT)
  const emptyCell = () => (empties.length > 0 ? pick(rand, empties) : anyCell())

  // 人がやるように、休憩は再開し、メモ入力は戻し、間違えたマスは選び直して直す
  if (state.paused && rand() < 0.4) return { type: 'togglePause' }
  if (state.mode === 'note' && rand() < 0.15) return { type: 'toggleMode' }
  const wrong = state.grid.flatMap((_, i) => (isWrongAt(state, i) ? [i] : []))
  if (wrong.length > 0 && rand() < 0.15) return { type: 'select', index: pick(rand, wrong) }

  const r = rand()
  if (r < 0.2) return { type: 'tapCell', index: rand() < 0.7 ? emptyCell() : anyCell() }
  if (r < 0.3) return { type: 'select', index: rand() < 0.95 ? emptyCell() : null }
  if (r < 0.45) {
    // 選択中のマスの正解を入れる（進めるため）か、でたらめな数字を入れる
    const index = state.selected
    const value = index !== null && rand() < 0.6 ? solution[index] : digit(rand)
    return { type: 'input', value }
  }
  if (r < 0.52) {
    const choice = rand()
    const selection =
      choice < 0.75 ? digit(rand) : choice < 0.9 ? ('erase' as const) : null
    return { type: 'selectDigit', digit: selection }
  }
  if (r < 0.56) return { type: 'erase' }
  if (r < 0.61) return { type: 'undo' }
  if (r < 0.64) return { type: 'redo' }
  if (r < 0.67) return { type: 'toggleMode' }
  if (r < 0.7) return { type: 'setInputStyle', style: rand() < 0.5 ? 'cell' : 'digit' }
  if (r < 0.72) return { type: 'toggleCandidates' }
  if (r < 0.74) return { type: 'fillAllNotes' }
  if (r < 0.75) return { type: 'clearAllNotes' }
  if (r < 0.78) return { type: 'togglePause' }
  if (r < 0.81) return { type: 'tick', deltaMs: 1000 }
  if (r < 0.9) return { type: 'autoFill', index: rand() < 0.8 ? emptyCell() : anyCell() }
  if (r < 0.93) {
    // 盤面に不正解があるとヒントの前提が崩れるので、画面と同じく出さない
    if (state.grid.some((_, i) => isWrongAt(state, i))) return { type: 'tick', deltaMs: 1000 }
    const hint = findHint(state.grid, state.eliminated)
    return hint ? { type: 'applyHint', hint } : { type: 'tick', deltaMs: 1000 }
  }
  if (r < 0.94) return { type: 'countHint', technique: 'NAKED_SINGLE' }
  if (r < 0.942) return { type: 'restart' }
  return { type: 'tapCell', index: emptyCell() }
}

/** その手のあとで守られているべき約束。破れていたら理由を返す */
const violations = (prev: GameState, action: GameAction, next: GameState): string[] => {
  const problems: string[] = []
  const fail = (message: string) => problems.push(message)
  const solution = parseGrid(next.puzzle.solution)

  // --- 盤面の形 ---
  if (next.grid.length !== CELL_COUNT || next.notes.length !== CELL_COUNT) fail('盤面の長さ')
  for (let i = 0; i < CELL_COUNT; i++) {
    const v = next.grid[i]
    if (!Number.isInteger(v) || v < 0 || v > 9) fail(`マス${i}の値が不正: ${v}`)
    if (next.notes[i] < 0 || next.notes[i] > 511) fail(`マス${i}のメモが不正`)
    // 問題の数字は決して変わらない
    if (next.givens[i] !== 0 && next.grid[i] !== next.givens[i]) fail(`初期数字 ${i} が変わった`)
    // 数字の入ったマスにメモは残らない
    if (v !== 0 && next.notes[i] !== 0) fail(`数字の入ったマス${i}にメモが残っている`)
  }

  // --- クリア判定 ---
  const matches = next.grid.every((v, i) => v === solution[i])
  if ((next.status === 'solved') !== matches) fail('クリア判定が盤面と食い違う')

  // --- 確定マスは Undo とリスタート以外では変わらない ---
  if (action.type !== 'undo' && action.type !== 'restart') {
    for (let i = 0; i < CELL_COUNT; i++) {
      if (isSettled(prev, i) && next.grid[i] !== prev.grid[i]) fail(`確定マス${i}が書き換わった`)
    }
  }

  // --- 休憩中・クリア後は盤面が動かない（リスタートを除く） ---
  if ((prev.paused || prev.status === 'solved') && action.type !== 'restart') {
    if (next.grid !== prev.grid) fail(`休憩中/クリア後に盤面が変わった (${action.type})`)
    if (next.notes !== prev.notes) fail(`休憩中/クリア後にメモが変わった (${action.type})`)
  }

  // --- ミス回数は減らない（リスタートを除く） ---
  if (action.type !== 'restart' && next.mistakes < prev.mistakes) fail('ミス回数が減った')
  // ミスが増えるのは、不正解の数字が新しく置かれたときだけ
  if (next.mistakes > prev.mistakes) {
    const changed = next.grid.findIndex((v, i) => v !== prev.grid[i])
    if (changed < 0 || !isWrongAt(next, changed)) fail('不正解を置いていないのにミスが増えた')
  }

  // --- 自動入力は正解しか置かない ---
  if (action.type === 'autoFill') {
    for (let i = 0; i < CELL_COUNT; i++) {
      if (next.grid[i] !== prev.grid[i] && next.grid[i] !== solution[i]) fail('自動入力が不正解を置いた')
    }
    if (next.mistakes !== prev.mistakes) fail('自動入力でミスが増えた')
  }

  // --- 1手で変わる数字は1マスまで（リスタート・Undo・Redo を除く） ---
  if (!['restart', 'undo', 'redo'].includes(action.type)) {
    const changedCells = next.grid.filter((v, i) => v !== prev.grid[i]).length
    if (changedCells > 1) fail(`1手で${changedCells}マス変わった`)
  }

  // --- ありえないメモは書き込まれない ---
  for (let i = 0; i < CELL_COUNT; i++) {
    const added = next.notes[i] & ~prev.notes[i]
    if (added === 0 || action.type === 'undo' || action.type === 'redo') continue
    for (let n = 1; n <= 9; n++) {
      if ((added & bit(n)) === 0) continue
      if (action.type === 'fillAllNotes') {
        if (!computeCandidates(prev.grid, i).includes(n)) fail(`一括メモにありえない候補 ${n}`)
      } else if (!canAddNote(prev, i, n)) {
        fail(`マス${i}にありえないメモ ${n} が書かれた (${action.type})`)
      }
    }
  }

  // --- 置き終えた数字は選ばれたままにならない ---
  if (typeof next.activeDigit === 'number' && isDigitComplete(next, next.activeDigit)) {
    fail(`置き終えた数字 ${next.activeDigit} が選ばれたまま`)
  }

  // --- 正しく置けた個数は 9 を超えない ---
  for (let n = 1; n <= 9; n++) if (correctCount(next, n) > 9) fail(`数字${n}が9個を超えた`)

  // --- 完成の演出は、本当に完成したときだけ ---
  if (next.celebration && next.celebration !== prev.celebration) {
    const { units, origin, digit: done } = next.celebration
    if (next.status === 'solved') fail('クリアなのに完成の演出が立った')
    if (next.grid[origin] !== solution[origin]) fail('演出の起点が正解ではない')
    if (prev.grid[origin] === next.grid[origin]) fail('演出の起点に数字が置かれていない')
    for (const unit of units) {
      if (!unitIndices(unit).every((i) => next.grid[i] === solution[i])) {
        fail(`完成していない ${unit.type}${unit.index} を演出した`)
      }
      if (!unitIndices(unit).includes(origin)) fail('演出したユニットに起点が含まれない')
    }
    if (done !== null) {
      if (!isDigitComplete(next, done)) fail(`そろっていない数字 ${done} を演出した`)
      if (next.grid[origin] !== done) fail('コンプリートの数字と置いた数字が違う')
    }
    if (units.length === 0 && done === null) fail('中身の無い演出')
  }
  // 完成したのに演出が無い、も見逃さない（クリアの一手と Undo/Redo を除く）
  if (
    next.status !== 'solved' &&
    !['undo', 'redo', 'restart'].includes(action.type) &&
    next.celebration === prev.celebration
  ) {
    const changed = next.grid.findIndex((v, i) => v !== prev.grid[i])
    if (changed >= 0 && next.grid[changed] === solution[changed]) {
      const n = next.grid[changed]
      if (isDigitComplete(next, n)) fail(`数字 ${n} がそろったのに演出が無い`)
    }
  }

  // --- Undo / Redo の履歴 ---
  if (next.past.length > prev.past.length + 1) fail('履歴が一度に2つ以上増えた')

  // --- 効果音の判断は例外を出さず、音の高さは 1〜9 ---
  const sound = soundForTransition(action, prev, next)
  if (sound === 'place') {
    const d = placedDigit(prev, next)
    if (d === undefined || d < 1 || d > 9) fail(`正解の音の高さが決まらない: ${d}`)
  }
  if (next.celebration?.digit && next.celebration !== prev.celebration && sound !== 'digit') {
    fail(`数字コンプリートなのに音が ${sound}`)
  }

  return problems
}

const POOLS: [string, Puzzle[]][] = [
  ['easy', easyPool as Puzzle[]],
  ['normal', normalPool as Puzzle[]],
  ['hard', hardPool as Puzzle[]],
  ['expert', expertPool as Puzzle[]],
]

/** 1本の試行。破れた約束があれば、何手目のどの操作かを添えて返す */
const play = (puzzle: Puzzle, seed: number, steps: number) => {
  const rand = random(seed)
  let state = createGame(puzzle)
  let solvedCount = 0
  const history: string[] = []
  for (let step = 0; step < steps; step++) {
    const action = nextAction(rand, state)
    const next = gameReducer(state, action)
    history.push(action.type)
    const problems = violations(state, action, next)
    if (problems.length > 0) {
      return {
        error: `seed=${seed} step=${step} action=${JSON.stringify(action).slice(0, 120)}\n  ${problems.join('\n  ')}\n  直前の操作: ${history.slice(-8).join(' → ')}`,
        solvedCount,
      }
    }
    if (next.status === 'solved' && state.status !== 'solved') solvedCount++
    state = next
    // クリアしたら、たまにリスタートして続ける（クリア後の操作も確かめたいので毎回ではない）
    if (state.status === 'solved' && rand() < 0.3) state = gameReducer(state, { type: 'restart' })
  }
  return { error: null, solvedCount }
}

describe('ランダム操作でも約束が崩れない', () => {
  for (const [name, pool] of POOLS) {
    it(`${name}: 3問 × 20通り × 1200手`, () => {
      let solved = 0
      for (const puzzle of pool.slice(0, 3)) {
        for (let seed = 1; seed <= 20; seed++) {
          const result = play(puzzle, seed * 7919 + puzzle.givens.length, 1200)
          expect(result.error).toBeNull()
          solved += result.solvedCount
        }
      }
      // 正解を多めに混ぜているので、何度かはクリアまで届いているはず
      // （届かないと終盤の約束を確かめられていないことになる）
      expect(solved).toBeGreaterThanOrEqual(5)
    })
  }
})

describe('終盤の自動入力は、どこから始めてもクリアまで届く', () => {
  it('不正解が無ければ、空きマスを順に埋めて必ずクリアになる', () => {
    for (const [, pool] of POOLS) {
      for (const puzzle of pool.slice(0, 5)) {
        const solution = parseGrid(puzzle.solution)
        let state = createGame(puzzle)
        // 空きマスの一部を正解で埋めておく（どこから始めても届くことを見る）
        const empties = autoFillTargets(state)
        for (const i of empties.slice(0, Math.floor(empties.length / 2))) {
          state = gameReducer(state, { type: 'select', index: i })
          state = gameReducer(state, { type: 'input', value: solution[i] })
        }
        expect(canAutoFill(state, CELL_COUNT)).toBe(true)
        let guard = 0
        while (state.status !== 'solved' && guard++ < CELL_COUNT) {
          state = gameReducer(state, { type: 'autoFill', index: autoFillTargets(state)[0] })
        }
        expect(state.status).toBe('solved')
        expect(state.mistakes).toBe(0)
      }
    }
  })
})
