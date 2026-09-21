'use client'

/**
 * 効果音。
 *
 * 音源ファイルは持たず、Web Audio でその場で合成する。
 *   - 読み込み待ちが無いので、タップと音がずれない
 *   - オフラインでも鳴る（PWA化しても困らない）
 *   - 数値を変えるだけで鳴りを調整できる
 *
 * 「ポチッ」の気持ちよさは、短い打撃音（transient）と
 * 軽く下がる本体（body）を重ねると出る。
 */

export type SoundName =
  | 'select'
  | 'place'
  | 'note'
  | 'erase'
  | 'error'
  | 'deny'
  | 'hint'
  | 'block'
  | 'combo'
  | 'complete'

const STORAGE_KEY = 'sudoku:sound'

// ---- 有効・無効 ----

const listeners = new Set<() => void>()
let enabled = true
let loaded = false

const loadEnabled = (): boolean => {
  if (loaded) return enabled
  loaded = true
  try {
    enabled = window.localStorage.getItem(STORAGE_KEY) !== 'off'
  } catch {
    enabled = true
  }
  return enabled
}

export const subscribeSound = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const isSoundEnabled = (): boolean => loadEnabled()

/** サーバー描画時は既定値（オン）として扱う */
export const isSoundEnabledServer = (): boolean => true

export const setSoundEnabled = (next: boolean): void => {
  enabled = next
  loaded = true
  try {
    window.localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off')
  } catch {
    // 保存できなくても、このセッションでは切り替わる
  }
  listeners.forEach((listener) => listener())
}

// ---- 合成 ----

let context: AudioContext | null = null

/**
 * AudioContext は最初の操作のときに作る。
 * ブラウザはユーザー操作より前の再生を止めるが、
 * 効果音はすべてタップ起点なので問題にならない。
 */
const getContext = (): AudioContext | null => {
  if (typeof window === 'undefined') return null
  if (!context) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    try {
      context = new Ctor()
    } catch {
      return null
    }
  }
  if (context.state === 'suspended') void context.resume()
  return context
}

type ToneOptions = {
  /** 開始の高さ（Hz） */
  from: number
  /** 終わりの高さ。省略時は from のまま */
  to?: number
  /** 長さ（秒） */
  duration: number
  /** 音量（0〜1） */
  gain: number
  type?: OscillatorType
  /** 鳴らし始めるまでの待ち（秒） */
  delay?: number
}

const tone = (ctx: AudioContext, options: ToneOptions): void => {
  const { from, to = from, duration, gain, type = 'sine', delay = 0 } = options
  const start = ctx.currentTime + delay
  const end = start + duration

  const osc = ctx.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(from, start)
  if (to !== from) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(to, 1), end)
  }

  const amp = ctx.createGain()
  // 立ち上がりを一瞬にすると「コッ」という打撃感が出る
  amp.gain.setValueAtTime(0.0001, start)
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.004)
  amp.gain.exponentialRampToValueAtTime(0.0001, end)

  osc.connect(amp)
  amp.connect(ctx.destination)
  osc.start(start)
  osc.stop(end + 0.02)
}

/** 音の設計。数値はすべて耳で合わせたもの */
const PLAY: Record<SoundName, (ctx: AudioContext) => void> = {
  // マスを選ぶだけ。存在が分かる程度のごく小さな音
  select: (ctx) => {
    tone(ctx, { from: 1250, to: 1150, duration: 0.02, gain: 0.025, type: 'triangle' })
  },

  // 数字を置く。これが主役の「ポチッ」
  place: (ctx) => {
    tone(ctx, { from: 1900, to: 1250, duration: 0.025, gain: 0.05, type: 'triangle' })
    tone(ctx, { from: 640, to: 330, duration: 0.09, gain: 0.16 })
  },

  // メモ。数字より軽く高い「ピッ」
  note: (ctx) => {
    tone(ctx, { from: 1500, to: 1300, duration: 0.018, gain: 0.03, type: 'triangle' })
    tone(ctx, { from: 950, to: 760, duration: 0.055, gain: 0.1 })
  },

  // 消す。下に抜ける「プッ」
  erase: (ctx) => {
    tone(ctx, { from: 430, to: 170, duration: 0.11, gain: 0.11 })
  },

  // 受け付けられない操作（ありえないメモなど）。間違いより軽い「ブッ」
  deny: (ctx) => {
    tone(ctx, { from: 190, to: 150, duration: 0.07, gain: 0.07, type: 'triangle' })
  },

  // 不正解。責めすぎない低い2連
  error: (ctx) => {
    tone(ctx, { from: 230, to: 190, duration: 0.07, gain: 0.1, type: 'triangle' })
    tone(ctx, { from: 200, to: 160, duration: 0.09, gain: 0.1, type: 'triangle', delay: 0.1 })
  },

  // ヒント。柔らかく上がる2音
  hint: (ctx) => {
    tone(ctx, { from: 560, duration: 0.09, gain: 0.08 })
    tone(ctx, { from: 840, duration: 0.12, gain: 0.08, delay: 0.09 })
  },

  // ブロック完成。キラッと駆け上がる短いフレーズ
  // クリアより高く速くして、「途中のごほうび」らしさを出す
  block: (ctx) => {
    const notes = [783.99, 1046.5, 1318.51, 1567.98] // ソ・ド・ミ・ソ
    notes.forEach((freq, i) => {
      const last = i === notes.length - 1
      tone(ctx, { from: freq, duration: last ? 0.34 : 0.1, gain: 0.09, delay: i * 0.055 })
      // 1オクターブ上を薄く重ねて、きらめきを足す
      tone(ctx, {
        from: freq * 2,
        duration: last ? 0.22 : 0.06,
        gain: 0.025,
        type: 'triangle',
        delay: i * 0.055,
      })
    })
  },

  // 1手でブロック・行・列のうち2つ以上が同時に完成したとき。
  // ブロック完成のフレーズをさらに一段上まで駆け上がらせる
  combo: (ctx) => {
    const notes = [783.99, 1046.5, 1318.51, 1567.98, 2093.0] // ソ・ド・ミ・ソ・ド
    notes.forEach((freq, i) => {
      const last = i === notes.length - 1
      tone(ctx, { from: freq, duration: last ? 0.42 : 0.09, gain: 0.09, delay: i * 0.05 })
      tone(ctx, {
        from: freq * 2,
        duration: last ? 0.3 : 0.05,
        gain: 0.025,
        type: 'triangle',
        delay: i * 0.05,
      })
    })
    // 最後に和音を重ねて厚みを出す
    tone(ctx, { from: 1318.51, duration: 0.4, gain: 0.05, delay: 0.2 })
    tone(ctx, { from: 1567.98, duration: 0.4, gain: 0.05, delay: 0.2 })
  },

  // クリア。ドミソドの分散和音
  complete: (ctx) => {
    ;[523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      tone(ctx, { from: freq, duration: 0.3, gain: 0.11, delay: i * 0.085 })
    })
  },
}

/** 端末が振動に対応していれば、ごく短く震わせて「ポチッ」を補強する */
const VIBRATION: Partial<Record<SoundName, number | number[]>> = {
  place: 8,
  error: 22,
  deny: 12,
  block: [10, 40, 10, 40, 18],
  combo: [10, 35, 10, 35, 10, 35, 24],
}

export const playSound = (name: SoundName): void => {
  if (!loadEnabled()) return

  const ctx = getContext()
  if (ctx) {
    try {
      PLAY[name](ctx)
    } catch {
      // 音が出せなくてもゲームは続けられる
    }
  }

  const pattern = VIBRATION[name]
  if (pattern && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(pattern)
    } catch {
      // 非対応端末では何もしない
    }
  }
}
