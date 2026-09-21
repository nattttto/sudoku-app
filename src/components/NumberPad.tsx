'use client'

/**
 * 数字入力パッド。
 * 数字モードと候補メモモードを切り替えられる。
 * 使い切った数字は薄くして、残りが見えるようにする。
 */
import type { InputMode } from '@/features/sudoku/game/gameState'

type Props = {
  mode: InputMode
  /** 数字ごとの残り個数 */
  remaining: Record<number, number>
  disabled: boolean
  onInput: (value: number) => void
  onErase: () => void
  onToggleMode: () => void
}

export function NumberPad({ mode, remaining, disabled, onInput, onErase, onToggleMode }: Props) {
  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onToggleMode}
          className="flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors"
          style={{
            borderColor: mode === 'note' ? 'var(--input)' : 'var(--line)',
            background: mode === 'note' ? 'var(--same)' : 'var(--surface)',
            color: mode === 'note' ? 'var(--input)' : 'var(--foreground)',
          }}
          aria-pressed={mode === 'note'}
        >
          {mode === 'note' ? '✏️ メモ入力中' : '✏️ メモ入力'}
        </button>
        <button
          type="button"
          onClick={onErase}
          disabled={disabled}
          className="flex-1 rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-40"
          style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}
        >
          消す
        </button>
      </div>

      <div className="grid grid-cols-9 gap-1 sm:gap-1.5">
        {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => {
          const left = remaining[n] ?? 0
          return (
            <button
              key={n}
              type="button"
              onClick={() => onInput(n)}
              disabled={disabled}
              className="tabular flex aspect-[3/4] flex-col items-center justify-center rounded-lg border disabled:opacity-40"
              style={{
                borderColor: 'var(--line)',
                background: 'var(--surface)',
                color: mode === 'note' ? 'var(--input)' : 'var(--foreground)',
                opacity: left === 0 ? 0.35 : 1,
              }}
            >
              <span style={{ fontSize: 'clamp(1rem, 4.5vw, 1.5rem)', lineHeight: 1 }}>{n}</span>
              <span className="mt-0.5 text-[10px]" style={{ color: 'var(--muted)' }}>
                {left}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
