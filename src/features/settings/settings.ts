'use client'

/**
 * 遊び方の設定。localStorage に持ち、useSyncExternalStore で読む。
 * 効果音のオン・オフと音量は features/audio/sounds.ts、テーマは features/theme が持つ。
 */
import { useCallback, useSyncExternalStore } from 'react'

export type Settings = {
  /**
   * 終盤の自動入力。空きマスがこの数以下になったら「自動入力」ボタンを出す。
   * 0 なら使わない
   */
  autoFillThreshold: number
}

/** 設定画面で選べる自動入力のしきい値 */
export const AUTO_FILL_CHOICES = [0, 5, 10, 15] as const

const STORAGE_KEY = 'sudoku:settings'

export const DEFAULT_SETTINGS: Settings = {
  autoFillThreshold: 0,
}

const listeners = new Set<() => void>()
let cache: Settings | null = null

const normalize = (raw: unknown): Settings => {
  const value = (raw ?? {}) as Partial<Settings>
  const threshold = Number(value.autoFillThreshold)
  return {
    autoFillThreshold: (AUTO_FILL_CHOICES as readonly number[]).includes(threshold)
      ? threshold
      : DEFAULT_SETTINGS.autoFillThreshold,
  }
}

/** スナップショットは同じ参照を返す（毎回作ると useSyncExternalStore が無限に再描画する） */
export const getSettings = (): Settings => {
  if (cache) return cache
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    cache = normalize(raw ? JSON.parse(raw) : null)
  } catch {
    cache = DEFAULT_SETTINGS
  }
  return cache
}

export const getSettingsServer = (): Settings => DEFAULT_SETTINGS

export const subscribeSettings = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const updateSettings = (patch: Partial<Settings>): void => {
  cache = normalize({ ...getSettings(), ...patch })
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache))
  } catch {
    // 保存できなくても、このセッションでは変わる
  }
  listeners.forEach((listener) => listener())
}

export const useSettings = () => {
  const settings = useSyncExternalStore(subscribeSettings, getSettings, getSettingsServer)
  const update = useCallback((patch: Partial<Settings>) => updateSettings(patch), [])
  return { settings, update }
}
