'use client'

/** Undo / Redo / 一時停止 / 候補まわり */

type Props = {
  canUndo: boolean
  canRedo: boolean
  showCandidates: boolean
  hasNotes: boolean
  paused: boolean
  disabled: boolean
  onUndo: () => void
  onRedo: () => void
  onToggleCandidates: () => void
  onFillNotes: () => void
  onClearNotes: () => void
  onTogglePause: () => void
}

const base = 'rounded-lg border px-2 py-2 text-sm transition-colors disabled:opacity-40'

export function GameControls({
  canUndo,
  canRedo,
  showCandidates,
  hasNotes,
  paused,
  disabled,
  onUndo,
  onRedo,
  onToggleCandidates,
  onFillNotes,
  onClearNotes,
  onTogglePause,
}: Props) {
  const plain = { borderColor: 'var(--line)', background: 'var(--surface)' }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2">
        <button type="button" onClick={onUndo} disabled={!canUndo} className={base} style={plain}>
          ↩ 戻す
        </button>
        <button type="button" onClick={onRedo} disabled={!canRedo} className={base} style={plain}>
          ↪ 進む
        </button>
        <button
          type="button"
          onClick={onTogglePause}
          aria-pressed={paused}
          className={base}
          style={{
            borderColor: paused ? 'var(--ring)' : 'var(--line)',
            background: paused ? 'var(--selected)' : 'var(--surface)',
          }}
        >
          {paused ? '▶ 再開' : '⏸ 休憩'}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={onToggleCandidates}
          aria-pressed={showCandidates}
          className={base}
          style={{
            borderColor: showCandidates ? 'var(--ring)' : 'var(--line)',
            background: showCandidates ? 'var(--selected)' : 'var(--surface)',
          }}
          title="盤面から計算した候補を薄く表示します（書き込みはしません）"
        >
          候補表示
        </button>
        <button
          type="button"
          onClick={onFillNotes}
          disabled={disabled}
          className={base}
          style={plain}
          title="計算した候補を、すべての空きマスにメモとして書き込みます"
        >
          メモ一括
        </button>
        <button
          type="button"
          onClick={onClearNotes}
          disabled={disabled || !hasNotes}
          className={base}
          style={plain}
          title="書き込んだメモをすべて消します"
        >
          メモ消去
        </button>
      </div>
    </div>
  )
}
