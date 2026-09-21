'use client'

/**
 * ヒントパネル（仕様書 12章・18.3）。
 *
 * ヒントを押した瞬間に答えを出さない。
 *   STEP 1 考え方 → STEP 2 対象を提示 → STEP 3 答えと理論
 * の順に、少しずつ情報を開示する。
 * 定石名は STEP 3 まで伏せる（先に名前を見ると考える余地がなくなるため）。
 */
import { TECHNIQUE_MAP } from '@/features/sudoku/hints/types'
import type { Hint } from '@/features/sudoku/hints/types'

type Props = {
  hint: Hint | null
  step: number
  /** 論理的な手が見つからなかった場合のメッセージ */
  notice: string | null
  onNext: () => void
  onApply: () => void
  onClose: () => void
}

const STEP_LABEL = ['考え方', 'もう少しヒント', '答えと理論']

/**
 * 画面下に固定して表示する。
 * 盤面を見ながら読めるようにし、スクロールしないと気づけない状態を避ける。
 */
function Sheet({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 px-3 pb-3 sm:px-5">
      <div
        className="mx-auto max-h-[60dvh] w-full max-w-md overflow-y-auto rounded-2xl border p-4 shadow-lg"
        style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}
      >
        {children}
      </div>
    </div>
  )
}

export function HintPanel({ hint, step, notice, onNext, onApply, onClose }: Props) {
  if (!hint) {
    if (!notice) return null
    return (
      <Sheet>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          {notice}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-3 rounded-lg border px-3 py-1.5 text-sm"
          style={{ borderColor: 'var(--line)' }}
        >
          閉じる
        </button>
      </Sheet>
    )
  }

  const meta = TECHNIQUE_MAP[hint.technique]
  const current = hint.steps[Math.min(step, 2)]
  const isLast = step >= 2

  return (
    <Sheet>
      <header className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">
          💡 ヒント
          <span className="ml-2 text-xs font-normal" style={{ color: 'var(--muted)' }}>
            STEP {Math.min(step, 2) + 1}/3・{STEP_LABEL[Math.min(step, 2)]}
          </span>
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="text-xs"
          style={{ color: 'var(--muted)' }}
          aria-label="ヒントを閉じる"
        >
          閉じる
        </button>
      </header>

      <p className="text-sm whitespace-pre-wrap" style={{ lineHeight: 1.7 }}>
        {current.body}
      </p>

      {isLast && (
        <div
          className="mt-3 rounded-lg border p-3 text-xs"
          style={{ borderColor: 'var(--line)', background: 'var(--background)' }}
        >
          <p className="font-semibold">
            使用した定石: {meta.name}
            <span className="ml-2 font-normal" style={{ color: 'var(--muted)' }}>
              Lv.{meta.level}
            </span>
          </p>
          <p className="mt-1" style={{ color: 'var(--muted)' }}>
            {meta.summary}
          </p>
          <p className="mt-2" style={{ lineHeight: 1.7 }}>
            {hint.explanation}
          </p>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {!isLast ? (
          <button
            type="button"
            onClick={onNext}
            className="rounded-lg border px-3 py-2 text-sm font-medium"
            style={{ borderColor: 'var(--input)', color: 'var(--input)' }}
          >
            {step === 0 ? 'もう少しヒント' : '答えを見る'}
          </button>
        ) : (
          <button
            type="button"
            onClick={onApply}
            className="rounded-lg px-3 py-2 text-sm font-medium"
            style={{ background: 'var(--input)', color: '#fff' }}
          >
            {hint.targetCell ? `${hint.targetCell} に ${hint.value} を入れる` : '候補を消す'}
          </button>
        )}
      </div>
    </Sheet>
  )
}
