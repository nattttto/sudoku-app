import { describe, expect, it } from 'vitest'
import type { GameRecord } from './types'
import {
  dailyStreakOf,
  dateKey,
  formatDuration,
  shiftDateKey,
  summarize,
  weakestTechniques,
} from './stats'
import { dailyDifficulty, dailyPuzzle } from './daily'

const record = (overrides: Partial<GameRecord> = {}): GameRecord => ({
  id: Math.random().toString(36).slice(2),
  difficulty: 'normal',
  givens: '.'.repeat(81),
  elapsedMs: 60_000,
  hintCount: 0,
  hintTechniques: {},
  mistakes: 0,
  requiredTechniques: [],
  completedAt: Date.now(),
  ...overrides,
})

describe('日付の扱い', () => {
  it('ローカル時間の YYYY-MM-DD を返す', () => {
    expect(dateKey(new Date(2026, 8, 21))).toBe('2026-09-21')
    expect(dateKey(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('日付をずらせる', () => {
    expect(shiftDateKey('2026-09-21', -1)).toBe('2026-09-20')
    expect(shiftDateKey('2026-09-01', -1)).toBe('2026-08-31')
    expect(shiftDateKey('2026-12-31', 1)).toBe('2027-01-01')
  })
})

describe('難易度別の集計', () => {
  const records = [
    record({ difficulty: 'easy', elapsedMs: 100_000, hintCount: 0 }),
    record({ difficulty: 'easy', elapsedMs: 200_000, hintCount: 2, mistakes: 3 }),
    record({ difficulty: 'hard', elapsedMs: 500_000, hintCount: 1 }),
  ]
  const stats = summarize(records)

  it('問題数を数える', () => {
    expect(stats.totalPlayed).toBe(3)
    expect(stats.byDifficulty.find((d) => d.difficulty === 'easy')!.played).toBe(2)
  })

  it('最速タイムと平均タイムを出す', () => {
    const easy = stats.byDifficulty.find((d) => d.difficulty === 'easy')!
    expect(easy.bestMs).toBe(100_000)
    expect(easy.averageMs).toBe(150_000)
  })

  it('ノーヒントで解いた数とミス数を数える', () => {
    const easy = stats.byDifficulty.find((d) => d.difficulty === 'easy')!
    expect(easy.noHintCount).toBe(1)
    expect(easy.totalMistakes).toBe(3)
  })

  it('記録がない難易度は null になる', () => {
    const expert = stats.byDifficulty.find((d) => d.difficulty === 'expert')!
    expect(expert.played).toBe(0)
    expect(expert.bestMs).toBeNull()
    expect(expert.averageMs).toBeNull()
  })
})

describe('定石ごとの習熟度', () => {
  const records = [
    // Naked Pair が必要で、ヒントに頼った
    record({
      requiredTechniques: ['NAKED_SINGLE', 'NAKED_PAIR'],
      hintTechniques: { NAKED_PAIR: 2 },
    }),
    // Naked Pair が必要だったが、自力で解けた
    record({ requiredTechniques: ['NAKED_SINGLE', 'NAKED_PAIR'] }),
    // X-Wing が必要で、ヒントに頼った
    record({ requiredTechniques: ['X_WING'], hintTechniques: { X_WING: 1 } }),
  ]
  const stats = summarize(records)
  const find = (id: string) => stats.byTechnique.find((t) => t.id === id)!

  it('必要だった問題数とヒントに頼った問題数を数える', () => {
    expect(find('NAKED_PAIR').requiredIn).toBe(2)
    expect(find('NAKED_PAIR').hintedIn).toBe(1)
    expect(find('NAKED_PAIR').hintCount).toBe(2)
  })

  it('一度も必要にならなかった定石は0のまま', () => {
    expect(find('HIDDEN_TRIPLE').requiredIn).toBe(0)
    expect(find('HIDDEN_TRIPLE').hintedIn).toBe(0)
  })

  it('ヒント依存度が高い順に苦手な定石を返す', () => {
    const weakest = weakestTechniques(stats.byTechnique, 1)
    // X-Wing は 1問中1問でヒント(100%)、Naked Pair は 2問中1問(50%)
    expect(weakest[0].id).toBe('X_WING')
    expect(weakest[1].id).toBe('NAKED_PAIR')
  })

  it('必要になった回数が少ない定石は苦手判定から外す', () => {
    expect(weakestTechniques(stats.byTechnique, 2).map((t) => t.id)).toEqual(['NAKED_PAIR'])
  })
})

describe('デイリー数独の連続日数', () => {
  it('今日まで続いていれば数える', () => {
    const records = [
      record({ daily: '2026-09-21' }),
      record({ daily: '2026-09-20' }),
      record({ daily: '2026-09-19' }),
    ]
    expect(dailyStreakOf(records, '2026-09-21')).toBe(3)
  })

  it('今日まだ解いていなくても、昨日まで続いていれば途切れていない', () => {
    const records = [record({ daily: '2026-09-20' }), record({ daily: '2026-09-19' })]
    expect(dailyStreakOf(records, '2026-09-21')).toBe(2)
  })

  it('2日以上空いていれば0', () => {
    const records = [record({ daily: '2026-09-18' })]
    expect(dailyStreakOf(records, '2026-09-21')).toBe(0)
  })

  it('デイリー以外の記録は数えない', () => {
    expect(dailyStreakOf([record({ daily: undefined })], '2026-09-21')).toBe(0)
  })

  it('記録がなければ0', () => {
    expect(dailyStreakOf([], '2026-09-21')).toBe(0)
  })
})

describe('日別のプレイ数', () => {
  it('直近30日分を古い順で返す', () => {
    const stats = summarize([], { today: '2026-09-21' })
    expect(stats.dailyCounts).toHaveLength(30)
    expect(stats.dailyCounts[0].date).toBe('2026-08-23')
    expect(stats.dailyCounts.at(-1)!.date).toBe('2026-09-21')
  })

  it('その日に解いた数を数える', () => {
    const at = new Date(2026, 8, 21, 12, 0).getTime()
    const stats = summarize([record({ completedAt: at }), record({ completedAt: at })], {
      today: '2026-09-21',
    })
    expect(stats.dailyCounts.at(-1)!.count).toBe(2)
  })
})

describe('デイリー数独', () => {
  it('同じ日付なら必ず同じ問題になる', () => {
    expect(dailyPuzzle('2026-09-21').givens).toBe(dailyPuzzle('2026-09-21').givens)
  })

  it('日付が違えば別の問題になる', () => {
    const a = dailyPuzzle('2026-09-21')
    const b = dailyPuzzle('2026-09-22')
    expect(a.givens).not.toBe(b.givens)
  })

  it('曜日で難易度が決まる', () => {
    // 2026-09-21 は月曜
    expect(dailyDifficulty('2026-09-21')).toBe('easy')
    // 2026-09-20 は日曜
    expect(dailyDifficulty('2026-09-20')).toBe('expert')
  })

  it('選ばれた問題の難易度は曜日の難易度と一致する', () => {
    for (const key of ['2026-09-20', '2026-09-21', '2026-09-23', '2026-09-25']) {
      expect(dailyPuzzle(key).difficulty).toBe(dailyDifficulty(key))
    }
  })
})

describe('時間の表示', () => {
  it('1時間未満は分:秒', () => {
    expect(formatDuration(0)).toBe('00:00')
    expect(formatDuration(65_000)).toBe('01:05')
  })

  it('1時間以上は時:分:秒', () => {
    expect(formatDuration(3_725_000)).toBe('1:02:05')
  })
})
