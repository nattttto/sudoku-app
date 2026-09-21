/**
 * プレイ記録の保存（仕様書 19章）。
 * MVP の方針どおりサーバーは使わず、localStorage だけで完結させる。
 */
import type { GameRecord } from './types'

const KEY = 'sudoku:records:v1'

/** 無制限に貯めるとブラウザの容量を圧迫するので上限を設ける */
const MAX_RECORDS = 500

const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())

export const subscribeRecords = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const parse = (raw: string | null): GameRecord[] => {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // 壊れた記録が混ざっていても、読めるものだけ活かす
    return parsed.filter(
      (r): r is GameRecord =>
        typeof r === 'object' &&
        r !== null &&
        typeof (r as GameRecord).id === 'string' &&
        typeof (r as GameRecord).elapsedMs === 'number',
    )
  } catch {
    return []
  }
}

// useSyncExternalStore は同じ内容なら同じ参照を返す必要がある
let cachedRaw: string | null | undefined
let cachedRecords: GameRecord[] = []

export const getRecords = (): GameRecord[] => {
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(KEY)
  } catch {
    raw = null
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw
    cachedRecords = parse(raw)
  }
  return cachedRecords
}

/**
 * サーバー描画時は記録を持たない。
 * useSyncExternalStore は毎回同じ参照を返す必要があるので、空配列は使い回す。
 */
const EMPTY_RECORDS: GameRecord[] = []
export const getRecordsServer = (): GameRecord[] => EMPTY_RECORDS

export const addRecord = (record: GameRecord): void => {
  if (typeof window === 'undefined') return
  try {
    const next = [record, ...getRecords()].slice(0, MAX_RECORDS)
    window.localStorage.setItem(KEY, JSON.stringify(next))
    notify()
  } catch {
    // 保存できなくてもプレイは続けられる
  }
}

export const clearRecords = (): void => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(KEY)
    notify()
  } catch {
    // 何もしない
  }
}
