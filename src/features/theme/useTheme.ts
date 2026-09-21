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

/**
 * 配色（A〜D）。ライト / ダークとは別に選べる。
 * テーマと同じく <html data-palette> が持ち、初期値は layout.tsx が描画前に入れる。
 * 色の値そのものは globals.css にある。
 */
export type Palette = 'a' | 'b' | 'c' | 'd'

/** 設定画面の見本の色（地色・問題の数字・入力した数字）。globals.css の値と揃えること */
type Swatch = { surface: string; given: string; input: string }

export const PALETTES: {
  id: Palette
  name: string
  description: string
  swatch: Record<Theme, Swatch>
}[] = [
  {
    id: 'a',
    name: 'スレート',
    description: '青みのあるグレー',
    swatch: {
      light: { surface: '#fbfcfd', given: '#3a4556', input: '#2f6bd0' },
      dark: { surface: '#1d2129', given: '#cfd5de', input: '#86b2f3' },
    },
  },
  {
    id: 'b',
    name: '和紙',
    description: 'あたたかい生成り',
    swatch: {
      light: { surface: '#fbf8f2', given: '#4b4238', input: '#2c6f8f' },
      dark: { surface: '#23201b', given: '#e4dbcc', input: '#7ec3db' },
    },
  },
  {
    id: 'c',
    name: 'セージ',
    description: 'くすんだ緑',
    swatch: {
      light: { surface: '#fafcf9', given: '#34463c', input: '#1f7a6b' },
      dark: { surface: '#1b2320', given: '#d2e0d8', input: '#6fd0b6' },
    },
  },
  {
    id: 'd',
    name: 'インディゴ',
    description: 'やわらかい紫紺',
    swatch: {
      light: { surface: '#fcfcff', given: '#3f4060', input: '#5a55d6' },
      dark: { surface: '#1e1e2a', given: '#dadaf0', input: '#a9a6ff' },
    },
  },
]

const PALETTE_KEY = 'sudoku:palette'

const isPalette = (value: string | undefined): value is Palette =>
  value === 'a' || value === 'b' || value === 'c' || value === 'd'

const getPaletteSnapshot = (): Palette => {
  const value = document.documentElement.dataset.palette
  return isPalette(value) ? value : 'a'
}

const getPaletteServerSnapshot = (): Palette => 'a'

export const usePalette = () => {
  const palette = useSyncExternalStore(subscribe, getPaletteSnapshot, getPaletteServerSnapshot)

  const setPalette = useCallback((next: Palette) => {
    document.documentElement.dataset.palette = next
    try {
      window.localStorage.setItem(PALETTE_KEY, next)
    } catch {
      // 保存できなくても表示は切り替わる
    }
    listeners.forEach((listener) => listener())
  }, [])

  return { palette, setPalette }
}
