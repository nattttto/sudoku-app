'use client'

/** Undo / Redo / 候補表示 / リスタート */

type Props = {
  canUndo: boolean
  canRedo: boolean
  showCandidates: boolean
  onUndo: () => void
  onRedo: () => void
  onToggleCandidates: () => void
  onRestart: () => void
}

const buttonStyle = {
  borderColor: 'var(--line)',
  background: 'var(--surface)',
}

export function GameControls({
  canUndo,
  canRedo,
  showCandidates,
  onUndo,
  onRedo,
  onToggleCandidates,
  onRestart,
}: Props) {
  return (
    <div className="grid grid-cols-4 gap-2">
      <button
        type="button"
        onClick={onUndo}
        disabled={!canUndo}
        className="rounded-lg border px-2 py-2 text-sm disabled:opacity-40"
        style={buttonStyle}
      >
        ↩ 戻す
      </button>
      <button
        type="button"
        onClick={onRedo}
        disabled={!canRedo}
        className="rounded-lg border px-2 py-2 text-sm disabled:opacity-40"
        style={buttonStyle}
      >
        ↪ 進む
      </button>
      <button
        type="button"
        onClick={onToggleCandidates}
        aria-pressed={showCandidates}
        className="rounded-lg border px-2 py-2 text-sm"
        style={{
          borderColor: showCandidates ? 'var(--input)' : 'var(--line)',
          background: showCandidates ? 'var(--same)' : 'var(--surface)',
          color: showCandidates ? 'var(--input)' : 'var(--foreground)',
        }}
      >
        候補
      </button>
      <button
        type="button"
        onClick={onRestart}
        className="rounded-lg border px-2 py-2 text-sm"
        style={buttonStyle}
      >
        最初から
      </button>
    </div>
  )
}
