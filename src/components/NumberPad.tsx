'use client'

/**
 * 数字入力パッド。
 *
 * 入力方式は2通り。
 *   マス優先 : マスを選んでから数字を押す
 *   数字優先 : 数字を押して選んだ状態にし、マスをタップして入れる
 * 消しゴムは10個目のボタンとして並べる。数字優先では「消しゴムを選ぶ→マスをタップ」になる。
 */
import type { DigitSelection, InputMode, InputStyle } from '@/features/sudoku/game/gameState'

type Props = {
  inputStyle: InputStyle
  mode: InputMode
  activeDigit: DigitSelection
  /** 数字ごとの残り個数 */
  remaining: Record<number, number>
  /** マス優先で、まだマスを選んでいない */
  noCellSelected: boolean
  disabled: boolean
  onSelectDigit: (digit: DigitSelection) => void
  onInput: (value: number) => void
  onErase: () => void
  onToggleMode: () => void
  onSetInputStyle: (style: InputStyle) => void
}

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9]

export function NumberPad({
  inputStyle,
  mode,
  activeDigit,
  remaining,
  noCellSelected,
  disabled,
  onSelectDigit,
  onInput,
  onErase,
  onToggleMode,
  onSetInputStyle,
}: Props) {
  const isDigitFirst = inputStyle === 'digit'
  // マス優先ではマス未選択だと押しても何も起きないので、その状態を見せる
  const digitsInert = disabled || (!isDigitFirst && noCellSelected)

  const press = (digit: number) => {
    if (isDigitFirst) onSelectDigit(digit)
    else onInput(digit)
  }

  const pressErase = () => {
    if (isDigitFirst) onSelectDigit('erase')
    else onErase()
  }

  return (
    <div className="flex w-full flex-col gap-2">
      {/* 入力方式とメモ入力の切り替え。縦を使いすぎないよう1行にまとめる */}
      <div className="flex gap-2 text-sm">
        <div
          className="flex flex-1 rounded-lg border p-0.5"
          style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}
          role="group"
          aria-label="入力方式"
        >
          {(
            [
              ['cell', 'マス優先'],
              ['digit', '数字優先'],
            ] as const
          ).map(([style, label]) => (
            <button
              key={style}
              type="button"
              onClick={() => onSetInputStyle(style)}
              aria-pressed={inputStyle === style}
              className="flex-1 rounded-md px-2 py-1.5 font-medium transition-colors"
              style={{
                background: inputStyle === style ? 'var(--selected)' : 'transparent',
                color: inputStyle === style ? 'var(--foreground)' : 'var(--muted)',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onToggleMode}
          aria-pressed={mode === 'note'}
          className="shrink-0 rounded-lg border px-3 font-medium transition-colors"
          style={{
            borderColor: mode === 'note' ? 'var(--input)' : 'var(--line)',
            background: mode === 'note' ? 'var(--same)' : 'var(--surface)',
            color: mode === 'note' ? 'var(--input)' : 'var(--foreground)',
          }}
        >
          ✏️ メモ
        </button>
      </div>

      {/* 1〜9 と消しゴム。5列2段にして指で押しやすくする */}
      <div className="grid grid-cols-5 gap-1.5">
        {DIGITS.map((n) => {
          const left = remaining[n] ?? 0
          const isActive = isDigitFirst && activeDigit === n
          const usedUp = left === 0
          return (
            <button
              key={n}
              type="button"
              onClick={() => press(n)}
              disabled={digitsInert || (usedUp && !isDigitFirst)}
              aria-pressed={isDigitFirst ? isActive : undefined}
              aria-label={`${n}（残り${left}個）`}
              className="tabular flex aspect-[4/3] flex-col items-center justify-center rounded-xl border transition-colors disabled:opacity-40"
              style={{
                borderColor: isActive ? 'var(--ring)' : 'var(--line)',
                borderWidth: isActive ? 2 : 1,
                background: isActive ? 'var(--selected)' : 'var(--surface)',
                color: mode === 'note' ? 'var(--input)' : 'var(--foreground)',
                opacity: usedUp ? 0.4 : 1,
              }}
            >
              <span style={{ fontSize: 'clamp(1.25rem, 5.5vw, 1.6rem)', lineHeight: 1.1 }}>
                {n}
              </span>
              <span className="text-[11px] leading-none" style={{ color: 'var(--muted)' }}>
                残り{left}
              </span>
            </button>
          )
        })}

        <button
          type="button"
          onClick={pressErase}
          disabled={digitsInert}
          aria-pressed={isDigitFirst ? activeDigit === 'erase' : undefined}
          aria-label="消しゴム"
          className="flex aspect-[4/3] flex-col items-center justify-center rounded-xl border transition-colors disabled:opacity-40"
          style={{
            borderColor:
              isDigitFirst && activeDigit === 'erase' ? 'var(--ring)' : 'var(--line)',
            borderWidth: isDigitFirst && activeDigit === 'erase' ? 2 : 1,
            background:
              isDigitFirst && activeDigit === 'erase' ? 'var(--selected)' : 'var(--surface)',
          }}
        >
          <span style={{ fontSize: 'clamp(1.1rem, 5vw, 1.4rem)', lineHeight: 1.1 }}>⌫</span>
          <span className="text-[11px] leading-none" style={{ color: 'var(--muted)' }}>
            消す
          </span>
        </button>
      </div>

      {/* いまどう操作すればよいかを1行で示す */}
      <p className="text-center text-xs" style={{ color: 'var(--muted)' }}>
        {isDigitFirst
          ? activeDigit === null
            ? '数字か消しゴムを選んでから、マスをタップ'
            : activeDigit === 'erase'
              ? 'マスをタップすると消えます'
              : `マスをタップすると ${activeDigit} が${mode === 'note' ? 'メモに' : ''}入ります`
          : noCellSelected
            ? 'マスを選んでから数字を押してください'
            : `数字を押すと選択中のマスに${mode === 'note' ? 'メモとして' : ''}入ります`}
      </p>
    </div>
  )
}
