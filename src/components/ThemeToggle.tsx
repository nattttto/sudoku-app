'use client'

/** ライト / ダークの切り替えボタン */
import { useTheme } from '@/features/theme/useTheme'

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'ライトテーマに切り替える' : 'ダークテーマに切り替える'}
      title={theme === 'dark' ? 'ライトテーマ' : 'ダークテーマ'}
      className={`flex h-9 w-9 items-center justify-center rounded-lg border text-base ${className}`}
      style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  )
}
