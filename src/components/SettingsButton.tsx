'use client'

/**
 * 設定ボタンと設定パネル。
 * 効果音（オン・オフと音量）・テーマ・終盤の自動入力をまとめて変えられる。
 */
import { useEffect, useId, useState } from 'react'
import { useSound } from '@/features/audio/useSound'
import { AUTO_FILL_CHOICES, useSettings } from '@/features/settings/settings'
import { PALETTES, usePalette, useTheme } from '@/features/theme/useTheme'

export function SettingsButton({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="設定"
        title="設定"
        className={`flex h-9 w-9 items-center justify-center rounded-lg border text-base ${className}`}
        style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}
      >
        ⚙️
      </button>
      {open && <SettingsPanel onClose={() => setOpen(false)} />}
    </>
  )
}

function SettingsPanel({ onClose }: { onClose: () => void }) {
  const titleId = useId()
  const { soundEnabled, toggleSound, volume, changeVolume, previewVolume } = useSound()
  const { theme, setTheme } = useTheme()
  const { palette, setPalette } = usePalette()
  const { settings, update } = useSettings()

  // Esc で閉じる。ゲームのキー操作（Esc で数字の選択解除）には渡さない
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopImmediatePropagation()
      onClose()
    }
    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center"
      style={{ background: 'rgb(0 0 0 / 0.45)' }}
      onClick={onClose}
      // パネル内のキー操作（スライダーの矢印キーなど）が盤面の操作にならないようにする
      onKeyDown={(event) => event.stopPropagation()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-sm rounded-2xl border p-5"
        style={{
          borderColor: 'var(--line)',
          background: 'var(--surface)',
          boxShadow: 'var(--shadow)',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 id={titleId} className="text-base font-semibold">
            設定
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="rounded-lg px-2 py-1 text-sm"
            style={{ color: 'var(--muted)' }}
          >
            ✕
          </button>
        </div>

        <Row label="効果音">
          <Segmented
            value={soundEnabled ? 'on' : 'off'}
            options={[
              { value: 'on', label: 'オン' },
              { value: 'off', label: 'オフ' },
            ]}
            onChange={(next) => {
              if ((next === 'on') !== soundEnabled) toggleSound()
            }}
          />
        </Row>

        <Row label="音量">
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={volume}
              disabled={!soundEnabled}
              aria-label="効果音の音量"
              onChange={(event) => changeVolume(Number(event.target.value))}
              // 動かし終えたときに1回鳴らして、大きさを確かめられるようにする
              onPointerUp={previewVolume}
              onKeyUp={previewVolume}
              className="w-full disabled:opacity-40"
              style={{ accentColor: 'var(--input)' }}
            />
            <span className="tabular w-10 shrink-0 text-right text-sm">{volume}%</span>
          </div>
        </Row>

        <Row label="テーマ">
          <Segmented
            value={theme}
            options={[
              { value: 'light', label: 'ライト' },
              { value: 'dark', label: 'ダーク' },
            ]}
            onChange={setTheme}
          />
        </Row>

        <Row label="配色">
          <div className="grid grid-cols-2 gap-2">
            {PALETTES.map((option) => {
              const active = option.id === palette
              const swatch = option.swatch[theme]
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setPalette(option.id)}
                  className="flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left"
                  style={{
                    borderColor: active ? 'var(--ring)' : 'var(--line)',
                    boxShadow: active ? 'inset 0 0 0 1px var(--ring)' : undefined,
                  }}
                >
                  {/* 見本：地色の上に、問題の数字と入力した数字 */}
                  <span
                    aria-hidden
                    className="tabular flex h-8 w-10 shrink-0 items-center justify-center gap-1 rounded-md border text-sm"
                    style={{ background: swatch.surface, borderColor: 'var(--line)' }}
                  >
                    <span style={{ color: swatch.given, fontWeight: 600 }}>5</span>
                    <span style={{ color: swatch.input }}>3</span>
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm" style={{ fontWeight: active ? 600 : 400 }}>
                      {option.id.toUpperCase()} {option.name}
                    </span>
                    <span className="block truncate text-[11px]" style={{ color: 'var(--muted)' }}>
                      {option.description}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </Row>

        <Row
          label="終盤の自動入力"
          description="空きマスが少なくなったら「自動入力」ボタンを出します。押すと残りを順に埋めます。"
        >
          <Segmented
            value={String(settings.autoFillThreshold)}
            options={AUTO_FILL_CHOICES.map((n) => ({
              value: String(n),
              label: n === 0 ? 'オフ' : `残り${n}`,
            }))}
            onChange={(next) => update({ autoFillThreshold: Number(next) })}
          />
        </Row>
      </section>
    </div>
  )
}

function Row({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="mt-4">
      <p className="text-sm font-medium">{label}</p>
      {description && (
        <p className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>
          {description}
        </p>
      )}
      <div className="mt-2">{children}</div>
    </div>
  )
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div
      className="grid gap-1 rounded-lg border p-1"
      style={{
        borderColor: 'var(--line)',
        gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
      }}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className="rounded-md px-2 py-1.5 text-sm"
            style={{
              background: active ? 'var(--input)' : 'transparent',
              color: active ? 'var(--surface)' : 'var(--foreground)',
              fontWeight: active ? 600 : 400,
            }}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
