'use client'

/**
 * テーマ（ライト / ダーク）の切り替え。
 *
 * 現在のテーマは <html data-theme> が持っている。
 * 初期値は layout.tsx のインラインスクリプトが描画前に決めているので、
 * React 側は「外部の状態」として読み取るだけにする。
 */
import { useCallback, useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'sudoku:theme'

const listeners = new Set<() => void>()

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const getSnapshot = (): Theme =>
  document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'

/** サーバー描画時は DOM が無いので、既定のライトとして扱う */
const getServerSnapshot = (): Theme => 'light'

export const useTheme = () => {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const setTheme = useCallback((next: Theme) => {
    document.documentElement.dataset.theme = next
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // 保存できなくても表示は切り替わる
    }
    listeners.forEach((listener) => listener())
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(getSnapshot() === 'dark' ? 'light' : 'dark')
  }, [setTheme])

  return { theme, setTheme, toggleTheme }
}
